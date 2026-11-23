<script setup lang="ts">
/**
 * One limit row on Plan & usage (R2-1 `252:179`, local "R2 / Usage meter"): label, value and, for counted limits,
 * a meter that turns to the warning colour at 80 % and above. `role="meter"` carries the value as text.
 */
import type { LimitValue } from '~/services/types'
import { usageRatio, WARN_AT } from '~/utils/limits'

const props = defineProps<{ limit: LimitValue; muted?: boolean }>()
const { t, te, locale } = useI18n()

const label = computed(() => (te(`limits.labels.${props.limit.key}`) ? t(`limits.labels.${props.limit.key}`) : props.limit.label))
const ratio = computed(() => usageRatio(props.limit.value, props.limit.usage))
const warn = computed(() => ratio.value !== null && ratio.value >= WARN_AT)

const valueText = computed(() => {
  const { type, value, usage, key } = props.limit
  if (props.muted) return t('limits.soon')
  if (type === 'bool') return value ? t('limits.included') : t('limits.notIncluded')
  if (type === 'list') return Array.isArray(value) && value.length ? value.map(v => (te(`limits.providers.${v}`) ? t(`limits.providers.${v}`) : v)).join('، ') : t('limits.notIncluded')
  if (value === null) return typeof usage === 'number' ? t('limits.usedOfUnlimited', { n: usage }) : t('limits.unlimited')
  const n = value as number
  if (key === 'takes.max_minutes') return `${n} ${unitFor(n, 'minute', locale.value)}`
  if (key === 'history.days') return t('limits.days', { n })
  if (typeof usage === 'number') return t('limits.usedOf', { n: usage, max: n })
  return String(n)
})
</script>

<template>
  <div class="meter-row" :class="{ muted, warn }">
    <div class="top">
      <span class="lbl">{{ label }}</span>
      <span class="val" :class="{ warn }">{{ valueText }}</span>
    </div>
    <div
      v-if="ratio !== null && !muted"
      class="bar"
      role="meter"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="Number(limit.value)"
      :aria-valuenow="limit.usage ?? 0"
      :aria-valuetext="valueText"
    >
      <span class="fill" :style="{ inlineSize: `${Math.max(2, ratio * 100)}%` }" />
    </div>
  </div>
</template>

<style scoped>
.meter-row {
  display: grid;
  gap: 10px;
  padding: 18px 22px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.lbl {
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.val {
  color: var(--tilw-text-muted);
  font: 400 16px/1.36 var(--tilw-font-ar);
  text-align: end;
}
.val.warn {
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.bar {
  block-size: 6px;
  border-radius: 3px;
  background: var(--tilw-surface-quiet);
  overflow: hidden;
}
.fill {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--tilw-status-success);
}
.warn .fill {
  background: var(--tilw-action-primary);
}
.muted .lbl,
.muted .val {
  color: var(--tilw-text-muted);
  opacity: 0.75;
}
@media (max-width: 760px) {
  .meter-row {
    padding: 14px 16px;
  }
  .lbl {
    font-size: 16px;
  }
  .val {
    font-size: 14px;
  }
}
</style>
