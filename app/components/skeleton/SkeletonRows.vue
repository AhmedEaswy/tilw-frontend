<script setup lang="ts">
/**
 * Placeholder list rows in the shape of the real ones: a leading mark, a title line, a meta line and a trailing
 * action. Title widths vary row to row (a fixed cycle, so it never jumps between renders) to read like text.
 *
 * - `variant`: `plain` — bare rows with a hairline between them (the library's ScriptRow);
 *   `card` — each row its own rounded surface (settings lists, phone links, devices, phone recordings);
 *   `divided` — rows inside one rounded surface, split by hairlines (credit entries).
 * - `height`: the real row's min block size, so nothing moves when the rows arrive.
 * - `lead`: `square` (a cover), `circle` (an avatar), `icon` (a small glyph) or `none`; `leadSize` sets it.
 * - `trail`: `menu` (a round options button), `text` (a link like "End"), `amount` (a short figure) or `none`.
 * - `meta`: show the second, muted line.
 */
import { computed } from 'vue'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'

const props = withDefaults(defineProps<{
  count?: number
  variant?: 'plain' | 'card' | 'divided'
  height?: string
  gap?: string
  lead?: 'none' | 'square' | 'circle' | 'icon'
  leadSize?: string
  titleH?: string
  metaH?: string
  meta?: boolean
  trail?: 'none' | 'menu' | 'text' | 'amount'
}>(), {
  count: 3,
  variant: 'card',
  height: '72px',
  gap: '',
  lead: 'none',
  leadSize: '',
  titleH: '18px',
  metaH: '13px',
  meta: true,
  trail: 'none',
})

const TITLE_W = ['58%', '44%', '67%', '51%', '62%', '39%']
const META_W = ['34%', '41%', '28%', '37%', '31%', '44%']
const rows = computed(() => Array.from({ length: Math.max(0, props.count) }, (_, i) => ({
  title: TITLE_W[i % TITLE_W.length]!,
  meta: META_W[i % META_W.length]!,
})))
const leadPx = computed(() => props.leadSize || (props.lead === 'circle' ? '44px' : props.lead === 'icon' ? '22px' : '43px'))
const gapPx = computed(() => props.gap || (props.variant === 'plain' ? '4px' : props.variant === 'divided' ? '0px' : '10px'))
</script>

<template>
  <div class="sk-rows" :class="`v-${variant}`" :style="{ gap: gapPx }" aria-hidden="true">
    <div v-for="(r, i) in rows" :key="i" class="sk-row" :style="{ minBlockSize: height }" data-skeleton-row>
      <UiSkeleton
        v-if="lead !== 'none'"
        class="lead"
        :h="leadPx"
        :w="leadPx"
        :r="lead === 'circle' ? '50%' : lead === 'icon' ? '5px' : '6px'"
      />
      <span class="txt">
        <UiSkeleton :h="titleH" :w="r.title" />
        <UiSkeleton v-if="meta" :h="metaH" :w="r.meta" r="4px" />
      </span>
      <UiSkeleton v-if="trail === 'menu'" class="trail menu" h="6px" w="22px" r="3px" />
      <UiSkeleton v-else-if="trail === 'text'" class="trail" h="15px" w="52px" r="4px" />
      <UiSkeleton v-else-if="trail === 'amount'" class="trail" h="18px" w="44px" r="4px" />
    </div>
  </div>
</template>

<style scoped>
.sk-rows {
  display: grid;
}
.sk-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
}
.txt {
  display: grid;
  flex: 1;
  gap: 8px;
  min-inline-size: 0;
}
.trail.menu {
  margin-inline: 11px 19px;
}
/* plain: the library's rows (ScriptRow: 76px, 43px cover, 17px gap, hairline under each). */
.v-plain .sk-row {
  gap: 17px;
  padding-block: 15px;
  padding-inline: 19px 8px;
}
.v-plain .sk-row::after {
  content: '';
  position: absolute;
  inset-inline: 14px;
  inset-block-end: -2px;
  block-size: 1px;
  background: var(--tilw-border-subtle);
}
.v-card .sk-row {
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.v-divided {
  padding: 8px 28px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.v-divided .sk-row {
  padding-inline: 0;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.v-divided .sk-row:last-child {
  border-block-end: 0;
}
@media (max-width: 760px) {
  .v-card .sk-row {
    padding-inline: 14px;
  }
}
</style>
