<script setup lang="ts">
/**
 * "Pro ends on DATE" (R2-5 `252:381`): shown on Plan & usage and the library when Pro ends within 7 days, with Renew
 * (the same request flow). Dismissing it hides it for 24 hours (browser storage, a per-viewer convenience).
 */
const DISMISS_KEY = 'tilw:pro-ending-dismissed'
const DAY = 86_400_000

const { t, locale } = useI18n()
const plan = usePlanStore()
const upgrade = useUpgrade()

const dismissedAt = ref(0)
onMounted(() => {
  try {
    dismissedAt.value = Number(localStorage.getItem(DISMISS_KEY)) || 0
  } catch { /* storage blocked: the banner just shows */ }
})

const visible = computed(() =>
  plan.daysLeft !== null && plan.daysLeft <= 7 && !plan.my?.renewsAfter && Date.now() - dismissedAt.value > DAY,
)

function dismiss() {
  dismissedAt.value = Date.now()
  try {
    localStorage.setItem(DISMISS_KEY, String(dismissedAt.value))
  } catch { /* fine: hidden for this page view */ }
}
</script>

<template>
  <UiBanner v-if="visible && plan.my?.endsAt" tone="warning" class="ending">
    <b>{{ t('plan.endingTitle', { date: formatDay(plan.my.endsAt, locale) }) }}</b>
    <span>{{ t('plan.endingLede') }}</span>
    <template #action>
      <span class="acts">
        <UiButton v-if="upgrade.available.value" size="sm" @click="upgrade.open()">{{ t('upgrade.renew') }}</UiButton>
        <button type="button" class="x" :aria-label="t('plan.dismiss')" @click="dismiss"><UiGlyph name="close" :size="18" /></button>
      </span>
    </template>
  </UiBanner>
</template>

<style scoped>
.ending :deep(.txt) {
  display: grid;
  gap: 2px;
}
.acts {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.x {
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-muted);
  cursor: pointer;
}
.x:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
}
</style>
