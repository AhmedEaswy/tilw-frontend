<script setup lang="ts" generic="V extends string | number, M extends boolean = false">
/**
 * A group of choices in a <fieldset>: radios (one value) or, with `multiple`, checkboxes (an array). Drawn as a
 * plain list (`variant="list"`, vertical or horizontal) or as selectable cards (`variant="cards"`, a responsive grid
 * with label, hint and icon). Native inputs, so arrows move between radios (in the reading direction), Space
 * toggles checkboxes and forms see the values. `selectAll` (multiple) adds a tri-state "select all".
 */
import { computed, ref, useId, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiGlyph from './UiGlyph.vue'
import UiCheckbox from './UiCheckbox.vue'
import type { UiOption } from '~/utils/uiControls'

type Model = M extends true ? V[] : V | null

const model = defineModel<Model>()
const props = withDefaults(
  defineProps<{
    options: readonly UiOption<V>[]
    multiple?: M
    variant?: 'list' | 'cards'
    /** Visible group label (<legend>). */
    legend?: string
    /** aria-label when there is no visible legend. */
    label?: string
    /** Text under the legend. */
    hint?: string
    orientation?: 'vertical' | 'horizontal'
    /** Cards: minimum card width before the grid wraps (CSS length). */
    minCardWidth?: string
    selectAll?: boolean
    disabled?: boolean
    error?: boolean | string
    size?: 'sm' | 'md'
    name?: string
    required?: boolean
  }>(),
  {
    multiple: undefined,
    variant: 'list',
    legend: undefined,
    label: undefined,
    hint: undefined,
    orientation: 'vertical',
    minCardWidth: '200px',
    error: false,
    size: 'md',
    name: undefined,
  },
)
const emit = defineEmits<{ change: [value: Model] }>()
defineSlots<{ option?: (p: { option: UiOption<V>; checked: boolean }) => unknown }>()

const { t } = useI18n()
const uid = useId()
const groupName = computed(() => props.name ?? `${uid}-choice`)
const hintId = `${uid}-hint`
const errId = `${uid}-err`
const root = ref<HTMLFieldSetElement>()

// Generic props aren't boolean-cast by Vue: a bare `multiple` attribute arrives as ''.
const isMulti = computed(() => props.multiple !== undefined && props.multiple !== null && (props.multiple as unknown) !== false)
const raw = computed(() => model.value as unknown as V | V[] | null | undefined)
const values = computed<V[]>(() => {
  const v = raw.value
  if (isMulti.value) return Array.isArray(v) ? v : []
  return v === null || v === undefined || Array.isArray(v) ? [] : [v]
})
function setModel(v: V | V[] | null) {
  ;(model as unknown as Ref<unknown>).value = v
  emit('change', v as Model)
}

const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.hint ? hintId : '', errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)
const enabled = computed(() => props.options.filter(o => !o.disabled))
const allChecked = computed(() => enabled.value.length > 0 && enabled.value.every(o => values.value.includes(o.value)))
const someChecked = computed(() => !allChecked.value && enabled.value.some(o => values.value.includes(o.value)))

const isChecked = (o: UiOption<V>) => values.value.includes(o.value)

/** Values in the options' order, then any values the options don't list (kept, never dropped). */
function ordered(set: Set<V>): V[] {
  const known = props.options.map(o => o.value)
  return [...known.filter(v => set.has(v)), ...[...set].filter(v => !known.includes(v))]
}

function onChange(o: UiOption<V>, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (!isMulti.value) {
    if (checked) setModel(o.value)
    return
  }
  const set = new Set(values.value)
  if (checked) set.add(o.value)
  else set.delete(o.value)
  setModel(ordered(set))
}

/** Select all / none of the enabled options; disabled ones keep their state. */
function toggleAll(on: boolean) {
  const set = new Set(values.value)
  for (const o of enabled.value) {
    if (on) set.add(o.value)
    else set.delete(o.value)
  }
  setModel(ordered(set))
}

defineExpose({ focus: () => root.value?.querySelector<HTMLInputElement>('input.native:checked:not(:disabled), input.native:not(:disabled)')?.focus() })
</script>

<template>
  <fieldset
    ref="root"
    class="ui-choice"
    :class="[`v-${variant}`, `size-${size}`, `o-${orientation}`, { invalid, disabled, multi: isMulti }]"
    :disabled="disabled"
    :aria-label="legend ? undefined : label"
    :aria-describedby="describedby"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-required="!isMulti && required ? 'true' : undefined"
  >
    <legend v-if="legend" class="legend">{{ legend }}</legend>
    <p v-if="hint" :id="hintId" class="hint">{{ hint }}</p>
    <UiCheckbox
      v-if="isMulti && selectAll"
      class="all"
      :model-value="allChecked"
      :indeterminate="someChecked"
      :label="t('ui.choice.selectAll')"
      :size="size"
      :disabled="disabled || !enabled.length"
      @update:model-value="toggleAll"
    />
    <div class="items" :style="variant === 'cards' ? { '--ui-card-min': minCardWidth } : undefined">
      <label
        v-for="o in options"
        :key="String(o.value)"
        class="item"
        :class="{ checked: isChecked(o), 'is-disabled': o.disabled }"
      >
        <input
          class="native"
          :type="isMulti ? 'checkbox' : 'radio'"
          :name="groupName"
          :value="String(o.value)"
          :checked="isChecked(o)"
          :disabled="disabled || o.disabled"
          :required="!isMulti && required"
          @change="onChange(o, $event)"
        >
        <span class="mark" :class="isMulti ? 'box' : 'dot'" aria-hidden="true">
          <UiGlyph v-if="isMulti && isChecked(o)" name="check" :size="size === 'sm' ? 12 : 14" />
        </span>
        <UiGlyph v-if="o.icon" :name="o.icon" :size="variant === 'cards' ? 24 : 18" class="icon" />
        <span class="body">
          <slot name="option" :option="o" :checked="isChecked(o)">
            <span class="lbl">{{ o.label }}</span>
            <span v-if="o.hint" class="opt-hint">{{ o.hint }}</span>
          </slot>
        </span>
      </label>
    </div>
    <p v-if="errorText" :id="errId" class="err">{{ errorText }}</p>
  </fieldset>
