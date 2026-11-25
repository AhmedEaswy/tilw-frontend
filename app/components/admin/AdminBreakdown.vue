<script setup lang="ts">
/**
 * Feature 007: counts by category as a table whose rows carry a token-coloured bar (recordings by duration range,
 * drives by provider). A real table, so screen readers read label, count and share; the bars are decoration.
 */
import type { ProviderId } from '~/components/brand/ProviderMark.vue'

const props = defineProps<{
  rows: { key: string; label: string; value: number; provider?: ProviderId }[]
  caption: string
  labelHead: string
  valueHead: string
}>()
const { t } = useI18n()
const total = computed(() => props.rows.reduce((n, r) => n + r.value, 0))
const max = computed(() => Math.max(1, ...props.rows.map(r => r.value)))
const share = (v: number) => (total.value ? Math.round((v / total.value) * 100) : 0)
</script>

<template>
  <table class="brk">
    <caption>{{ caption }}</caption>
    <thead>
      <tr><th scope="col">{{ labelHead }}</th><th scope="col" class="bar"><span class="sr">{{ t('admin.analytics.share') }}</span></th><th scope="col" class="n">{{ valueHead }}</th><th scope="col" class="n">%</th></tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r.key">
        <th scope="row"><span class="lbl"><ProviderMark v-if="r.provider" :provider="r.provider" :size="16" />{{ r.label }}</span></th>
        <td class="bar" aria-hidden="true"><span class="track"><span class="fill" :style="{ inlineSize: `${r.value ? Math.max(2, (r.value / max) * 100) : 0}%` }" /></span></td>
        <td class="n adm-ltr">{{ r.value.toLocaleString('en') }}</td>
        <td class="n adm-ltr muted">{{ share(r.value) }}%</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.brk {
  inline-size: 100%;
  border-collapse: collapse;
  font: 500 13px/1.45 var(--tilw-font-ar);
}
caption,
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
th,
td {
  padding: 7px 6px;
  text-align: start;
  font-weight: 500;
}
thead th {
  color: var(--tilw-text-muted);
  font-size: 12px;
}
tbody th {
  white-space: nowrap;
}
.lbl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bar {
  inline-size: 60%;
}
.track {
  display: block;
  block-size: 10px;
  border-radius: 3px;
  background: var(--tilw-band);
}
.fill {
  display: block;
  block-size: 100%;
  border-radius: 3px;
  background: var(--tilw-action-primary);
}
.n {
  text-align: end;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.muted {
  color: var(--tilw-text-muted);
}
</style>
