<script setup lang="ts">
/** Feature 005 (A6 `296:380`): balance, this month's plan credits, grants left, renewal date. */
import type { Credits } from '~/services/types'

const props = defineProps<{ credits: Credits }>()
const { t } = useI18n()
const { credits: n, renewDate } = useAiText()
const negative = computed(() => props.credits.balance < 0)
</script>

<template>
  <section class="credits" :aria-label="t('ai.credits.balance')" data-testid="credits-card">
    <span class="lbl">{{ t('ai.credits.balance') }}</span>
    <b class="big" :class="{ neg: negative }" dir="ltr" data-testid="credits-balance">{{ n(credits.balance) }}</b>
    <dl>
      <div><dt>{{ t('ai.credits.fromPlan') }}</dt><dd>{{ t('ai.credits.fromPlanValue', { left: credits.monthlyLeft, monthly: credits.monthly }) }}</dd></div>
      <div v-if="credits.granted"><dt>{{ t('ai.credits.granted') }}</dt><dd>{{ credits.granted }}</dd></div>
      <div><dt>{{ t('ai.credits.renews') }}</dt><dd>{{ renewDate }}</dd></div>
    </dl>
    <p class="rule">{{ t('ai.credits.rule') }}</p>
  </section>
</template>

<style scoped>
.credits {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 24px 28px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.lbl,
dt,
.rule {
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.lbl {
  font-weight: 500;
}
.big {
  justify-self: start;
  font: 700 41px/1.3 var(--tilw-font-ar);
}
.big.neg {
  color: var(--tilw-status-error);
}
dl {
  display: grid;
  gap: 6px;
  margin: 0;
}
dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
dd {
  margin: 0;
  font: 500 16px/1.5 var(--tilw-font-ar);
}
.rule {
  margin: 4px 0 0;
  font-size: 13px;
}
</style>
