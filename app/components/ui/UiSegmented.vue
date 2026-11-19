<script setup lang="ts" generic="T extends string | number">
/** Figma "Reading mode" (5:119): two or more mutually exclusive options on a quiet track. */
const model = defineModel<T>({ required: true })
defineProps<{ options: { value: T; label: string }[]; label: string }>()

function onKey(e: KeyboardEvent, options: { value: T }[]) {
  const i = options.findIndex(o => o.value === model.value)
  const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl'
  const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (e.key === fwd) model.value = options[(i + 1) % options.length]!.value
  else if (e.key === back) model.value = options[(i - 1 + options.length) % options.length]!.value
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="ui-seg" role="radiogroup" :aria-label="label" @keydown="onKey($event, options)">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="radio"
      :aria-checked="o.value === model"
      :tabindex="o.value === model ? 0 : -1"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-seg {
  display: flex;
  gap: 0;
  padding: 3px;
  min-block-size: var(--tilw-hit);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-quiet);
}
button {
  flex: 1;
  min-inline-size: 0;
  padding-inline: var(--tilw-space-12);
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tilw-text-muted);
  font: 500 16px/1.34 var(--tilw-font-ar);
  transition: background-color 0.15s, color 0.15s;
}
button[aria-checked='true'] {
  background: var(--tilw-surface-white);
  color: var(--tilw-action-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
</style>
