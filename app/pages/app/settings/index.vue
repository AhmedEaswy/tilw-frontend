<script setup lang="ts">
/**
 * Preferences (US8, T090): 6:65 desktop, 6:104 phone. Language and appearance, the signed-in account,
 * reading settings (the same account-wide values rehearsal edits, G15), export, scripts from an older
 * version, privacy and terms, sign out, and the delete-account entry (G4).
 */
import type { Locale, Theme } from '~/services/types'
import { LOCALE_COOKIE } from '~/plugins/locale.client'

definePageMeta({ layout: 'app' })
const { t, locale, setLocale, localeProperties } = useI18n()
useHead({ title: () => `${t('nav.settings')} · tilwprompter` })
const auth = useAuthStore()
const prefs = usePrefsStore()
const reader = useReaderStore()
const { show } = useToast()
const errorText = useErrorText()
const { signOut, busy: signingOut } = useSignOut()

// ---------- language & appearance ----------
const savedLocale = useCookie<Locale | null>(LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
async function chooseLocale(l: Locale) {
  if (l === locale.value) return
  savedLocale.value = l
  await setLocale(l)
  void saveAccount({ locale: l })
}
function chooseTheme(th: Theme) {
  prefs.setTheme(th)
  void saveAccount({ theme: th })
}
async function saveAccount(patch: { locale?: Locale; theme?: Theme }) {
  try {
    auth.setUser(await useServices().account.updatePrefs(patch))
  } catch (e) {
    show(errorText(e), 'error')
  }
}
const themes = computed<{ value: Theme; label: string }[]>(() => [
  { value: 'system', label: t('settings.themeSystem') },
  { value: 'light', label: t('settings.themeLight') },
  { value: 'dark', label: t('settings.themeDark') },
])

const initial = computed(() => auth.user?.name?.trim().charAt(0) ?? '·')

// ---------- release 2 (R2-1 `264:1017`): plan name in the account card, Plan & usage and Storage rows ----------
const plan = usePlanStore()
const storage = useStorageStore()
onMounted(() => {
  if (!plan.my) void plan.load()
  void storage.load().catch(() => {})
})
const planName = computed(() => (plan.my ? (plan.isPro ? t('plan.proName') : t('plan.freeName')) : ''))
const planHint = computed(() => {
  const active = plan.my?.limits.find(l => l.key === 'scripts.max_active')
  if (plan.isPro) return t('settings.planHintPro')
  return typeof active?.value === 'number' && typeof active.usage === 'number'
    ? t('settings.planHintFree', { n: active.usage, max: active.value })
    : t('settings.planHint')
})
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

    <div class="top">
      <!-- account card -->
      <section class="account" :aria-label="t('settings.account')">
        <span class="badge" aria-hidden="true">{{ initial }}</span>
        <p class="kicker">{{ t('settings.account') }}</p>
        <p class="name" dir="auto">{{ auth.user?.name }}</p>
        <p class="email" dir="ltr">{{ auth.user?.email }}</p>
        <p v-if="planName" class="plan-name">{{ t('settings.planLabel', { plan: planName }) }}</p>
        <NuxtLink to="/app/settings/account" class="edit">{{ t('settings.editAccount') }}</NuxtLink>
      </section>

      <!-- language & appearance -->
      <section class="appearance">
        <div class="lang">
          <h2>{{ t('settings.language') }}</h2>
          <div class="langs" role="radiogroup" :aria-label="t('settings.language')">
            <button type="button" role="radio" lang="ar" :aria-checked="locale === 'ar'" @click="chooseLocale('ar')">العربية</button>
            <button type="button" role="radio" lang="en" class="lat" :aria-checked="locale === 'en'" @click="chooseLocale('en')">English</button>
          </div>
        </div>
        <hr>
        <h2>{{ t('settings.appearance') }}</h2>
        <div class="themes" role="radiogroup" :aria-label="t('settings.appearance')">
          <button v-for="th in themes" :key="th.value" type="button" role="radio" :aria-checked="prefs.theme === th.value" @click="chooseTheme(th.value)">{{ th.label }}</button>
        </div>
      </section>
    </div>

    <div class="rows">
      <NuxtLink to="/app/settings/plan" class="row">
        <UiGlyph class="ic" name="up" :size="24" />
        <span class="txt"><b>{{ t('plan.title') }}</b><small>{{ planHint }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
      <NuxtLink to="/app/settings/storage" class="row">
        <span class="ic drive" :class="storage.status?.state ?? 'none'">
          <DriveMark :size="22" />
          <i v-if="storage.status?.state === 'linked'" class="dot ok" aria-hidden="true" />
          <i v-else-if="storage.status?.state === 'revoked'" class="dot bad" aria-hidden="true" />
        </span>
        <span class="txt"><b>{{ t('storage.title') }}</b><small>{{ storageHint }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </NuxtLink>
      <button type="button" class="row" @click="openReading">
        <UiGlyph class="ic" name="settings" :size="24" />
        <span class="txt"><b>{{ t('reader.settings.title') }}</b><small>{{ t('settings.readingHint') }}</small></span>
        <span class="go">{{ t('settings.open') }}</span>
      </button>
      <NuxtLink to="/app/settings/export" class="row">
        <UiGlyph class="ic" name="download" :size="24" />
        <span class="txt"><b>{{ t('settings.exportTitle') }}</b><small>{{ t('settings.exportHint') }}</small></span>
        <span class="go">{{ t('settings.download') }}</span>
      </NuxtLink>
      <NuxtLink to="/app/settings/recover" class="row">
        <UiGlyph class="ic" name="rewind" :size="24" />
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
.top {
  display: grid;
  grid-template-columns: minmax(0, 376fr) minmax(0, 558fr);
  gap: 22px;
  margin-block-start: 33px;
}
.account {
  position: relative;
  display: grid;
  align-content: start;
  min-block-size: 219px;
  padding: 27px 30px;
  border-radius: 12px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.badge {
  display: none;
}
.kicker {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 19px/1.36 var(--tilw-font-ar);
}
.name {
  margin: 23px 0 0;
  font: 700 30px/1.36 var(--tilw-font-ar);
}
.email {
  margin: 16px 0 0;
  font: 400 18px/1.36 var(--tilw-font-lat);
  text-align: end;
}
:dir(rtl) .email {
  text-align: start;
}
.plan-name {
  margin: 10px 0 0;
  color: var(--tilw-stage-cue);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.edit {
  margin-block-start: 14px;
  color: var(--tilw-stage-cue);
  font: 500 15px/1.36 var(--tilw-font-ar);
  justify-self: start;
}
.appearance {
  padding: 24px 27px 18px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.appearance h2 {
  margin: 0;
  font: 500 20px/1.36 var(--tilw-font-ar);
}
.langs {
  display: flex;
  justify-content: space-between;
  margin-block-start: 12px;
}
.langs button,
.themes button {
  border: 0;
  background: none;
  color: var(--tilw-text-muted);
  font: 400 17px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.langs .lat {
  font-family: var(--tilw-font-lat);
  padding-inline-end: 60px;
}
.langs button[aria-checked='true'] {
  color: var(--tilw-action-primary);
  font-weight: 500;
}
hr {
  margin: 18px 0;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.themes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-block-start: 12px;
}
.themes button {
  min-block-size: 37px;
  border-radius: 18px;
  font-size: 16px;
}
.themes button[aria-checked='true'] {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.langs button:focus-visible,
.themes button:focus-visible,
.row:focus-visible,
.out:focus-visible,
.edit:focus-visible {
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

/* Phone (6:104): account card with initial, stacked controls, language as a row. */
@media (max-width: 760px) {
  .set {
    padding-block: 24px;
  }
  h1 {
    font-size: 34px;
  }
  .top {
    grid-template-columns: 1fr;
    gap: 14px;
    margin-block-start: 18px;
  }
  .account {
    grid-template-columns: auto 1fr;
    column-gap: 14px;
    align-items: center;
    min-block-size: 0;
    padding: 18px;
  }
  .badge {
    display: grid;
    grid-row: 1 / span 3;
    place-items: center;
    inline-size: 52px;
    block-size: 52px;
    border-radius: 50%;
    background: var(--tilw-stage-cue);
    color: var(--tilw-stage-background);
    font: 500 24px/1 var(--tilw-font-ar);
  }
  .kicker {
    display: none;
  }
  .name {
    margin: 0;
    font-size: 22px;
  }
  .email {
    margin: 2px 0 0;
    font-size: 15px;
  }
  .plan-name {
    grid-column: 2;
    margin: 2px 0 0;
    font-size: 14px;
  }
  .edit {
    grid-column: 2;
    margin-block-start: 6px;
  }
  .appearance {
    padding: 16px 18px;
  }
  .lang {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .langs {
    margin: 0;
    gap: 16px;
  }
  .langs .lat {
    padding: 0;
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
