<script setup lang="ts">
/**
 * Feature 005, US2 + US4 (A6 `296:380`, states `296:532`, phone `297:504`): Settings → AI & credits. Balance,
 * this month's entries, the negative-balance banner, and the own text key.
 */
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('ai.credits.title')} · tilwprompter` })
const ai = useAiStore()
const plan = usePlanStore()
const errorText = useErrorText()
const { copyFor } = useAiText()
const error = ref<unknown>(null)

async function load() {
  error.value = null
  try {
    await ai.loadCredits()
  } catch (e) {
    error.value = e
  }
}
onMounted(() => {
  void load()
  if (!plan.my) void plan.load()
})
const negative = computed(() => (ai.credits ? copyFor('negative', { balance: ai.credits.balance }) : null))
</script>

<template>
  <div class="ai-page">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('ai.credits.title') }}</h1>
    <p class="lede">{{ t('ai.credits.lede') }}</p>

    <UiBanner v-if="error && !ai.credits" tone="error">
      {{ errorText(error) }}
      <template #action><UiButton size="sm" tone="secondary" @click="load">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>
    <div v-else-if="!ai.credits" class="grid" aria-busy="true"><UiSkeleton h="240px" r="12px" /><UiSkeleton h="240px" r="12px" /></div>

    <template v-else>
      <AiMessage v-if="ai.credits.balance < 0 && negative" :title="negative.title" :text="negative.text" data-testid="credits-negative" />
      <div class="grid">
        <CreditsCard :credits="ai.credits" />
        <OwnKeyCard />
      </div>
      <h2>{{ t('ai.credits.month') }}</h2>
      <CreditEntries :entries="ai.credits.entries" />
    </template>
  </div>
</template>

<style scoped>
.ai-page {
  display: grid;
  gap: 20px;
  padding-block: 30px 48px;
}
.back {
  justify-self: start;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
h1 {
  margin: 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: -8px 0 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
h2 {
  margin: 16px 0 0;
  font: 500 22px/1.36 var(--tilw-font-ar);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 548fr) minmax(0, 376fr);
  gap: 24px;
  align-items: start;
}
@media (max-width: 760px) {
  h1 {
    font-size: 28px;
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
}
</style>
