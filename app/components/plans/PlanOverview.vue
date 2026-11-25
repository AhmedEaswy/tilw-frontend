<script setup lang="ts">
/**
 * The plan card beside either the pending upgrade request or what Pro adds / includes (R2-1 `252:179`, R2-5
 * `252:297`). Shared by the settings page (with a link to the full plan) and Plan & usage.
 */
import type { MyPlan } from '~/services/types'

const props = defineProps<{ my: MyPlan }>()
const emit = defineEmits<{ upgrade: [] }>()
const { t } = useI18n()
const pro = computed(() => props.my.plan.key !== 'free')
const upgrade = useUpgrade()
</script>

<template>
  <div class="plan-overview">
    <PlanCard :my="my" @upgrade="emit('upgrade')" />
    <RequestPanel v-if="my.pendingRequest" :request="my.pendingRequest" />
    <section v-else-if="pro || upgrade.available.value" class="why">
      <h2>{{ pro ? t('plan.proIncludes') : t('plan.whyPro') }}</h2>
      <ul>
        <li v-for="k in (['minutes', 'scripts', 'sync', 'history'] as const)" :key="k">{{ t(`plan.proLines.${k}`) }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.plan-overview {
  display: grid;
  grid-template-columns: minmax(0, 376fr) minmax(0, 558fr);
  gap: 22px;
  align-items: stretch;
}
.why {
  padding: 24px 27px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.why h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.why ul {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
  padding-inline-start: 20px;
  color: var(--tilw-text-muted);
  font: 400 16px/1.5 var(--tilw-font-ar);
}
@media (max-width: 760px) {
  .plan-overview {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .why {
    padding: 18px;
  }
}
</style>
