<script setup lang="ts">
/**
 * A menu button with a dropdown anchored to it (WAI-ARIA menu button): the trigger toggles a `role="menu"` list of
 * `menuitem`s. Opening focuses the first item; ↑/↓ move (wrapping), Home/End jump, Esc closes and returns focus to
 * the trigger, Tab or a click outside closes. It opens below and to the inline end of the trigger, and upward when
 * there isn't room below.
 */
import type { GlyphName } from './UiGlyph.vue'

export interface UiMenuItem {
  key: string
  label: string
  icon?: GlyphName
  disabled?: boolean
  tone?: 'danger'
}

const props = withDefaults(defineProps<{
  items: UiMenuItem[]
  /** Accessible name of the trigger (it shows only an icon). */
  label: string
  icon?: GlyphName
  /** Class for the trigger button, so the host styles it. */
  triggerClass?: string
}>(), { icon: 'more', triggerClass: undefined })
const emit = defineEmits<{ select: [key: string] }>()

const id = useId()
const open = ref(false)
const up = ref(false)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLElement>()

const enabled = () => [...(list.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
function focusAt(i: number) {
  const els = enabled()
  if (els.length) els[(i + els.length) % els.length]!.focus()
}

async function show(focus: 'first' | 'last' = 'first') {
  up.value = false
  open.value = true
  await nextTick()
  const r = list.value?.getBoundingClientRect()
  const t = trigger.value?.getBoundingClientRect()
  // Flip upward when the list would run past the bottom and there is more room above.
  if (r && t && r.bottom > window.innerHeight - 8 && t.top > window.innerHeight - t.bottom) up.value = true
  focusAt(focus === 'first' ? 0 : -1)
}
function hide(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}
const toggle = () => (open.value ? hide() : show())

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    void show(e.key === 'ArrowDown' ? 'first' : 'last')
  }
}
function onListKey(e: KeyboardEvent) {
  const els = enabled()
  const i = els.indexOf(document.activeElement as HTMLElement)
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); focusAt(i + 1); break
    case 'ArrowUp': e.preventDefault(); focusAt(i - 1); break
    case 'Home': e.preventDefault(); focusAt(0); break
    case 'End': e.preventDefault(); focusAt(-1); break
    case 'Escape': e.preventDefault(); e.stopPropagation(); hide(); break
    case 'Tab': hide(false); break
  }
}
function choose(item: UiMenuItem) {
  if (item.disabled) return
  hide()
  emit('select', item.key)
}

onClickOutside(root, () => hide(false))
// A scroll or resize would leave the list floating away from its row.
useEventListener('resize', () => hide(false))
</script>

<template>
  <span ref="root" class="ui-menu" :class="{ open }">
    <button
      :id="`${id}-btn`"
      ref="trigger"
      type="button"
      :class="triggerClass"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? `${id}-menu` : undefined"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <UiGlyph :name="icon" :size="20" />
    </button>
    <ul
      v-if="open"
      :id="`${id}-menu`"
      ref="list"
      class="list"
      :class="{ up }"
      role="menu"
      :aria-labelledby="`${id}-btn`"
      @keydown="onListKey"
    >
      <li v-for="item in items" :key="item.key" role="none">
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          :class="item.tone"
          :disabled="item.disabled"
          :data-key="item.key"
          @click="choose(item)"
        >
          <UiGlyph v-if="item.icon" :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </span>
</template>

<style scoped>
.ui-menu {
  position: relative;
  display: inline-flex;
}
.ui-menu.open {
  z-index: 30;
}
.list {
  position: absolute;
  inset-block-start: calc(100% + 4px);
  inset-inline-end: 0;
  z-index: 30;
  display: grid;
  gap: 2px;
  min-inline-size: 220px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
}
.list.up {
  inset-block-start: auto;
  inset-block-end: calc(100% + 4px);
}
.list button {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: 100%;
  min-block-size: var(--tilw-hit);
  padding-inline: 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-ink);
  font: 500 15px/1.36 var(--tilw-font-ar);
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
}
.list button :deep(.ui-glyph) {
  color: var(--tilw-text-muted);
}
.list button:hover,
.list button:focus-visible {
  background: var(--tilw-surface-quiet);
  outline: none;
}
.list button:focus-visible {
  box-shadow: inset 0 0 0 2px var(--tilw-focus-ring);
}
.list button.danger,
.list button.danger :deep(.ui-glyph) {
  color: var(--tilw-status-error);
}
.list button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (prefers-reduced-motion: no-preference) {
  .list {
    animation: ui-menu-in 0.12s ease-out;
  }
  @keyframes ui-menu-in {
    from { opacity: 0; transform: translateY(-4px); }
  }
  .list.up {
    animation-name: ui-menu-in-up;
  }
  @keyframes ui-menu-in-up {
    from { opacity: 0; transform: translateY(4px); }
  }
}
</style>
