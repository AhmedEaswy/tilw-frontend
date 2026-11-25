<script setup lang="ts">
/**
 * Search input with a leading icon inside the box and a trailing clear button. `update:modelValue` is debounced
 * (`debounce` ms, 0 = every keystroke); Enter and the clear button update at once and emit `search`. Esc clears
 * the text when there is any (without closing a surrounding dialog).
 *
 * `kind` sets the hint icon and input behaviour: text (search glyph), email (mail glyph, LTR, email keyboard),
 * id (hash glyph, LTR, no spellcheck).
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiGlyph, { type GlyphName } from './UiGlyph.vue'

const model = defineModel<string>({ default: '' })
const props = withDefaults(
  defineProps<{
    kind?: 'text' | 'email' | 'id'
    /** ms before `update:modelValue` after the last keystroke (default 300). */
    debounce?: number
    placeholder?: string
    size?: 'sm' | 'md'
    disabled?: boolean
    error?: boolean | string
    id?: string
    /** aria-label when there is no visible label (defaults to the placeholder text). */
    label?: string
    ariaDescribedby?: string
    name?: string
    autofocus?: boolean
  }>(),
  { kind: 'text', debounce: 300, size: 'md', placeholder: undefined, error: false, id: undefined, label: undefined, ariaDescribedby: undefined, name: undefined },
)
const emit = defineEmits<{ search: [value: string]; clear: [] }>()

const { t } = useI18n()
const uid = useId()
const inputId = computed(() => props.id ?? `${uid}-input`)
const errId = `${uid}-err`
const input = ref<HTMLInputElement>()
const text = ref(model.value)
let timer: ReturnType<typeof setTimeout> | null = null

const ICON: Record<'text' | 'email' | 'id', GlyphName> = { text: 'search', email: 'field-mail', id: 'hash' }
const icon = computed(() => ICON[props.kind])
const ltr = computed(() => props.kind !== 'text')
const placeholderText = computed(() => props.placeholder ?? t(`ui.search.placeholder.${props.kind}`))
const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.ariaDescribedby, errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)

watch(model, (v) => {
  if (v !== text.value) {
    if (timer) clearTimeout(timer)
    timer = null
    text.value = v
  }
})

function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (model.value !== text.value) model.value = text.value
}

function onInput(e: Event) {
  text.value = (e.target as HTMLInputElement).value
  if (timer) clearTimeout(timer)
  if (props.debounce <= 0) flush()
  else timer = setTimeout(flush, props.debounce)
}

function clear() {
  text.value = ''
  flush()
  emit('clear')
  emit('search', '')
  input.value?.focus()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    flush()
    emit('search', text.value)
  } else if (e.key === 'Escape' && text.value) {
    e.preventDefault()
    e.stopPropagation()
    clear()
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

defineExpose({ focus: () => input.value?.focus(), flush })
</script>

<template>
  <div class="ui-search" :class="[`size-${size}`, { invalid, disabled }]">
    <div class="box">
      <UiGlyph :name="icon" :size="size === 'sm' ? 16 : 20" class="lead" />
      <input
        :id="inputId"
        ref="input"
        class="input"
        type="search"
        :name="name"
        :value="text"
        :disabled="disabled"
        :autofocus="autofocus"
        :placeholder="placeholderText"
        :dir="ltr ? 'ltr' : undefined"
        :inputmode="kind === 'email' ? 'email' : 'search'"
        :spellcheck="kind === 'text' ? undefined : 'false'"
        autocomplete="off"
        enterkeyhint="search"
        :aria-label="label ?? (id ? undefined : placeholderText)"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="describedby"
        @input="onInput"
        @keydown="onKey"
        @blur="flush"
      >
      <button
        v-if="text && !disabled"
        type="button"
        class="clear"
        :aria-label="t('ui.search.clear')"
        @click="clear"
      >
        <UiGlyph name="close" :size="16" />
      </button>
    </div>
    <p v-if="errorText" :id="errId" class="msg">{{ errorText }}</p>
  </div>
</template>

<style scoped>
.ui-search {
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
  align-items: center;
  gap: 8px;
  block-size: var(--ui-h);
  padding-inline: var(--ui-pad) calc(var(--ui-pad) - 8px);
  box-sizing: border-box;
  border: 1px solid var(--tilw-control-edge);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-control-fill);
  color: var(--tilw-text-ink);
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.12s;
}
.box:hover {
  border-color: var(--tilw-control-edge-hover);
  background: var(--tilw-control-fill-hover);
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
  border-color: var(--tilw-control-edge-disabled);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  cursor: not-allowed;
}
.lead {
  color: var(--tilw-text-muted);
}
.input {
  flex: 1;
  inline-size: 0;
  min-inline-size: 0;
  block-size: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: var(--ui-font);
  outline: none;
  appearance: none;
}
.input[dir='ltr'] {
  font-family: var(--tilw-font-lat);
}
/* An LTR field (email, id) still shows its Arabic placeholder from the reading side. */
.input[dir='ltr']:placeholder-shown {
  direction: inherit;
  font-family: var(--tilw-font-ar);
}
.input::-webkit-search-cancel-button,
.input::-webkit-search-decoration {
  appearance: none;
}
.input::placeholder {
  color: var(--tilw-text-muted);
}
.input:disabled {
  cursor: not-allowed;
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
.msg {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}
</style>
