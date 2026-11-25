<script setup lang="ts">
/**
 * A labelled on/off setting: <input type="checkbox" role="switch"> drawn as a switch, with a visible label,
 * optional description, disabled and `busy` (while a save is in flight: aria-busy, and clicks are ignored).
 * The switch sits at the inline end by default (settings rows); `labelPosition="end"` puts it first.
 * `hideLabel` keeps the label for screen readers only (e.g. a switch in a table cell).
 *
 * (UiSwitch is the older bare switch used by the studio; prefer this one for forms and admin screens.)
 */
import { computed, ref, useId } from 'vue'

const model = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    disabled?: boolean
    busy?: boolean
    size?: 'sm' | 'md'
    labelPosition?: 'start' | 'end'
    hideLabel?: boolean
    name?: string
    id?: string
  }>(),
  { description: undefined, size: 'md', labelPosition: 'start', name: undefined, id: undefined },
)
const emit = defineEmits<{ change: [on: boolean] }>()

const uid = useId()
const inputId = computed(() => props.id ?? `${uid}-input`)
const descId = `${uid}-desc`
const input = ref<HTMLInputElement>()

function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  if (props.busy) {
    el.checked = model.value
    return
  }
  model.value = el.checked
  emit('change', el.checked)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div
    class="ui-toggle"
    :class="[`size-${size}`, `label-${labelPosition}`, { on: model, disabled, busy, 'hide-label': hideLabel }]"
  >
    <span class="text" :class="{ 'sr-only': hideLabel }">
      <label :for="inputId" class="label">{{ label }}</label>
      <span v-if="description" :id="descId" class="desc">{{ description }}</span>
    </span>
    <span class="control">
      <input
        :id="inputId"
        ref="input"
        class="native"
        type="checkbox"
        role="switch"
        :checked="model"
        :disabled="disabled"
        :name="name"
        :aria-checked="model ? 'true' : 'false'"
        :aria-busy="busy ? 'true' : undefined"
        :aria-describedby="description ? descId : undefined"
        @change="onChange"
      >
      <span class="track" aria-hidden="true"><span class="thumb" /></span>
    </span>
  </div>
</template>

<style scoped>
.ui-toggle {
  --ui-w: 44px;
  --ui-h: 26px;
  --ui-pad: 3px;
  --ui-font: 500 15px/1.4 var(--tilw-font-ar);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tilw-space-12);
  min-inline-size: 0;
  color: var(--tilw-text-ink);
}
.size-sm {
  --ui-w: 34px;
  --ui-h: 20px;
  --ui-pad: 2px;
  --ui-font: 500 13px/1.4 var(--tilw-font-ar);
}
.label-end {
  flex-direction: row-reverse;
  justify-content: flex-end;
}
.hide-label {
  display: inline-flex;
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
.desc {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-caption);
}
.control {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
  inline-size: var(--ui-w);
  block-size: var(--ui-h);
}
.native {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.track {
  position: relative;
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-toggle-off);
  pointer-events: none;
  transition: background-color 0.2s, box-shadow 0.15s;
}
.thumb {
  position: absolute;
  inset-block-start: var(--ui-pad);
  inset-inline-start: var(--ui-pad);
  inline-size: calc(var(--ui-h) - 2 * var(--ui-pad));
  block-size: calc(var(--ui-h) - 2 * var(--ui-pad));
  border-radius: 50%;
  background: var(--tilw-toggle-knob-off);
  box-shadow: var(--tilw-toggle-knob-shadow);
  transition: inset-inline-start 0.2s, background-color 0.2s;
}
.on .track {
  background: var(--tilw-action-solid);
}
.on .thumb {
  background: var(--tilw-text-on-solid);
  inset-inline-start: calc(var(--ui-w) - var(--ui-h) + var(--ui-pad));
}
.control:hover .track {
  filter: brightness(1.08);
}
.native:focus-visible + .track {
  box-shadow: 0 0 0 2px var(--tilw-surface-paper), 0 0 0 4px var(--tilw-focus-ring);
}
.busy .track {
  opacity: 0.6;
}
.busy .native {
  cursor: progress;
}
.disabled .track {
  background: var(--tilw-border-subtle);
}
.disabled.on .track {
  background: var(--tilw-border-strong);
}
.disabled .native,
.disabled .label {
  cursor: not-allowed;
}
.disabled .label {
  color: var(--tilw-text-muted);
}
@media (prefers-reduced-motion: reduce) {
  .thumb,
  .track {
    transition: none;
  }
}
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
