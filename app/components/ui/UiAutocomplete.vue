<script setup lang="ts" generic="V extends string | number, M extends boolean = false">
/**
 * Search-as-you-type picker (generalises admin/PersonPicker.vue): an input with role="combobox" and
 * aria-autocomplete="list" that asks `source(query)` for options after a debounce, then shows them in a listbox.
 *
 * - Single (default): v-model is the chosen value or null; the input shows the chosen label. Typing something
 *   else clears the choice, as in PersonPicker.
 * - `multiple`: v-model is an array; choices show as removable chips before the input, Backspace in an empty input
 *   removes the last one, and choosing again toggles.
 *
 * Labels for values chosen before mount come from `selectedOptions` (pass the option objects you already have).
 * Stale answers are dropped and the previous request is aborted (the AbortSignal is passed to `source`).
 *
 * Keyboard: ↓ / ↑ (wrapping), Home / End when the list is open, Enter chooses, Esc closes (then clears the text),
 * Alt+↓ opens with the last results.
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiGlyph from './UiGlyph.vue'
import type { UiOption } from '~/utils/uiControls'
import { useAnchoredPopover } from '~/composables/useAnchoredPopover'

type Model = M extends true ? V[] : V | null

const model = defineModel<Model>()
/** Conditional model types don't narrow inside the component: read and write through these. */
const raw = computed(() => model.value as unknown as V | V[] | null | undefined)
function setModel(v: V | V[] | null) {
  ;(model as unknown as Ref<unknown>).value = v
}
const props = withDefaults(
  defineProps<{
    source: (query: string, signal: AbortSignal) => Promise<readonly UiOption<V>[]>
    multiple?: M
    /** Known option objects for the current value(s), so labels show before any search. */
    selectedOptions?: readonly UiOption<V>[]
    /** ms after the last keystroke before `source` runs (default 250). */
    debounce?: number
    /** Characters needed before searching (default 1). */
    minChars?: number
    placeholder?: string
    disabled?: boolean
    size?: 'sm' | 'md'
    error?: boolean | string
    id?: string
    label?: string
    ariaLabelledby?: string
    ariaDescribedby?: string
    /** Show the text left-to-right (emails, ids). */
    ltr?: boolean
  }>(),
  {
    multiple: undefined,
    selectedOptions: () => [],
    debounce: 250,
    minChars: 1,
    placeholder: undefined,
    size: 'md',
    error: false,
    id: undefined,
    label: undefined,
    ariaLabelledby: undefined,
    ariaDescribedby: undefined,
  },
)
const emit = defineEmits<{
  /** The option the user just chose (single) or toggled on (multiple), with its `data`. */
  select: [option: UiOption<V>]
  /** An option removed in multiple mode. */
  remove: [option: UiOption<V>]
  /** The text in the input (not debounced). */
  query: [text: string]
}>()
defineSlots<{ option?: (p: { option: UiOption<V>; selected: boolean; active: boolean }) => unknown }>()

const { t } = useI18n()
const uid = useId()
const inputId = computed(() => props.id ?? `${uid}-input`)
const listId = `${uid}-list`
const errId = `${uid}-err`
const statusId = `${uid}-status`
const optId = (i: number) => `${uid}-opt-${i}`

const root = ref<HTMLElement>()
const box = ref<HTMLElement>()
const pop = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const { open, show, hide } = useAnchoredPopover(root, box, pop)

const q = ref('')
const results = shallowRef<UiOption<V>[]>([])
const status = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const active = ref(-1)
const focused = ref(false)
const known = new Map<V, UiOption<V>>()

