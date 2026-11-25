<script setup lang="ts">
/**
 * Loading shape of PlanOverview: the dark plan card (kicker, plan name, period, the upgrade button) beside the
 * "why Pro" block (heading and four lines), on PlanOverview's grid and phone breakpoint.
 * aria-hidden: the page's SkeletonRegion carries the busy state.
 */
import SkeletonCard from '~/components/skeleton/SkeletonCard.vue'
</script>

<template>
  <div class="plan-overview" aria-hidden="true">
    <SkeletonCard class="plan" tone="stage" kicker title="44px" title-w="46%" :lines="1" line-h="17px" :actions="1" padding="27px 30px" gap="16px" />
    <SkeletonCard class="why" title="26px" title-w="42%" :lines="4" padding="24px 27px" gap="14px" />
  </div>
</template>

<style scoped>
/* PlanOverview.vue's grid */
.plan-overview {
  display: grid;
  grid-template-columns: minmax(0, 376fr) minmax(0, 558fr);
  gap: 22px;
  align-items: stretch;
}
@media (max-width: 760px) {
  .plan-overview {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .plan {
    padding: 20px 18px !important;
  }
  .why {
    padding: 18px !important;
  }
}
</style>
