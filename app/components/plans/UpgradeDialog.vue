<script setup lang="ts">
/**
 * Upgrade to Pro (R2-4 `264:1321`): the home-page plans poster in a dialog. Its button opens the phone dialog, which
 * sends the request with the person's WhatsApp number (FR-006). Mounted once in the app layout and opened with
 * `useUpgrade().open()` from Plan & usage, a limit message, the account menu or `?upgrade=1`.
 */
import type { UpgradePeriod } from '~/services/types'

const { t } = useI18n()
const upgrade = useUpgrade()
const plan = usePlanStore()
const errorText = useErrorText()

const open = computed({ get: () => upgrade.isOpen.value, set: v => (v ? upgrade.open() : upgrade.close()) })
const period = ref<UpgradePeriod>('yearly')
const error = ref('')

watch(open, (v) => {
  if (!v) return
  error.value = ''
  const p = plan.my?.pendingRequest?.period ?? (plan.my?.period === 'monthly' ? 'monthly' : 'yearly')
  period.value = p
  if (!plan.plans.length) void plan.loadPublic().catch(e => (error.value = errorText(e)))
  if (!plan.my) void plan.load()
}, { immediate: true }) // `?upgrade=1` opens the sheet before this component mounts
// Opened before the catalogue was read (e.g. `?upgrade=1`), then no paid plan is on sale (the admin disabled Pro):
// there is nothing to upgrade to, so the sheet closes.
watch(() => upgrade.available.value, (v) => { if (!v) upgrade.close() }, { immediate: true })
</script>

<template>
  <UiDialog v-model:open="open" class="upgrade" :title="plan.isPro ? t('upgrade.renewTitle') : t('upgrade.title')">
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>

    <UiSkeleton v-if="!plan.plans.length && !error" h="420px" r="24px" />
    <PlansPoster
      v-else-if="plan.plans.length"
      v-model:period="period"
      :plans="plan.plans"
      mode="upgrade"
      :current="plan.my?.plan.key ?? 'free'"
      @cta="upgrade.askPhone(period)"
    />

    <template #actions>
      <UiButton tone="secondary" @click="upgrade.close()">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
  <!-- After the sheet, so it opens on top of it. -->
  <PhoneDialog />
</template>

<style scoped>
.upgrade {
  inline-size: 1000px;
}
.upgrade :deep(.body) {
  padding-block: 24px 28px;
}
</style>