// Generic props aren't boolean-cast by Vue: a bare `multiple` attribute arrives as ''.
const isMulti = computed(() => props.multiple !== undefined && props.multiple !== null && (props.multiple as unknown) !== false)
const values = computed<V[]>(() => {
  const v = raw.value ?? null
  if (isMulti.value) return Array.isArray(v) ? v : []
  return v === null || v === undefined || Array.isArray(v) ? [] : [v]
})
function optionFor(v: V): UiOption<V> {
  return known.get(v) ?? props.selectedOptions.find(o => o.value === v) ?? { value: v, label: String(v) }
}
const chips = computed(() => (isMulti.value ? values.value.map(optionFor) : []))
const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.ariaDescribedby, errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)
const tooShort = computed(() => q.value.trim().length > 0 && q.value.trim().length < props.minChars)
const panel = computed<'list' | 'loading' | 'empty' | 'error' | 'short' | null>(() => {
  if (tooShort.value) return 'short'
  if (status.value === 'loading' && !results.value.length) return 'loading'
  if (status.value === 'error') return 'error'
  if (status.value === 'done' && !results.value.length) return 'empty'
  if (results.value.length) return 'list'
  return null
})
const announce = computed(() => {
  if (!focused.value) return ''
  if (panel.value === 'loading') return t('ui.autocomplete.loading')
  if (panel.value === 'empty') return t('ui.autocomplete.empty')
  if (panel.value === 'error') return t('ui.autocomplete.error')
  if (panel.value === 'short') return t('ui.autocomplete.minChars', { n: props.minChars })
  if (panel.value === 'list') return t('ui.autocomplete.results', { n: results.value.length })
  return ''
})

for (const o of props.selectedOptions) known.set(o.value, o)
watch(() => props.selectedOptions, list => list.forEach(o => known.set(o.value, o)))

// Single mode: the input mirrors the chosen label.
const singleLabel = computed(() => (!isMulti.value && values.value.length ? optionFor(values.value[0]!).label : ''))
watch(singleLabel, (label) => {
  if (!isMulti.value && label && q.value !== label) q.value = label
}, { immediate: true })

let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0
let ctrl: AbortController | null = null

function cancel() {
  if (timer) clearTimeout(timer)
  timer = null
  ctrl?.abort()
  ctrl = null
}

async function run(text: string) {
  cancel()
  const mine = ++seq
  ctrl = new AbortController()
  status.value = 'loading'
  try {
    const out = await props.source(text, ctrl.signal)
    if (mine !== seq) return
    results.value = [...out]
    status.value = 'done'
    active.value = results.value.length ? 0 : -1
  } catch (e) {
    if (mine !== seq) return
    if ((e as { name?: string })?.name === 'AbortError') return
    results.value = []
    status.value = 'error'
  }
  syncOpen()
}

function syncOpen() {
  if (focused.value && panel.value) void show()
  else hide()
}

function onInput(e: Event) {
  const text = (e.target as HTMLInputElement).value
  q.value = text
  emit('query', text)
  if (!isMulti.value && values.value.length && text !== singleLabel.value) setModel(null)
  const term = text.trim()
  cancel()
  seq++ // drop answers to earlier text
  if (!term || term.length < props.minChars) {
    results.value = []
    status.value = 'idle'
    syncOpen()
    return
  }
  status.value = 'loading'
  syncOpen()
  timer = setTimeout(() => void run(term), props.debounce)
}

function isChosen(o: UiOption<V>) {
  return values.value.includes(o.value)
}

function choose(i: number) {
  const o = results.value[i]
  if (!o || o.disabled) return
  known.set(o.value, o)
  if (isMulti.value) {
    if (isChosen(o)) {
      setModel(values.value.filter(v => v !== o.value))
      emit('remove', o)
    } else {
      setModel([...values.value, o.value])
      emit('select', o)
    }
    q.value = ''
    results.value = []
    status.value = 'idle'
    hide()
  } else {
    setModel(o.value)
    q.value = o.label
    emit('select', o)
    results.value = []
    status.value = 'idle'
    hide()
  }
  input.value?.focus()
}

function removeChip(o: UiOption<V>) {
  if (props.disabled) return
  setModel(values.value.filter(v => v !== o.value))
  emit('remove', o)
  input.value?.focus()
}

function clearAll() {
  cancel()
  seq++
  q.value = ''
  results.value = []
  status.value = 'idle'
  setModel(isMulti.value ? [] : null)
  hide()
  input.value?.focus()
}

function move(step: number) {
  const n = results.value.length
  if (!n) return
  let i = active.value
  for (let k = 0; k < n; k++) {
    i = (((i + step) % n) + n) % n
    if (!results.value[i]!.disabled) break
  }
  active.value = i
  void nextTick(() => document.getElementById(optId(i))?.scrollIntoView?.({ block: 'nearest' }))
}

