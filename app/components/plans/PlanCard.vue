<script setup lang="ts">
/**
 * The person's plan in the settings account-card style (R2-1 `252:179`, from 6:65): plan name, period and end date,
 * and the way to Pro (Upgrade on Free, Renew on Pro).
 */
import type { MyPlan } from '~/services/types'

const props = defineProps<{ my: MyPlan }>()
const emit = defineEmits<{ upgrade: [] }>()
const { t, locale } = useI18n()

const pro = computed(() => props.my.plan.key !== 'free')
// Hidden while no paid plan is on sale (the admin disabled Pro).
const upgrade = useUpgrade()
const periodText = computed(() => {
  const { period, endsAt, renewsAfter } = props.my
  if (!pro.value) return t('plan.freeForever')
  const p = period ? t(`plan.period.${period}`) : ''
  const end = endsAt ? t('plan.until', { date: formatDay(endsAt, locale.value) }) : ''
  const renew = renewsAfter ? ` · ${t('plan.renewQueued', { date: formatDay(renewsAfter, locale.value) })}` : ''
  return [p, end].filter(Boolean).join(' · ') + renew
})
</script>

<template>
  <section class="plan-card" :aria-label="t('plan.yourPlan')">
    <p class="kicker">{{ t('plan.yourPlan') }}</p>
    <p class="name">{{ pro ? t('plan.proName') : t('plan.freeName') }}</p>
    <p class="period">{{ periodText }}</p>
    <UiButton v-if="upgrade.available.value" tone="cue" class="go" @click="emit('upgrade')">{{ pro ? t('upgrade.renew') : t('upgrade.cta') }}</UiButton>
  </section>
</template>

<style scoped>
.plan-card {
  display: grid;
  align-content: start;
  gap: 0;
  padding: 27px 30px;
  border-radius: 12px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.kicker {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 19px/1.36 var(--tilw-font-ar);
}
.name {
  margin: 18px 0 0;
  font: 700 34px/1.36 var(--tilw-font-ar);
}
.period {
  margin: 10px 0 0;
  color: var(--tilw-stage-secondary);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
.go {
  justify-self: start;
  margin-block-start: 22px;
}
@media (max-width: 760px) {
  .plan-card {
    padding: 20px 18px;
  }
  .name {
    font-size: 26px;
    margin-block-start: 10px;
  }
}
</style>
