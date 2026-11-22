<script setup lang="ts">
/**
 * Figma "Field" (5:159): idle, focus, invalid. Label above, optional hint, error message below
 * (invalid state is always paired with a message explaining how to fix it).
 */
const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'password' | 'search'
    name?: string
    placeholder?: string
    autocomplete?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    ltr?: boolean
    maxlength?: number
    autofocus?: boolean
    icon?: 'field-mail' | 'field-lock'
  }>(),
  { type: 'text' },
)

const id = useId()
const reveal = ref(false)
const inputType = computed(() => (props.type === 'password' && reveal.value ? 'text' : props.type))
const isLtr = computed(() => props.ltr ?? (props.type === 'email' || props.type === 'password'))
const { t } = useI18n()

const input = ref<HTMLInputElement>()
onMounted(() => {
  if (props.autofocus) input.value?.focus()
})
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="ui-field" :class="{ invalid: !!error, disabled }">
    <div class="top">
      <label :for="id">{{ label }}</label>
      <slot name="aside" />
    </div>
    <div class="box">
      <UiGlyph v-if="icon" :name="icon" :size="21" class="ic" />
      <input
        :id="id"
        ref="input"
        v-model="model"
        :type="inputType"
        :name="name"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :required="required"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :dir="isLtr ? 'ltr' : 'auto'"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-err` : hint ? `${id}-hint` : undefined"
      >
      <button
        v-if="type === 'password'"
        type="button"
        class="reveal"
        :aria-pressed="reveal"
        @click="reveal = !reveal"
      >
        {{ reveal ? t('common.hide') : t('common.show') }}
      </button>
    </div>
    <p v-if="error" :id="`${id}-err`" class="msg err" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="msg">{{ hint }}</p>
  </div>
</template>

<style scoped>
.ui-field {
  display: grid;
  gap: var(--tilw-space-8);
}
.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--tilw-space-12);
}
label {
  font: 500 15px/1.53 var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
.ic {
  margin-inline-start: var(--tilw-space-16);
  color: var(--tilw-text-ink);
}
.box {
  position: relative;
  display: flex;
  align-items: center;
  block-size: var(--tilw-field-h);
  background: var(--tilw-surface-white);
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-field);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.box:focus-within {
  border-color: var(--tilw-focus-ring);
  box-shadow: 0 0 0 1px var(--tilw-focus-ring);
}
.invalid .box {
  border-color: var(--tilw-status-error);
}
input {
  flex: 1;
  /* Without this the input's built-in ~20-character width becomes the form's minimum width (overflow at 320 px). */
  inline-size: 0;
  min-inline-size: 0;
  block-size: 100%;
  padding-inline: var(--tilw-space-16);
  border: 0;
  background: transparent;
  font: 500 16px/1.34 var(--tilw-font-lat);
  color: var(--tilw-text-ink);
  outline: none;
}
input[dir='auto'] {
  font-family: var(--tilw-font-ar);
}
input::placeholder {
  color: var(--tilw-text-muted);
}
input:read-only {
  color: var(--tilw-text-muted);
}
.reveal {
  flex: 0 0 auto;
  block-size: 100%;
  padding-inline: var(--tilw-space-16);
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: var(--tilw-type-meta);
}
.msg {
  font: var(--tilw-type-meta);
  color: var(--tilw-text-muted);
}
.msg.err {
  color: var(--tilw-status-error);
}
.disabled {
  opacity: 0.6;
}
</style>
