<script setup lang="ts">
/**
 * One checkbox with its label (and optional description). A real <input type="checkbox"> drawn over by a styled
 * box, so Space, forms, <label> clicks and screen readers behave natively. `indeterminate` shows a dash (e.g. a
 * "select all" with some rows chosen).
 */
import { computed, ref, useId } from 'vue'
import UiGlyph from './UiGlyph.vue'

const model = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    label?: string
    description?: string
    indeterminate?: boolean
    disabled?: boolean
    error?: boolean | string
    size?: 'sm' | 'md'
    name?: string
    value?: string
    required?: boolean
    id?: string
  }>(),
  { label: undefined, description: undefined, error: false, size: 'md', name: undefined, value: undefined, id: undefined },
)
const emit = defineEmits<{ change: [checked: boolean] }>()

const uid = useId()
const inputId = computed(() => props.id ?? `${uid}-input`)
const descId = `${uid}-desc`
const errId = `${uid}-err`
const input = ref<HTMLInputElement>()
const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.description ? descId : '', errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)

function onChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  model.value = checked
  emit('change', checked)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="ui-checkbox" :class="[`size-${size}`, { invalid, disabled, checked: model, mixed: indeterminate }]">
    <span class="control">
      <input
        :id="inputId"
        ref="input"
        class="native"
        type="checkbox"
        :checked="model"
        :indeterminate="indeterminate"
        :disabled="disabled"
        :name="name"
        :value="value"
        :required="required"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="describedby"
        @change="onChange"
      >
      <span class="box" aria-hidden="true">
        <span v-if="indeterminate" class="dash" />
        <UiGlyph v-else-if="model" name="check" :size="size === 'sm' ? 14 : 16" />
      </span>
    </span>
    <span v-if="label || $slots.default || description" class="text">
      <label :for="inputId" class="label"><slot>{{ label }}</slot></label>
      <span v-if="description" :id="descId" class="desc">{{ description }}</span>
      <span v-if="errorText" :id="errId" class="err">{{ errorText }}</span>
    </span>
  </div>
</template>

<style scoped>
.ui-checkbox {
  --ui-box: 20px;
  --ui-font: 500 15px/1.4 var(--tilw-font-ar);
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
  min-inline-size: 0;
  color: var(--tilw-text-ink);
}
.size-sm {
  --ui-box: 16px;
  --ui-font: 500 13px/1.4 var(--tilw-font-ar);
  gap: 8px;
}
.control {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
  inline-size: var(--ui-box);
  block-size: var(--ui-box);
  /* line the box up with the first text line */
  margin-block-start: calc((1.4em - var(--ui-box)) / 2);
  font: var(--ui-font);
}
.native {
  position: absolute;
  inset: -6px;
  inline-size: calc(100% + 12px);
  block-size: calc(100% + 12px);
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.box {
  display: grid;
  place-items: center;
  border: 1.5px solid var(--tilw-border-strong);
  border-radius: 5px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-on-solid);
  pointer-events: none;
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.control:hover .box {
  border-color: var(--tilw-text-muted);
}
.native:focus-visible + .box {
  box-shadow: 0 0 0 2px var(--tilw-surface-paper), 0 0 0 4px var(--tilw-focus-ring);
}
.checked .box,
.mixed .box {
  border-color: var(--tilw-action-solid);
  background: var(--tilw-action-solid);
}
.dash {
  inline-size: 55%;
  block-size: 2px;
  border-radius: 1px;
  background: currentColor;
}
.invalid .box {
  border-color: var(--tilw-status-error);
}
.disabled .box {
  border-color: var(--tilw-border-subtle);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
}
.disabled.checked .box,
.disabled.mixed .box {
  background: var(--tilw-border-strong);
  border-color: var(--tilw-border-strong);
  color: var(--tilw-surface-white);
}
.disabled .native {
  cursor: not-allowed;
}
.text {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}
.label {
  font: var(--ui-font);
  cursor: pointer;
}
.disabled .label {
  color: var(--tilw-text-muted);
  cursor: not-allowed;
}
.desc {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-caption);
}
.err {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}
</style>
