<script setup lang="ts">
/** Figma "Stepper" (5:142): exact value with keyboard-compatible decrement and increment. */
const model = defineModel<number>({ required: true })
const props = withDefaults(defineProps<{ min: number; max: number; step?: number; label: string; format?: (v: number) => string }>(), { step: 1 })
const { t } = useI18n()

const clamp = (v: number) => Math.min(props.max, Math.max(props.min, v))
const dec = () => (model.value = clamp(model.value - props.step))
const inc = () => (model.value = clamp(model.value + props.step))
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') inc()
  else if (e.key === 'ArrowDown') dec()
  else if (e.key === 'Home') model.value = props.min
  else if (e.key === 'End') model.value = props.max
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="ui-step" dir="ltr">
    <button type="button" :aria-label="t('common.decrease', { label })" :disabled="model <= min" @click="dec">−</button>
    <output
      role="spinbutton"
      tabindex="0"
      :aria-label="label"
      :aria-valuenow="model"
      :aria-valuemin="min"
      :aria-valuemax="max"
      @keydown="onKey"
    >{{ format ? format(model) : model }}</output>
    <button type="button" :aria-label="t('common.increase', { label })" :disabled="model >= max" @click="inc">+</button>
  </div>
</template>

<style scoped>
.ui-step {
  display: inline-grid;
  grid-template-columns: var(--tilw-hit) minmax(56px, auto) var(--tilw-hit);
  align-items: center;
  block-size: var(--tilw-hit);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-quiet);
}
button {
  block-size: 100%;
  border: 0;
  background: none;
  color: var(--tilw-text-muted);
  font: 500 20px/1 var(--tilw-font-lat);
  border-radius: var(--tilw-radius-field);
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
output {
  text-align: center;
  font: 500 18px/1.34 var(--tilw-font-lat);
  font-variant-numeric: tabular-nums;
  color: var(--tilw-text-ink);
  border-radius: 6px;
}
</style>
