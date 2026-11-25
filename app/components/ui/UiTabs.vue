<script setup lang="ts" generic="V extends string | number">
/**
 * Tabs (APG "tabs with automatic activation"): a tablist of buttons with roving focus, and one panel per tab.
 * ← / → follow the reading direction (↑ / ↓ when `vertical`), Home / End jump, disabled tabs are skipped; moving
 * focus selects the tab unless `manual` (then Enter / Space select).
 *
 * Panels: a named slot per tab value (`<template #general>…`), or the `#panel="{ tab }"` slot for all. A panel is
 * rendered the first time its tab is shown and then kept (v-show), so form state inside survives switching.
 * With `panels: false` only the tablist renders (e.g. tabs that drive a route or a filter): give each tab its own
 * content id through `controls` if it controls a region.
 */
import { computed, nextTick, ref, shallowReactive, useId, useSlots, watch } from 'vue'
import UiGlyph from './UiGlyph.vue'
import { rovingIndex, type UiTab } from '~/utils/uiControls'

const model = defineModel<V>({ required: true })
const props = withDefaults(
  defineProps<{
    tabs: readonly UiTab<V>[]
    /** aria-label of the tablist. */
    label: string
    variant?: 'line' | 'pills'
    size?: 'sm' | 'md'
    vertical?: boolean
    manual?: boolean
    panels?: boolean
    /** Stretch the tabs across the row. */
    stretch?: boolean
    /** id of an external region the tabs control (with `panels: false`). */
    controls?: string
  }>(),
  { variant: 'line', size: 'md', panels: true, controls: undefined },
)
const emit = defineEmits<{ change: [value: V] }>()
defineSlots<Record<string, (p: { tab: UiTab<V> }) => unknown>>()
const slots = useSlots()

const uid = useId()
const tabId = (i: number) => `${uid}-tab-${i}`
const panelId = (i: number) => `${uid}-panel-${i}`
const list = ref<HTMLElement>()
const selectedIndex = computed(() => props.tabs.findIndex(t => t.value === model.value))
const focusIndex = ref(Math.max(0, selectedIndex.value))
const visited = shallowReactive(new Set<V>([model.value]))
watch(model, (v) => {
  visited.add(v)
  focusIndex.value = Math.max(0, selectedIndex.value)
})

function select(i: number) {
  const tab = props.tabs[i]
  if (!tab || tab.disabled || tab.value === model.value) return
  model.value = tab.value
  emit('change', tab.value)
}

function onKey(e: KeyboardEvent) {
  if (props.manual && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    select(focusIndex.value)
    return
  }
  const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl'
  const i = rovingIndex(props.tabs, focusIndex.value, e.key, rtl, props.vertical)
  if (i < 0) return
  e.preventDefault()
  focusIndex.value = i
  if (!props.manual) select(i)
  void nextTick(() => list.value?.querySelectorAll<HTMLElement>('[role="tab"]')[i]?.focus())
}

function panelSlot(tab: UiTab<V>) {
  return slots[String(tab.value)] ?? slots.panel
}

defineExpose({ focus: () => list.value?.querySelectorAll<HTMLElement>('[role="tab"]')[focusIndex.value]?.focus() })
</script>

<template>
  <div class="ui-tabs" :class="[`v-${variant}`, `size-${size}`, { vertical, stretch }]">
    <div
      ref="list"
      role="tablist"
      class="list"
      :aria-label="label"
      :aria-orientation="vertical ? 'vertical' : undefined"
      @keydown="onKey"
    >
      <button
        v-for="(tab, i) in tabs"
        :id="tabId(i)"
        :key="String(tab.value)"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="i === selectedIndex ? 'true' : 'false'"
        :aria-controls="panels ? panelId(i) : controls"
        :aria-disabled="tab.disabled ? 'true' : undefined"
        :tabindex="i === focusIndex ? 0 : -1"
        @click="select(i)"
        @focus="focusIndex = i"
      >
        <UiGlyph v-if="tab.icon" :name="tab.icon" :size="size === 'sm' ? 16 : 18" />
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge !== undefined && tab.badge !== ''" class="badge">{{ tab.badge }}</span>
      </button>
    </div>
    <template v-if="panels">
      <template v-for="(tab, i) in tabs" :key="String(tab.value)">
        <div
          v-if="visited.has(tab.value)"
          v-show="i === selectedIndex"
          :id="panelId(i)"
          role="tabpanel"
          class="panel"
          :aria-labelledby="tabId(i)"
          tabindex="0"
        >
          <component :is="panelSlot(tab)" v-if="panelSlot(tab)" :tab="tab" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.ui-tabs {
  --ui-tab-h: 44px;
  --ui-tab-font: 500 15px/1.3 var(--tilw-font-ar);
  display: grid;
  gap: var(--tilw-space-16);
  min-inline-size: 0;
}
.size-sm {
  --ui-tab-h: 34px;
  --ui-tab-font: 500 13px/1.3 var(--tilw-font-ar);
}
.vertical {
  grid-template-columns: auto 1fr;
  align-items: start;
}
.list {
  display: flex;
  gap: 4px;
  min-inline-size: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.vertical .list {
  flex-direction: column;
  overflow: visible;
}
.tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  min-block-size: var(--ui-tab-h);
  padding-inline: var(--tilw-space-12);
  border: 0;
  background: none;
  color: var(--tilw-text-muted);
  font: var(--ui-tab-font);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, box-shadow 0.15s;
}
.stretch .tab {
  flex: 1 1 0;
}
.vertical .tab {
  justify-content: flex-start;
}
.tab:hover:not([aria-disabled='true']) {
  color: var(--tilw-text-ink);
}
.tab:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: -2px;
}
.tab[aria-disabled='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}
.badge {
  min-inline-size: 20px;
  padding: 2px 6px;
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  font: 600 11px/1.3 var(--tilw-font-lat);
  text-align: center;
}

/* line: underline on the selected tab, a rule under the row */
.v-line .list {
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.v-line .tab {
  border-radius: 8px 8px 0 0;
  box-shadow: inset 0 -2px 0 transparent;
}
.v-line .tab[aria-selected='true'] {
  color: var(--tilw-action-primary);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--tilw-action-primary);
}
.v-line.vertical .list {
  border-block-end: 0;
  border-inline-end: 1px solid var(--tilw-border-subtle);
}
.v-line.vertical .tab {
  border-radius: 8px;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
  box-shadow: none;
}
.v-line.vertical .tab[aria-selected='true'] {
  background: var(--tilw-surface-selected);
  box-shadow: none;
}

/* pills: a quiet track, the selected tab lifts */
.v-pills .list {
  inline-size: fit-content;
  max-inline-size: 100%;
  padding: 3px;
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-quiet);
}
.v-pills.stretch .list {
  inline-size: auto;
}
.v-pills .tab {
  min-block-size: calc(var(--ui-tab-h) - 6px);
  border-radius: 8px;
}
.v-pills .tab[aria-selected='true'] {
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.tab[aria-selected='true'] .badge {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}

.panel {
  min-inline-size: 0;
}
.panel:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 4px;
  border-radius: 4px;
}
</style>