function onKey(e: KeyboardEvent) {
  const k = e.key
  if (k === 'ArrowDown') {
    if (!open.value) {
      if (results.value.length || panel.value) void show()
    } else move(1)
  } else if (k === 'ArrowUp') {
    if (open.value) move(-1)
  } else if ((k === 'Home' || k === 'End') && open.value && results.value.length) {
    active.value = k === 'Home' ? 0 : results.value.length - 1
    move(0)
  } else if (k === 'Enter') {
    if (!open.value || active.value < 0) return
    choose(active.value)
  } else if (k === 'Escape') {
    if (open.value) {
      e.stopPropagation()
      hide()
    } else if (q.value && (isMulti.value || !values.value.length)) {
      e.stopPropagation()
      q.value = ''
      results.value = []
      status.value = 'idle'
    } else return
  } else if (k === 'Backspace' && isMulti.value && !q.value && values.value.length) {
    removeChip(optionFor(values.value[values.value.length - 1]!))
  } else return
  e.preventDefault()
}

function onFocus() {
  focused.value = true
}
function onBlur() {
  focused.value = false
  hide()
  // Single mode: leave the chosen label in the input, not half-typed text over it.
  if (!isMulti.value && singleLabel.value) q.value = singleLabel.value
}

onBeforeUnmount(cancel)

defineExpose({ focus: () => input.value?.focus(), clear: clearAll })
</script>