</template>

<style scoped>
.ui-choice {
  --ui-mark: 20px;
  --ui-font: 500 15px/1.4 var(--tilw-font-ar);
  display: grid;
  gap: var(--tilw-space-8);
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--tilw-text-ink);
}
.size-sm {
  --ui-mark: 16px;
  --ui-font: 500 13px/1.4 var(--tilw-font-ar);
}
.legend {
  margin-block-end: 2px;
  padding: 0;
  font: 600 14px/1.4 var(--tilw-font-ar);
}
.hint {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-caption);
}
.err {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}
.items {
  display: grid;
  gap: var(--tilw-space-8);
}
.v-list.o-horizontal .items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tilw-space-8) var(--tilw-space-24);
}
.v-cards .items {
  grid-template-columns: repeat(auto-fill, minmax(min(var(--ui-card-min), 100%), 1fr));
  gap: var(--tilw-space-12);
}

.item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-inline-size: 0;
  font: var(--ui-font);
  cursor: pointer;
}
.item.is-disabled,
.disabled .item {
  color: var(--tilw-text-muted);
  cursor: not-allowed;
}
.native {
  position: absolute;
  inline-size: var(--ui-mark);
  block-size: var(--ui-mark);
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.mark {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  inline-size: var(--ui-mark);
  block-size: var(--ui-mark);
  margin-block-start: calc((1.4em - var(--ui-mark)) / 2);
  box-sizing: border-box;
  border: 1.5px solid var(--tilw-border-strong);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-on-solid);
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.box {
  border-radius: 5px;
}
.dot {
  border-radius: 50%;
}
.item:hover:not(.is-disabled) .mark {
  border-color: var(--tilw-text-muted);
}
.checked .box {
  border-color: var(--tilw-action-solid);
  background: var(--tilw-action-solid);
}
.checked .dot {
  border-color: var(--tilw-action-solid);
  background: radial-gradient(circle, var(--tilw-action-solid) 0 40%, var(--tilw-surface-white) 45%);
}
.item:has(.native:focus-visible) .mark {
  box-shadow: 0 0 0 2px var(--tilw-surface-paper), 0 0 0 4px var(--tilw-focus-ring);
}
.invalid .mark {
  border-color: var(--tilw-status-error);
}
.is-disabled .mark,
.disabled .mark {
  border-color: var(--tilw-border-subtle);
  background: var(--tilw-surface-quiet);
}
.is-disabled.checked .box,
.disabled .checked .box {
  border-color: var(--tilw-border-strong);
  background: var(--tilw-border-strong);
}
.icon {
  margin-block-start: calc((1.4em - 18px) / 2);
  color: var(--tilw-text-muted);
}
.body {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}
.opt-hint {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-caption);
}

/* cards: the whole card is the target; the mark sits in the top inline-end corner */
.v-cards .item {
  flex-direction: column;
  gap: var(--tilw-space-8);
  padding: var(--tilw-space-16);
  padding-inline-end: calc(var(--tilw-space-16) + var(--ui-mark) + 8px);
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-surface-white);
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}
.v-cards .item:hover:not(.is-disabled) {
  border-color: var(--tilw-text-muted);
}
.v-cards .item.checked {
  border-color: var(--tilw-action-solid);
  background: var(--tilw-surface-selected);
  box-shadow: 0 0 0 1px var(--tilw-action-solid);
}
.v-cards .item:has(.native:focus-visible) {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.v-cards .item:has(.native:focus-visible) .mark {
  box-shadow: none;
}
.v-cards .mark,
.v-cards .native {
  position: absolute;
  inset-block-start: var(--tilw-space-16);
  inset-inline-end: var(--tilw-space-16);
  margin: 0;
}
.v-cards .icon {
  margin: 0;
  color: var(--tilw-action-primary);
}
.v-cards .lbl {
  font-weight: 600;
}
.v-cards .item.is-disabled,
.disabled.v-cards .item {
  border-color: var(--tilw-border-subtle);
  background: var(--tilw-surface-quiet);
  opacity: 0.7;
}
.invalid.v-cards .item:not(.checked) {
  border-color: var(--tilw-status-error);
}
.all {
  padding-block-end: var(--tilw-space-8);
  border-block-end: 1px solid var(--tilw-border-subtle);
}
</style>
