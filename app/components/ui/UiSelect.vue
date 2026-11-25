<script setup lang="ts" generic="V extends string | number">
/**
 * Styled single-choice list that replaces a native <select> (APG "select-only combobox"): a button with
 * role="combobox" opens a listbox; focus stays on the button and the active option is announced through
 * aria-activedescendant.
 *
 * Keyboard — closed: ↓ / Enter / Space / Alt+↓ open on the current choice, ↑ / Home open on the first, End on the
 * last, letters open and jump (type-ahead). Open: ↑ ↓, Home / End, PageUp / PageDown (10), letters, Enter / Space
 * choose, Alt+↑ / Tab choose and close, Esc closes without choosing (and doesn't close a surrounding dialog).
 *
 * Label it with <label :for="id">, `aria-labelledby` or `label` (aria-label).
 */
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiGlyph from './UiGlyph.vue'
import { firstEnabled, groupOptions, lastEnabled, stepEnabled, typeAhead, type UiOption } from '~/utils/uiControls'
import { useAnchoredPopover } from '~/composables/useAnchoredPopover'

const model = defineModel<V | null>({ default: null })
const props = withDefaults(
  defineProps<{
    options: readonly UiOption<V>[]
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    size?: 'sm' | 'md'
    /** true for the red state only; a string is also shown under the control. */
    error?: boolean | string
    /** id of the trigger button, for <label for>. */
    id?: string
    /** aria-label when there is no visible label. */
    label?: string
    ariaLabelledby?: string
    ariaDescribedby?: string
    /** Renders a hidden input so the value is part of a native form submit. */
    name?: string
  }>(),
  { size: 'md', placeholder: undefined, error: false, id: undefined, label: undefined, ariaLabelledby: undefined, ariaDescribedby: undefined, name: undefined },
)
const emit = defineEmits<{ change: [value: V | null]; open: []; close: [] }>()
defineSlots<{ option?: (p: { option: UiOption<V>; selected: boolean; active: boolean }) => unknown }>()

const { t } = useI18n()
const uid = useId()
const triggerId = computed(() => props.id ?? `${uid}-trigger`)
const listId = `${uid}-list`
const errId = `${uid}-err`
const optId = (i: number) => `${uid}-opt-${i}`

const root = ref<HTMLElement>()
const box = ref<HTMLElement>()
const pop = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const { open, show, hide } = useAnchoredPopover(root, box, pop)

const groups = computed(() => groupOptions(props.options))
const flat = computed(() => groups.value.flatMap(g => g.options.map(o => o.option)))
const selectedIndex = computed(() => flat.value.findIndex(o => o.value === model.value))
const selected = computed(() => flat.value[selectedIndex.value] ?? null)
const active = ref(-1)
const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.ariaDescribedby, errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)

watch(open, v => (v ? emit('open') : emit('close')))

async function openList(at: 'current' | 'first' | 'last' = 'current') {
  if (props.disabled) return
  const list = flat.value
  active.value =
    at === 'first' ? firstEnabled(list)
    : at === 'last' ? lastEnabled(list)
    : selectedIndex.value >= 0 ? selectedIndex.value : firstEnabled(list)
  await show()
  scrollActive()
}

function close(refocus = false) {
  hide()
  if (refocus) trigger.value?.focus()
}

function choose(i: number) {
  const o = flat.value[i]
  if (!o || o.disabled) return
  if (o.value !== model.value) {
    model.value = o.value
    emit('change', o.value)
  }
  close(true)
}

function clear() {
  if (props.disabled) return
  model.value = null
  emit('change', null)
  trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void openList()
}

