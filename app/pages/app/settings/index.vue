<script setup lang="ts">
/**
 * Preferences (US8, T090): 6:65 desktop, 6:104 phone. The plan card with what Pro adds (link to the full Plan & usage
 * page), then one row per area: the signed-in account (first), storage, AI platforms, phone links, reading settings
 * (the same account-wide values rehearsal edits, G15), export, scripts from an older version; then privacy and terms,
 * sign out, and the delete-account entry (G4). Language and appearance live in the account menu (ProfileMenu).
 */
definePageMeta({ layout: 'app' })
const { t, localeProperties } = useI18n()
useHead({ title: () => `${t('nav.settings')} · tilwprompter` })
const auth = useAuthStore()
const reader = useReaderStore()
const { show } = useToast()
const { signOut, busy: signingOut } = useSignOut()
const upgrade = useUpgrade()

const initial = computed(() => auth.user?.name?.trim().charAt(0) ?? '·')

// ---------- release 2 (R2-1 `264:1017`): plan card, plan badge on the account row, Storage row ----------
const plan = usePlanStore()
const storage = useStorageStore()
onMounted(() => {
  if (!plan.my) void plan.load()
  void storage.load().catch(() => {})
})
const planName = computed(() => (plan.my ? (plan.isPro ? t('plan.proName') : t('plan.freeName')) : ''))
// Feature 005: AI platforms row with the balance.
const ai = useAiStore()
const { renewDate } = useAiText()
onMounted(() => ai.refreshCredits())
const aiHint = computed(() => (ai.balance === null ? t('ai.credits.settingsHintLoading') : t('ai.credits.settingsHint', { n: ai.balance, date: renewDate.value })))
const storageHint = computed(() => {
  const st = storage.status
  if (!st || st.state === 'none') return t('settings.storageHintNone')
  if (st.state === 'revoked') return t('storage.revoked')
  return t('settings.storageHintLinked', { mode: t(`storage.mode.${st.syncMode}`) })
})

// ---------- reading settings drawer ----------
const readingOpen = ref(false)
const readingView = ref<'main' | 'more'>('main')
const panel = ref<{ focus: () => void }>()
function openReading() {
  if (auth.user) reader.settings = { ...auth.user.reading }
  readingView.value = 'main'
  readingOpen.value = true
  nextTick(() => panel.value?.focus())
}
function closeReading() {
  reader.flushSettings()
  readingOpen.value = false
}
onKeyStroke('Escape', () => readingOpen.value && (readingView.value === 'more' ? (readingView.value = 'main') : closeReading()))
watch(() => reader.settingsError, v => v && show(t('reader.settings.saveFailed'), 'error', 6000))
onBeforeUnmount(() => reader.flushSettings())
</script>

