<script setup lang="ts">
/**
 * Feature 006 (research R9): a token-coloured bar chart in inline SVG with a hidden table for screen readers.
 * Oldest first in reading order (so the newest day is at the inline end in both directions).
 */
const props = defineProps<{ data: { label: string; value: number }[]; caption: string; height?: number; valueLabel?: string }>()
const { locale } = useI18n()
const h = computed(() => props.height ?? 140)
const max = computed(() => Math.max(1, ...props.data.map(d => d.value)))
const w = computed(() => Math.max(1, props.data.length) * 12)
const rtl = computed(() => locale.value === 'ar')
const bars = computed(() => props.data.map((d, i) => {
  const bh = d.value ? Math.max(2, Math.round((d.value / max.value) * (h.value - 4))) : 1
  const x = rtl.value ? (props.data.length - 1 - i) * 12 + 2 : i * 12 + 2
  return { ...d, x, y: h.value - bh, bh }
}))
</script>

<template>
  <figure class="chart">
    <svg :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none" :height="h" role="img" :aria-label="caption">
      <rect v-for="b in bars" :key="b.label" :x="b.x" :y="b.y" width="8" :height="b.bh" rx="1.5" :class="{ zero: !b.value }">
        <title>{{ b.label }}: {{ b.value }}</title>
      </rect>
    </svg>
    <div class="axis" aria-hidden="true">
      <span>{{ data[0]?.label }}</span>
      <span>{{ data.at(-1)?.label }}</span>
    </div>
    <table class="sr">
      <caption>{{ caption }}</caption>
      <tbody>
        <tr v-for="d in data" :key="d.label"><th scope="row">{{ d.label }}</th><td>{{ d.value }}</td></tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.chart {
  display: grid;
  gap: 6px;
}
svg {
  inline-size: 100%;
  display: block;
}
rect {
  fill: var(--tilw-action-primary);
}
rect.zero {
  fill: var(--tilw-border-subtle);
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--tilw-text-muted);
  font: 500 11px/1.4 var(--tilw-font-ar);
}
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