function scrollActive() {
  void nextTick(() => {
    const el = active.value >= 0 ? document.getElementById(optId(active.value)) : null
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

function move(i: number) {
  if (i < 0) return
  active.value = i
  scrollActive()
}

// type-ahead buffer: letters typed within 500 ms build a word
let buffer = ''
let bufferTimer: ReturnType<typeof setTimeout> | null = null
function typeChar(ch: string) {
  buffer += ch
  if (bufferTimer) clearTimeout(bufferTimer)
  bufferTimer = setTimeout(() => (buffer = ''), 500)
  const i = typeAhead(flat.value, buffer, active.value)
  if (i >= 0) move(i)
}

function onKey(e: KeyboardEvent) {
  if (props.disabled) return
  const k = e.key
  const printable = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
  if (!open.value) {
    if (k === 'ArrowDown' || k === 'Enter' || k === ' ') void openList()
    else if (k === 'ArrowUp' || k === 'Home') void openList('first')
    else if (k === 'End') void openList('last')
    else if (printable) {
      void openList().then(() => typeChar(k))
    } else return
    e.preventDefault()
    return
  }
  const list = flat.value
  if (k === 'ArrowDown') move(stepEnabled(list, active.value, 1))
  else if (k === 'ArrowUp' && e.altKey) choose(active.value)
  else if (k === 'ArrowUp') move(stepEnabled(list, active.value, -1))
  else if (k === 'Home') move(firstEnabled(list))
  else if (k === 'End') move(lastEnabled(list))
  else if (k === 'PageDown') move(stepEnabled(list, active.value, 10))
  else if (k === 'PageUp') move(stepEnabled(list, active.value, -10))
  else if (k === 'Enter' || (k === ' ' && !buffer)) choose(active.value)
  else if (k === 'Escape') {
    e.stopPropagation()
    close()
  } else if (k === 'Tab') {
    choose(active.value)
    return // let focus move on
  } else if (printable) typeChar(k)
  else return
  e.preventDefault()
}

function onBlur() {
  // Focus left the control (not to the list: options keep focus with mousedown.prevent).
  if (open.value) close()
}

defineExpose({ focus: () => trigger.value?.focus(), open: () => openList(), close: () => close() })
</script>

<template>
  <div ref="root" class="ui-select" :class="[`size-${size}`, { invalid, disabled, 'is-open': open }]">
    <div ref="box" class="box">
      <UiGlyph v-if="selected?.icon" :name="selected.icon" :size="size === 'sm' ? 16 : 20" class="lead" />
      <button
        :id="triggerId"
        ref="trigger"
        type="button"
        role="combobox"
        class="trigger"
        :disabled="disabled"
        aria-haspopup="listbox"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="listId"
        :aria-activedescendant="open && active >= 0 ? optId(active) : undefined"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-label="label"
        :aria-labelledby="ariaLabelledby"
        :aria-describedby="describedby"
        @click="toggle"
        @keydown="onKey"
        @blur="onBlur"
      >
        <span v-if="selected" class="value">{{ selected.label }}</span>
        <span v-else class="placeholder">{{ placeholder ?? t('ui.select.placeholder') }}</span>
      </button>
      <button
        v-if="clearable && selected && !disabled"
        type="button"
        class="clear"
        :aria-label="t('ui.select.clear')"
        @click="clear"
      >
        <UiGlyph name="close" :size="16" />
      </button>
      <UiGlyph name="chevron-down" :size="size === 'sm' ? 18 : 20" class="chev" />
    </div>
    <input v-if="name" type="hidden" :name="name" :value="model ?? ''">
    <p v-if="errorText" :id="errId" class="msg">{{ errorText }}</p>

    <div v-show="open" ref="pop" popover="manual" class="ui-select-pop" @mousedown.prevent>
      <div
        :id="listId"
        role="listbox"
        :aria-label="label"
        :aria-labelledby="label ? undefined : (ariaLabelledby ?? triggerId)"
      >
        <template v-for="g in groups" :key="g.label">
          <div v-if="g.label" role="group" :aria-labelledby="`${listId}-g-${g.options[0]!.index}`" class="group">
            <div :id="`${listId}-g-${g.options[0]!.index}`" role="presentation" class="group-label">{{ g.label }}</div>
            <div
              v-for="{ option, index } in g.options"
              :id="optId(index)"
              :key="String(option.value)"
              role="option"
              class="opt"
              :class="{ active: index === active }"
              :aria-selected="index === selectedIndex ? 'true' : 'false'"
              :aria-disabled="option.disabled ? 'true' : undefined"
              @click="choose(index)"
              @mousemove="!option.disabled && (active = index)"
            >
              <slot name="option" :option="option" :selected="index === selectedIndex" :active="index === active">
                <UiGlyph v-if="option.icon" :name="option.icon" :size="18" class="opt-icon" />
                <span class="opt-label">{{ option.label }}</span>
                <span v-if="option.hint" class="opt-hint">{{ option.hint }}</span>
              </slot>
              <UiGlyph v-if="index === selectedIndex" name="check" :size="16" class="opt-check" />
            </div>
          </div>
          <template v-else>
            <div
              v-for="{ option, index } in g.options"
              :id="optId(index)"
              :key="String(option.value)"
              role="option"
              class="opt"
              :class="{ active: index === active }"
              :aria-selected="index === selectedIndex ? 'true' : 'false'"
              :aria-disabled="option.disabled ? 'true' : undefined"
              @click="choose(index)"
              @mousemove="!option.disabled && (active = index)"
            >
              <slot name="option" :option="option" :selected="index === selectedIndex" :active="index === active">
                <UiGlyph v-if="option.icon" :name="option.icon" :size="18" class="opt-icon" />
                <span class="opt-label">{{ option.label }}</span>
                <span v-if="option.hint" class="opt-hint">{{ option.hint }}</span>
              </slot>
              <UiGlyph v-if="index === selectedIndex" name="check" :size="16" class="opt-check" />
            </div>
          </template>
        </template>
        <div v-if="!flat.length" class="empty" role="presentation">{{ t('ui.select.empty') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Control box: visible resting border + filled background, hover, focus ring, error, disabled. */
.ui-select {
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
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--tilw-space-4);
  block-size: var(--ui-h);
  padding-inline-end: calc(var(--ui-pad) - 4px);
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.box:hover {
  border-color: var(--tilw-text-muted);
}
.box:focus-within,
.is-open .box {
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
  margin-inline-start: var(--ui-pad);
  margin-inline-end: calc(-1 * var(--ui-pad) + 8px);
  color: var(--tilw-text-muted);
}
.trigger {
  flex: 1;
  min-inline-size: 0;
  block-size: 100%;
  padding-inline: var(--ui-pad) 0;
  border: 0;
  background: none;
  color: inherit;
  font: var(--ui-font);
  text-align: start;
  cursor: pointer;
  outline: none;
}
.trigger:disabled {
  cursor: not-allowed;
}
.value,
.placeholder {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.placeholder {
  color: var(--tilw-text-muted);
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
.clear:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
.chev {
  flex: 0 0 auto;
  color: var(--tilw-text-muted);
  pointer-events: none;
  transition: transform 0.15s;
}
.is-open .chev {
  transform: rotate(180deg);
}
.msg {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}

/* Popup (top layer via the Popover API; position set by useAnchoredPopover). */
.ui-select-pop {
  box-sizing: border-box;
  max-inline-size: min(420px, calc(100vw - 16px));
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  box-shadow: var(--tilw-shadow-pop);
}
.group + .group,
.opt + .group {
  margin-block-start: 4px;
  padding-block-start: 4px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.group-label {
  padding: 6px 10px 2px;
  color: var(--tilw-text-muted);
  font: 600 12px/1.4 var(--tilw-font-ar);
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
  background: var(--tilw-surface-quiet);
}
.opt[aria-selected='true'] {
  background: var(--tilw-surface-selected);
  font-weight: 600;
}
.opt[aria-disabled='true'] {
  color: var(--tilw-text-muted);
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
}
.opt-check {
  color: var(--tilw-action-primary);
}
.empty {
  padding: 8px 10px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-meta);
}
</style>
