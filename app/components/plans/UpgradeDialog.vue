<script setup lang="ts">
/**
 * Upgrade to Pro (R2-4 `264:1321`): the home-page plans poster in a dialog. "Continue on WhatsApp" creates the request
 * and opens the service's wa.me link in a new tab; if the browser blocked it (or no sales number is set) the sheet
 * shows the reference with a copy control and the link as a button (FR-006). Mounted once in the app layout and
 * opened with `useUpgrade().open()` from Plan & usage, a limit message, the account menu or `?upgrade=1`.
 */
import type { UpgradePeriod } from '~/services/types'

const { t } = useI18n()
const upgrade = useUpgrade()
const plan = usePlanStore()
const route = useRoute()
const { show } = useToast()
const errorText = useErrorText()

const open = computed({ get: () => upgrade.isOpen.value, set: v => (v ? upgrade.open() : upgrade.close()) })
const period = ref<UpgradePeriod>('yearly')
const busy = ref(false)
const error = ref('')
const fallback = ref<{ reference: string; url: string | null } | null>(null)

watch(open, (v) => {
  if (!v) return
  error.value = ''
  fallback.value = null
  const p = plan.my?.pendingRequest?.period ?? (plan.my?.period === 'monthly' ? 'monthly' : 'yearly')
  period.value = p
  if (!plan.plans.length) void plan.loadPublic().catch(e => (error.value = errorText(e)))
  if (!plan.my) void plan.load()
}, { immediate: true }) // `?upgrade=1` opens the sheet before this component mounts

async function go() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await upgrade.start(period.value)
    if (r.kind === 'opened') {
      upgrade.close()
      show(t('upgrade.sent', { ref: r.reference }), 'success', 7000)
      if (route.path !== '/app/settings/plan') await navigateTo('/app/settings/plan')
    } else {
      fallback.value = { reference: r.reference, url: r.url }
    }
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function copy() {
  if (!fallback.value) return
  try {
    await navigator.clipboard.writeText(fallback.value.reference)
    show(t('upgrade.copied'))
  } catch {
    show(t('upgrade.copyFailed'), 'error')
  }
}
</script>

<template>
  <UiDialog v-model:open="open" class="upgrade" :title="plan.isPro ? t('upgrade.renewTitle') : t('upgrade.title')">
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>

    <div v-if="fallback" class="fallback" role="status">
      <p>{{ fallback.url ? t('upgrade.blocked') : t('upgrade.noNumber') }}</p>
      <div class="ref">
        <span>{{ t('upgrade.reference') }}</span>
        <code dir="ltr">{{ fallback.reference }}</code>
        <button type="button" class="copy" @click="copy"><UiGlyph name="copy" :size="18" />{{ t('upgrade.copy') }}</button>
      </div>
    </div>

    <UiSkeleton v-else-if="!plan.plans.length && !error" h="420px" r="24px" />
    <PlansPoster
      v-else-if="plan.plans.length"
      v-model:period="period"
      :plans="plan.plans"
      mode="upgrade"
      :current="plan.my?.plan.key ?? 'free'"
      :busy="busy"
      @cta="go"
    />

    <template #actions>
      <template v-if="fallback">
        <UiButton v-if="fallback.url" @click="upgrade.reopen(fallback.url!)">{{ t('upgrade.openLink') }}</UiButton>
        <UiButton tone="secondary" to="/app/settings/plan" @click="upgrade.close()">{{ t('upgrade.toPlan') }}</UiButton>
      </template>
      <UiButton v-else tone="secondary" @click="upgrade.close()">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.upgrade {
  inline-size: 1000px;
}
.upgrade :deep(.body) {
  padding-block: 24px 28px;
}
.fallback {
  display: grid;
  gap: 14px;
}
.fallback p {
  margin: 0;
}
.ref {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--tilw-surface-selected);
  color: var(--tilw-text-ink);
  font: 400 17px/1.36 var(--tilw-font-ar);
}
code {
  font: 600 24px/1.2 var(--tilw-font-mono);
  letter-spacing: 0.04em;
}
.copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.copy:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
}
</style>
