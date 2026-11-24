<script setup lang="ts">
/**
 * Plan & usage (R2-1 `252:179` Free, R2-5 `252:297` request pending, `252:381` Pro ending soon). Plan card in the
 * account-card style, the pending request, and one row per limit the app knows (unknown kinds stay hidden; AI credits
 * shows greyed until feature 004). `?upgrade=1` opens the upgrade sheet (landing CTA, US4).
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

const rows = computed(() => {
  const limits = plan.my?.limits ?? []
  return KNOWN_LIMITS.map(k => limits.find(l => l.key === k)).filter(l => !!l)
})
const aiCredits = computed(() => plan.my?.limits.find(l => l.key === 'ai.credits_monthly') ?? null)
</script>

<template>
  <div class="plan">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('plan.title') }}</h1>

    <div v-if="!plan.my && (plan.loading || !plan.error)" class="grid" aria-busy="true">
      <UiSkeleton h="219px" r="12px" />
      <UiSkeleton h="219px" r="12px" />
    </div>

    <UiBanner v-else-if="!plan.my" tone="error" class="err">
      {{ errorText(plan.error) }}
      <template #action><UiButton size="sm" tone="secondary" @click="plan.load()">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <template v-else>
      <ProEndingBanner class="banner" />
      <div class="grid">
        <PlanCard :my="plan.my" @upgrade="upgrade.open()" />
        <RequestPanel v-if="plan.my.pendingRequest" :request="plan.my.pendingRequest" />
        <section v-else class="why">
          <h2>{{ plan.isPro ? t('plan.proIncludes') : t('plan.whyPro') }}</h2>
          <ul>
            <li v-for="k in (['minutes', 'scripts', 'sync', 'history'] as const)" :key="k">{{ t(`plan.proLines.${k}`) }}</li>
          </ul>
        </section>
      </div>

      <h2 class="use-h">{{ t('plan.usage') }}</h2>
      <div class="rows">
        <UsageMeter v-for="l in rows" :key="l.key" :limit="l" />
        <UsageMeter v-if="aiCredits" :limit="aiCredits" muted />
      </div>
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
.why {
  padding: 24px 27px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.why h2,
.use-h {
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
.use-h {
  margin-block-start: 36px;
}
.rows {
  display: grid;
  gap: 12px;
  margin-block-start: 16px;
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
  .why {
    padding: 18px;
  }
}
</style>