<template>
  <div class="set">
    <h1>{{ t('nav.settings') }}</h1>

    <!-- plan: same card and "why" block as Plan & usage, with the way to the full page -->
    <section class="plan" :aria-label="t('plan.title')">
      <div v-if="!plan.my && (plan.loading || !plan.error)" class="plan-wait" aria-busy="true">
        <UiSkeleton h="200px" r="12px" />
        <UiSkeleton h="200px" r="12px" />
      </div>
      <PlanOverview v-else-if="plan.my" :my="plan.my" @upgrade="upgrade.open()" />
      <UiButton tone="secondary" to="/app/settings/plan" class="full-plan" data-testid="settings-full-plan">{{ t('settings.viewFullPlan') }}</UiButton>
    </section>

    <div class="rows">
      <NuxtLink to="/app/settings/account" class="row account" data-testid="settings-account">
        <span class="lead"><span class="avatar" aria-hidden="true">{{ initial }}</span></span>
        <span class="txt">
          <b><bdi>{{ auth.user?.name }}</bdi></b>
          <small class="email"><bdi dir="ltr">{{ auth.user?.email }}</bdi></small>
        </span>
        <span v-if="planName" class="plan-badge" :class="{ pro: plan.isPro }">{{ planName }}</span>
        <UiGlyph class="chev" name="arr" :size="20" />
      </NuxtLink>
      <NuxtLink to="/app/settings/storage" class="row">
        <span class="lead"><span class="ic drive" :class="storage.status?.state ?? 'none'">
          <DriveMark :size="22" />
          <i v-if="storage.status?.state === 'linked'" class="dot ok" aria-hidden="true" />
          <i v-else-if="storage.status?.state === 'revoked'" class="dot bad" aria-hidden="true" />
        </span></span>
        <span class="txt"><b>{{ t('storage.title') }}</b><small>{{ storageHint }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
      <NuxtLink to="/app/settings/ai" class="row" data-testid="settings-ai">
        <span class="lead"><ProviderStack :providers="['openai', 'anthropic']" :size="28" /></span>
        <span class="txt"><b>{{ t('settings.aiPlatforms') }}</b><small>{{ aiHint }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
      <NuxtLink to="/app/settings/phone-links" class="row">
        <span class="lead"><UiGlyph class="ic" name="headset" :size="24" /></span>
        <span class="txt"><b>{{ t('link.history.pageTitle') }}</b><small>{{ t('link.history.rowHint') }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
      <button type="button" class="row" @click="openReading">
        <span class="lead"><UiGlyph class="ic" name="settings" :size="24" /></span>
        <span class="txt"><b>{{ t('reader.settings.title') }}</b><small>{{ t('settings.readingHint') }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </button>
      <NuxtLink to="/app/settings/export" class="row">
        <span class="lead"><UiGlyph class="ic" name="download" :size="24" /></span>
        <span class="txt"><b>{{ t('settings.exportTitle') }}</b><small>{{ t('settings.exportHint') }}</small></span>
        <span class="go">{{ t('settings.download') }}</span>
      </NuxtLink>
      <NuxtLink to="/app/settings/recover" class="row">
        <span class="lead"><UiGlyph class="ic" name="rewind" :size="24" /></span>
        <span class="txt"><b>{{ t('settings.legacyTitle') }}</b><small>{{ t('settings.legacyHint') }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
    </div>

    <footer class="foot">
      <nav class="legal" :aria-label="t('legal.docs')">
        <NuxtLink to="/privacy">{{ t('legal.privacy') }}</NuxtLink>
        <NuxtLink to="/terms">{{ t('legal.terms') }}</NuxtLink>
      </nav>
      <button type="button" class="out" :disabled="signingOut" @click="signOut">{{ t('auth.signOut') }}</button>
    </footer>

    <section class="danger" :aria-labelledby="'danger-h'">
      <div>
        <h2 id="danger-h">{{ t('settings.deleteTitle') }}</h2>
        <p>{{ t('settings.deleteHint') }}</p>
      </div>
      <UiButton tone="secondary" to="/app/settings/delete" class="del">{{ t('settings.deleteOpen') }}</UiButton>
    </section>

    <!-- reading settings: same panel as rehearsal, without the per-script direction -->
    <div v-if="readingOpen" class="scrim" aria-hidden="true" @click="closeReading" />
    <SettingsPanel
      v-if="readingOpen"
      ref="panel"
      v-model:view="readingView"
      class="drawer"
      :settings="reader.settings"
      :ui-direction="localeProperties.dir === 'rtl' ? 'rtl' : 'ltr'"
      :show-direction="false"
      @update="reader.updateSettings"
      @close="closeReading"
    />
  </div>
</template>

<style scoped>
.set {
  padding-block: 37px 48px;
}
h1 {
  margin: 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.plan {
  margin-block-start: 33px;
}
.plan-wait {
  display: grid;
  grid-template-columns: minmax(0, 376fr) minmax(0, 558fr);
  gap: 22px;
}
.full-plan {
  margin-block-start: 14px;
}
.row:focus-visible,
.out:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.rows {
  display: grid;
  gap: 12px;
  margin-block-start: 26px;
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-block-size: 81px;
  padding-inline: 22px 19px;
  border: 0;
  border-radius: 8px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}
.row:hover {
  background: var(--tilw-surface-selected);
  --provider-ring: var(--tilw-surface-selected);
}
/* One slot for every row's leading mark, so the titles line up whatever the mark's width. */
.lead {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 44px;
}
.avatar {
  display: grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  border-radius: 50%;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-cue);
  font: 500 21px/1 var(--tilw-font-ar);
}
/* Name and email are isolated (bdi) so they line up with the page's reading direction, not their own. */
.account .txt {
  min-inline-size: 0;
}
.account .txt > * {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.txt .email {
  font-family: var(--tilw-font-lat);
}
.plan-badge {
  flex: none;
  padding: 3px 12px;
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.plan-badge.pro {
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-cue);
}
.chev {
  color: var(--tilw-text-muted);
}
.row .ic {
  color: var(--tilw-action-primary);
}
.ic.drive {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 24px;
  block-size: 24px;
}
.ic.drive .dot {
  position: absolute;
  inset-block-end: -3px;
  inset-inline-end: -4px;
  inline-size: 10px;
  block-size: 10px;
  border: 2px solid var(--tilw-surface-white);
  border-radius: 50%;
}
.ic.drive .dot.ok {
  background: var(--tilw-status-success);
}
.ic.drive .dot.bad {
  background: var(--tilw-status-error);
}
.txt {
  display: grid;
  flex: 1;
  gap: 4px;
}
.txt b {
  font: 500 20px/1.36 var(--tilw-font-ar);
}
.txt small {
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-ar);
}
.go {
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-block-start: 34px;
}
.legal {
  display: flex;
  gap: 48px;
}
.legal a {
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.out {
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-status-error);
  font: 500 16px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.danger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-block-start: 40px;
  padding: 20px 22px;
  border: 1px solid color-mix(in srgb, var(--tilw-status-error) 40%, transparent);
  border-radius: 10px;
}
.danger h2 {
  margin: 0;
  color: var(--tilw-status-error);
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.danger p {
  margin: 4px 0 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.del {
  flex: 0 0 auto;
  color: var(--tilw-status-error);
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: var(--tilw-scrim);
}
.drawer {
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 31;
  inline-size: min(428px, 100vw);
  box-shadow: var(--tilw-shadow-pop);
}

/* Phone (6:104): stacked plan card, compact rows. */
@media (max-width: 760px) {
  .set {
    padding-block: 24px;
  }
  h1 {
    font-size: 34px;
  }
  .plan {
    margin-block-start: 18px;
  }
  .plan-wait {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .full-plan {
    inline-size: 100%;
  }
  .plan-badge {
    padding-inline: 9px;
    font-size: 13px;
  }
  .row {
    min-block-size: 72px;
    padding-inline: 16px;
  }
  .txt b {
    font-size: 18px;
  }
  .txt small {
    font-size: 13px;
  }
  .foot {
    flex-direction: column;
    align-items: start;
    gap: 22px;
  }
  .danger {
    flex-direction: column;
    align-items: stretch;
  }
  .drawer {
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: 100%;
    block-size: min(700px, 88dvh);
    border-start-start-radius: 19px;
    border-start-end-radius: 19px;
    overflow: hidden;
  }
}
</style>
