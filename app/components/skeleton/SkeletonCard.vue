<script setup lang="ts">
/**
 * A placeholder card built from the parts the app's cards share, top to bottom:
 *   media (a cover or photo) → head (an icon beside the title) or kicker + title → text lines → label/value pairs →
 *   the default slot (anything page-specific) → action buttons.
 * Set the same padding / radius / tone as the real card so the swap does not move anything.
 *
 * - `tone`: `paper` (surface-white), `stage` (the dark plan / last-opened cards), `none` (no surface: a bare section).
 * - `media` / `mediaInset`: block height of the cover; inset keeps it inside the padding with its own corners.
 * - `icon`: size of a leading logo beside the title (LinkCard's Drive mark); empty for none.
 * - `kicker`, `title` (line height of the heading, empty for none), `titleW`.
 * - `lines` / `lineH`: muted body lines; `pairs`: label ↔ value rows (credits, stats).
 * - `actions`: button count; `actionsLayout`: `start` (one auto-width button), `row` (side by side), `stack` (full width).
 */
import { computed } from 'vue'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'

const props = withDefaults(defineProps<{
  tone?: 'paper' | 'stage' | 'none'
  media?: string
  mediaInset?: boolean
  icon?: string
  kicker?: boolean
  title?: string
  titleW?: string
  lines?: number
  lineH?: string
  pairs?: number
  actions?: number
  actionsLayout?: 'start' | 'row' | 'stack'
  padding?: string
  radius?: string
  gap?: string
  minH?: string
}>(), {
  tone: 'paper',
  media: '',
  mediaInset: false,
  icon: '',
  kicker: false,
  title: '28px',
  titleW: '55%',
  lines: 2,
  lineH: '15px',
  pairs: 0,
  actions: 0,
  actionsLayout: 'start',
  padding: '24px 27px',
  radius: '12px',
  gap: '14px',
  minH: '',
})

const shade = computed(() => (props.tone === 'stage' ? 'stage' : 'paper'))
const LINE_W = ['92%', '78%', '85%', '64%', '88%', '71%']
const lineW = (i: number) => (i === props.lines - 1 && props.lines > 1 ? '48%' : LINE_W[i % LINE_W.length]!)
const PAIR_W = ['38%', '30%', '34%', '27%']
</script>

<template>
  <div
    class="sk-card"
    :class="[`card-${tone}`, { flush: media && !mediaInset }]"
    :style="{ padding: media && !mediaInset ? '0' : padding, borderRadius: radius, minBlockSize: minH || undefined }"
    aria-hidden="true"
    data-skeleton-card
  >
    <UiSkeleton v-if="media" class="media" :tone="shade" :h="media" :r="mediaInset ? '9px' : '0'" />
    <div class="body" :style="{ padding: media && !mediaInset ? padding : '0', gap }">
      <div v-if="icon" class="head">
        <UiSkeleton :tone="shade" :h="icon" :w="icon" r="14px" />
        <span class="head-txt">
          <UiSkeleton :tone="shade" :h="title || '22px'" :w="titleW" />
          <UiSkeleton :tone="shade" h="14px" w="70%" r="4px" />
        </span>
      </div>
      <template v-else>
        <UiSkeleton v-if="kicker" :tone="shade" h="15px" w="32%" r="4px" />
        <UiSkeleton v-if="title" :tone="shade" :h="title" :w="titleW" />
      </template>
      <UiSkeleton v-for="i in lines" :key="`l${i}`" :tone="shade" :h="lineH" :w="lineW(i - 1)" r="4px" />
      <div v-for="i in pairs" :key="`p${i}`" class="pair">
        <UiSkeleton :tone="shade" h="14px" :w="PAIR_W[(i - 1) % PAIR_W.length]" r="4px" />
        <UiSkeleton :tone="shade" h="16px" w="22%" r="4px" />
      </div>
      <slot :tone="shade" />
      <div v-if="actions" class="acts" :class="`a-${actionsLayout}`">
        <UiSkeleton v-for="i in actions" :key="`a${i}`" :tone="shade" h="48px" :w="actionsLayout === 'start' ? '168px' : '100%'" r="12px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-card {
  display: grid;
  align-content: start;
  overflow: hidden;
}
/* Not `.t-*`: the shapes inside are UiSkeleton roots, which carry this component's scope and their own `.t-*` tone. */
.card-paper {
  background: var(--tilw-surface-white);
}
.card-stage {
  background: var(--tilw-stage-background);
}
.body {
  display: grid;
  align-content: start;
}
.media {
  inline-size: 100%;
}
.sk-card:not(.flush) .media {
  margin-block-end: 4px;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head-txt {
  display: grid;
  flex: 1;
  gap: 8px;
  min-inline-size: 0;
}
.pair {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.acts {
  display: grid;
  gap: 12px;
  margin-block-start: 8px;
}
.a-row {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 14px;
}
</style>
