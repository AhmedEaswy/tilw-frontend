<script setup lang="ts">
/**
 * Feature 007: one total split into a few parts (recordings by kind, links by host, practice by where it ran, keys by
 * provider): a stacked SVG bar in theme-token colours, a legend with each value and share, and a hidden table for
 * screen readers. The first part starts at the inline start in both directions.
 */
import type { ProviderId } from '~/components/brand/ProviderMark.vue'

export interface SplitPart { key: string; label: string; value: number; provider?: ProviderId }
const props = defineProps<{ parts: SplitPart[]; caption: string }>()
const { locale } = useI18n()
const total = computed(() => props.parts.reduce((n, p) => n + p.value, 0))
const rtl = computed(() => locale.value === 'ar')
const share = (v: number) => (total.value ? Math.round((v / total.value) * 100) : 0)
const segs = computed(() => {
  let at = 0
  const list = props.parts.map((p, i) => {
    const w = total.value ? (p.value / total.value) * 100 : 0
    const x = at
    at += w
    return { ...p, i, w, x: rtl.value ? 100 - x - w : x }
  })
  return list.filter(s => s.w > 0)
})
</script>

<template>
  <figure class="split">
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <rect v-if="!total" x="0" y="0" width="100" height="10" rx="2" class="empty" />
      <rect v-for="s in segs" :key="s.key" :x="s.x" y="0" :width="s.w" height="10" :class="`c${s.i % 4}`" />
    </svg>
    <ul class="legend" aria-hidden="true">
      <li v-for="(p, i) in parts" :key="p.key">
        <span class="sw" :class="`c${i % 4}`" />
        <ProviderMark v-if="p.provider" :provider="p.provider" :size="14" />
        <span class="lbl">{{ p.label }}</span>
        <b class="adm-ltr">{{ p.value.toLocaleString('en') }}</b>
        <span class="pct adm-ltr">{{ share(p.value) }}%</span>
      </li>
    </ul>
    <div class="sr"><table>
      <caption>{{ caption }}</caption>
      <tbody>
        <tr v-for="p in parts" :key="p.key"><th scope="row">{{ p.label }}</th><td>{{ p.value }}</td><td>{{ share(p.value) }}%</td></tr>
      </tbody>
    </table></div>
  </figure>
</template>

<style scoped>
.split {
  display: grid;
  gap: 10px;
  margin: 0;
}
svg {
  display: block;
  inline-size: 100%;
  block-size: 12px;
  border-radius: 4px;
  overflow: hidden;
}
.empty {
  fill: var(--tilw-hairline);
}
.c0 { fill: var(--tilw-action-primary); background: var(--tilw-action-primary); }
.c1 { fill: var(--tilw-status-success); background: var(--tilw-status-success); }
.c2 { fill: var(--tilw-warning-ink); background: var(--tilw-warning-ink); }
.c3 { fill: var(--tilw-text-muted); background: var(--tilw-text-muted); }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font: 500 13px/1.4 var(--tilw-font-ar);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sw {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 3px;
}
.pct {
  color: var(--tilw-text-muted);
  font-size: 12px;
}
b {
  font-variant-numeric: tabular-nums;
}
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
