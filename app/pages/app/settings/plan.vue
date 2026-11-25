<script setup lang="ts">
/**
 * Plan & usage (R2-1 `252:179` Free, R2-5 `252:297` request pending, `252:381` Pro ending soon). Plan card in the
 * account-card style, the pending request, and one row per limit the app knows (unknown kinds stay hidden). Feature
 * 005: AI credits, own keys and the audio length are real limits, with a link to AI & credits. `?upgrade=1` opens the upgrade sheet (landing CTA, US4).
 */
import { KNOWN_LIMITS } from '~/utils/limits'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('plan.title')} · tilwprompter` })
const plan = usePlanStore()
const upgrade = useUpgrade()
const errorText = useErrorText()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  void plan.load()
  if (route.query.upgrade === '1') {
    upgrade.open()
    await router.replace({ query: { ...route.query, upgrade: undefined } })
  }
})

const meterWidths = KNOWN_LIMITS.map((_, i) => ['34%', '26%', '41%', '30%', '37%'][i % 5]!)
const rows = computed(() => {
  const limits = plan.my?.limits ?? []
  return KNOWN_LIMITS.map(k => limits.find(l => l.key === k)).filter(l => !!l)
})
</script>

<template>
  <div class="plan">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('plan.title') }}</h1>

    <!-- Loading: plan card + why block, then the usage heading and one meter row per known limit. -->
    <SkeletonRegion v-if="!plan.my && (plan.loading || !plan.error)" data-testid="plan-skeleton">
      <PlanOverviewSkeleton class="grid" />
      <div class="use-h" aria-hidden="true"><UiSkeleton h="28px" w="160px" /></div>
      <div class="rows" aria-hidden="true">
        <div v-for="(w, i) in meterWidths" :key="i" class="meter-skel">
          <span class="top"><UiSkeleton h="20px" :w="w" r="4px" /><UiSkeleton h="16px" w="72px" r="4px" /></span>
          <UiSkeleton h="6px" r="3px" />
        </div>
      </div>
    </SkeletonRegion>

    <UiBanner v-else-if="!plan.my" tone="error" class="err">
      {{ errorText(plan.error) }}
      <template #action><UiButton size="sm" tone="secondary" @click="plan.load()">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <template v-else>
      <ProEndingBanner class="banner" />
      <PlanOverview class="grid" :my="plan.my" @upgrade="upgrade.open()" />

      <h2 class="use-h">{{ t('plan.usage') }}</h2>
      <div class="rows">
        <UsageMeter v-for="l in rows" :key="l.key" :limit="l" />
      </div>
      <NuxtLink to="/app/settings/ai" class="ai-link">{{ t('ai.credits.planLink') }}</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.plan {
  padding-block: 30px 48px;
}
.back {
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
h1 {
  margin: 16px 0 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.banner,
.err {
  margin-block-start: 24px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 376fr) minmax(0, 558fr);
  gap: 22px;
  margin-block-start: 30px;
  align-items: stretch;
}
.use-h {
  margin: 36px 0 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.ai-link {
  display: inline-block;
  margin-block-start: 14px;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.rows {
  display: grid;
  gap: 12px;
  margin-block-start: 16px;
}
/* UsageMeter.vue's row box */
.meter-skel {
  display: grid;
  gap: 12px;
  padding: 18px 22px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.meter-skel .top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
@media (max-width: 760px) {
  .plan {
    padding-block: 20px;
  }
  h1 {
    font-size: 32px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 14px;
    margin-block-start: 18px;
  }
  .meter-skel {
    padding: 14px 16px;
  }
}
</style>
