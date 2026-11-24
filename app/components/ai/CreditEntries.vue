<script setup lang="ts">
/**
 * Feature 005 (A6 `296:380`): this month's ledger, newest first. Each line says what it was (a charge names its
 * capability), when, its status, and the signed amount; a refund names its charge, a grant its end date.
 */
import type { CreditEntry } from '~/services/types'

const props = defineProps<{ entries: CreditEntry[] }>()
const { t } = useI18n()
const { dateTime } = useAiText()

const byId = computed(() => new Map(props.entries.map(e => [e.id, e])))

function title(e: CreditEntry) {
  const kind = t(`ai.credits.kind.${e.kind}`)
  const cap = e.capability ? t(`ai.credits.cap.${e.capability}`) : ''
  if (e.kind === 'charge' && cap) return cap
  return cap && e.kind !== 'monthly' ? `${kind} · ${cap}` : kind
}
function meta(e: CreditEntry) {
  const parts = [dateTime(e.createdAt)]
  if (e.status && e.kind !== 'refund') parts.push(t(`ai.credits.status.${e.status}`))
  const charge = e.refundOf ? byId.value.get(e.refundOf) : null
  if (charge) parts.push(t('ai.credits.refundOf', { when: dateTime(charge.createdAt) }))
  if (e.endsAt) parts.push(t('ai.credits.grantEnds', { date: dateTime(e.endsAt) }))
  return parts.join(' · ')
}
const amount = (e: CreditEntry) => (e.kind === 'own_key' ? t('ai.credits.noCredits') : e.amount > 0 ? `+${e.amount}` : String(e.amount))
</script>

<template>
  <ul class="entries" data-testid="credit-entries">
    <li v-for="e in entries" :key="e.id">
      <span class="txt"><b>{{ title(e) }}</b><small>{{ meta(e) }}</small></span>
      <span class="amt" :class="{ plus: e.amount > 0, zero: e.kind === 'own_key' }" dir="ltr">{{ amount(e) }}</span>
    </li>
    <li v-if="!entries.length" class="none">{{ t('ai.credits.none') }}</li>
  </ul>
</template>

<style scoped>
.entries {
  margin: 0;
  padding: 8px 28px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block: 12px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
li:last-child {
  border-block-end: 0;
}
.txt {
  display: grid;
  gap: 2px;
}
b {
  font: 500 17px/1.4 var(--tilw-font-ar);
}
small,
.none {
  color: var(--tilw-text-muted);
  font: 400 13px/1.5 var(--tilw-font-ar);
}
.amt {
  font: 700 18px/1.4 var(--tilw-font-ar);
  white-space: nowrap;
}
.amt.plus {
  color: var(--tilw-status-success);
}
.amt.zero {
  color: var(--tilw-text-muted);
  font-weight: 500;
  font-size: 14px;
}
</style>
