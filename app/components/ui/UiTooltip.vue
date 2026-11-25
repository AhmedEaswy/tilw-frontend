<script setup lang="ts">
/**
 * A short explanation next to a control (gaps G-A5: why Dictate is disabled). Shows on hover, on keyboard focus and on
 * tap (phones have no hover); Esc, leaving, blur or a tap elsewhere hides it. The trigger gets the tooltip's id through
 * the slot (`describedby`) for `aria-describedby`, so screen readers read it with the control.
 *
 * Put it around a focusable trigger. For a "disabled" control that should still explain itself, use
 * `aria-disabled="true"` instead of `disabled`: a disabled button can't take focus or taps.
 */
import { ref, useId } from 'vue'
import { useAnchoredPopover } from '~/composables/useAnchoredPopover'

defineProps<{ text: string }>()
const id = useId()
const root = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const { open, show, hide } = useAnchoredPopover(root, root, pop, { matchWidth: false, gap: 6 })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    hide()
  }
}
function toggle() {
  if (open.value) hide()
  else void show()
}
</script>

<template>
  <span
    ref="root"
    class="ui-tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @keydown="onKey"
    @click="toggle"
  >
    <slot :describedby="id" />
    <span :id="id" ref="pop" role="tooltip" popover="manual" class="tip" :class="{ on: open }" data-testid="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped>
.ui-tooltip {
  display: block;
  position: relative;
}
.tip {
  display: none;
  max-inline-size: min(280px, calc(100vw - 16px));
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: var(--tilw-text-ink);
  color: var(--tilw-surface-white);
  font: 400 13.5px/1.6 var(--tilw-font-ar);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
  pointer-events: none;
  z-index: 50;
}
.tip.on {
  display: block;
}
</style>