<template>
  <div
    ref="root"
    class="ui-autocomplete"
    :class="[`size-${size}`, { invalid, disabled, multi: isMulti, 'is-open': open }]"
  >
    <div ref="box" class="box" @click="input?.focus()">
      <UiGlyph name="search" :size="size === 'sm' ? 16 : 20" class="lead" />
      <ul v-if="chips.length" class="chips" role="list">
        <li v-for="c in chips" :key="String(c.value)" class="chip">
          <span class="chip-label">{{ c.label }}</span>
          <button
            type="button"
            class="chip-x"
            :disabled="disabled"
            :aria-label="t('ui.autocomplete.remove', { label: c.label })"
            @click.stop="removeChip(c)"
          >
            <UiGlyph name="close" :size="12" />
          </button>
        </li>
      </ul>
      <input
        :id="inputId"
        ref="input"
        class="input"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        :dir="ltr ? 'ltr' : undefined"
        :value="q"
        :disabled="disabled"
        :placeholder="chips.length ? undefined : (placeholder ?? t('ui.autocomplete.placeholder'))"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="listId"
        :aria-activedescendant="open && panel === 'list' && active >= 0 ? optId(active) : undefined"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-label="label"
        :aria-labelledby="ariaLabelledby"
        :aria-describedby="describedby"
        :aria-busy="status === 'loading' ? 'true' : undefined"
        @input="onInput"
        @keydown="onKey"
        @focus="onFocus"
        @blur="onBlur"
      >
      <span v-if="status === 'loading'" class="spinner" aria-hidden="true" />
      <button
        v-if="!disabled && (q || values.length)"
        type="button"
        class="clear"
        :aria-label="t('ui.autocomplete.clear')"
        @click.stop="clearAll"
      >
        <UiGlyph name="close" :size="16" />
      </button>
    </div>
    <p v-if="errorText" :id="errId" class="msg">{{ errorText }}</p>
    <span :id="statusId" class="sr-only" role="status" aria-live="polite">{{ announce }}</span>

    <div v-show="open" ref="pop" popover="manual" class="ui-ac-pop" @mousedown.prevent>
      <div
        :id="listId"
        role="listbox"
        :aria-multiselectable="isMulti ? 'true' : undefined"
        :aria-label="label"
        :aria-labelledby="label ? undefined : (ariaLabelledby ?? inputId)"
      >
        <template v-if="panel === 'list'">
          <div
            v-for="(o, i) in results"
            :id="optId(i)"
            :key="String(o.value)"
            role="option"
            class="opt"
            :class="{ active: i === active }"
            :aria-selected="(isMulti ? isChosen(o) : i === active) ? 'true' : 'false'"
            :aria-disabled="o.disabled ? 'true' : undefined"
            @click="choose(i)"
            @mousemove="!o.disabled && (active = i)"
          >
            <slot name="option" :option="o" :selected="isChosen(o)" :active="i === active">
              <UiGlyph v-if="o.icon" :name="o.icon" :size="18" class="opt-icon" />
              <span class="opt-label">{{ o.label }}</span>
              <span v-if="o.hint" class="opt-hint">{{ o.hint }}</span>
            </slot>
            <UiGlyph v-if="isMulti && isChosen(o)" name="check" :size="16" class="opt-check" />
          </div>
        </template>
      </div>
      <div v-if="panel && panel !== 'list'" class="state" :class="panel" aria-hidden="true">
        <template v-if="panel === 'loading'">{{ t('ui.autocomplete.loading') }}</template>
        <template v-else-if="panel === 'empty'">{{ t('ui.autocomplete.empty') }}</template>
        <template v-else-if="panel === 'error'">{{ t('ui.autocomplete.error') }}</template>
        <template v-else>{{ t('ui.autocomplete.minChars', { n: minChars }) }}</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-autocomplete {
  --ui-h: var(--tilw-field-h);
  --ui-pad: var(--tilw-space-16);
  --ui-font: 500 16px/1.34 var(--tilw-font-ar);
  display: grid;
  gap: var(--tilw-space-4);
  min-inline-size: 0;
}
.size-sm {
  --ui-h: 36px;
  --ui-pad: var(--tilw-space-12);
  --ui-font: 500 14px/1.3 var(--tilw-font-ar);
}
.box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-block-size: var(--ui-h);
  padding-block: 3px;
  padding-inline: var(--ui-pad) calc(var(--ui-pad) - 6px);
  box-sizing: border-box;
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  cursor: text;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.box:hover {
  border-color: var(--tilw-text-muted);
}
.box:focus-within {
  border-color: var(--tilw-focus-ring);
  box-shadow: 0 0 0 1px var(--tilw-focus-ring);
}
.invalid .box {
  border-color: var(--tilw-status-error);
}
.invalid .box:focus-within {
  box-shadow: 0 0 0 1px var(--tilw-status-error);
}
.disabled .box {
  border-color: var(--tilw-border-subtle);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  cursor: not-allowed;
}
.lead {
  color: var(--tilw-text-muted);
  margin-inline-end: 4px;
}
.chips {
  display: contents;
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-inline-size: 100%;
  block-size: calc(var(--ui-h) - 16px);
  min-block-size: 24px;
  padding-inline: 10px 4px;
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-surface-selected);
  font: 500 13px/1 var(--tilw-font-ar);
}
.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-x {
  display: grid;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--tilw-radius-pill);
  background: none;
  color: inherit;
  cursor: pointer;
}
.chip-x:hover {
  background: var(--tilw-surface-sand);
}
.chip-x:focus-visible,
.clear:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
.input {
  flex: 1 1 80px;
  min-inline-size: 60px;
  block-size: calc(var(--ui-h) - 8px);
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: var(--ui-font);
  outline: none;
}
.input[dir='ltr'] {
  font-family: var(--tilw-font-lat);
}
/* An LTR field (email, id) still shows its Arabic placeholder from the reading side. */
.input[dir='ltr']:placeholder-shown {
  direction: inherit;
  font-family: var(--tilw-font-ar);
}
.input::placeholder {
  color: var(--tilw-text-muted);
}
.input:disabled {
  cursor: not-allowed;
}
.spinner {
  inline-size: 14px;
  block-size: 14px;
  flex: 0 0 auto;
  border: 2px solid var(--tilw-border-subtle);
  border-block-start-color: var(--tilw-action-primary);
  border-radius: 50%;
  animation: ui-ac-spin 0.8s linear infinite;
}
@keyframes ui-ac-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}
.clear {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: var(--tilw-radius-pill);
  background: none;
  color: var(--tilw-text-muted);
  cursor: pointer;
}
.clear:hover {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.msg {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.ui-ac-pop {
  box-sizing: border-box;
  max-inline-size: min(480px, calc(100vw - 16px));
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  box-shadow: var(--tilw-shadow-pop);
}
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 36px;
  padding: 6px 10px;
  border-radius: 8px;
  font: 500 14px/1.4 var(--tilw-font-ar);
  cursor: pointer;
}
.opt.active {
  background: var(--tilw-surface-selected);
}
.opt[aria-disabled='true'] {
  opacity: 0.6;
  cursor: not-allowed;
}
.opt-icon {
  color: var(--tilw-text-muted);
}
.opt-label {
  flex: 1;
  min-inline-size: 0;
}
.opt-hint {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-caption);
  unicode-bidi: plaintext;
}
.opt-check {
  color: var(--tilw-action-primary);
}
.state {
  padding: 8px 10px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-meta);
}
.state.error {
  color: var(--tilw-status-error);
}
</style>
