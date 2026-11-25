<script setup lang="ts">
/**
 * Account (US8, T093 — G5, approved: auth-frame fields inside the settings layout). Edit the name; change
 * the password with the current one, a new one and a confirmation.
 * Release 2 (R2-10/11 `255:724`, additions only): change the email with the current password (pending until the link
 * in the new inbox is opened; Resend / Cancel), and a Devices section listing phones signed in, each with Sign out.
 */
import { isPortError, type Device, type PendingEmail } from '~/services/types'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.profile')} · tilwprompter` })
const auth = useAuthStore()
const errorText = useErrorText()
const { show } = useToast()

// ---------- name ----------
const name = ref(auth.user?.name ?? '')
watch(() => auth.user?.name, v => v && !nameDirty.value && (name.value = v))
const nameDirty = computed(() => name.value.trim() !== (auth.user?.name ?? ''))
const nameError = ref('')
const savingName = ref(false)
async function saveName() {
  nameError.value = ''
  if (!name.value.trim()) {
    nameError.value = t('auth.nameRequired')
    return
  }
  savingName.value = true
  try {
    auth.setUser(await useServices().account.updatePrefs({ name: name.value.trim() }))
    show(t('settings.nameSaved'))
  } catch (e) {
    nameError.value = errorText(e)
  } finally {
    savingName.value = false
  }
}

// ---------- email change (release 2) ----------
const { locale } = useI18n()
const pending = ref<PendingEmail | null>(null)
const emailOpen = ref(false)
const newEmail = ref('')
const emailPw = ref('')
const em = reactive<{ email?: string; password?: string; form?: string }>({})
const savingEmail = ref(false)
const pendingChecked = ref(false)
onMounted(async () => {
  void loadDevices()
  try {
    pending.value = await useServices().account.pendingEmailChange()
  } catch { /* the row just doesn't show */ } finally {
    pendingChecked.value = true
  }
})
async function requestEmail() {
  em.email = isEmail(normalizeEmail(newEmail.value)) ? undefined : t('auth.emailInvalid')
  em.password = emailPw.value ? undefined : t('auth.passwordRequired')
  em.form = undefined
  if (em.email || em.password) return
  savingEmail.value = true
  try {
    pending.value = await useServices().account.requestEmailChange({ email: newEmail.value, password: emailPw.value })
    emailOpen.value = false
    newEmail.value = emailPw.value = ''
    show(t('email.sent', { email: pending.value.email }))
  } catch (e) {
    if (isPortError(e, 'invalid_credentials')) em.password = t('settings.wrongPassword')
    else if (isPortError(e, 'validation')) em.email = e.fields?.email === 'same' ? t('email.same') : t('auth.emailInvalid')
    else em.form = errorText(e)
  } finally {
    savingEmail.value = false
  }
}
async function resendEmail() {
  try {
    await useServices().account.resendEmailChange()
    show(t('email.resent'))
  } catch (e) {
    show(errorText(e), 'error')
  }
}
async function cancelEmail() {
  try {
    await useServices().account.cancelEmailChange()
    pending.value = null
    show(t('email.cancelled'))
  } catch (e) {
    show(errorText(e), 'error')
  }
}

// ---------- devices (release 2) ----------
const devices = ref<Device[] | null>(null)
const devicesError = ref('')
const revoking = ref<Device | null>(null)
const revokeOpen = computed({ get: () => !!revoking.value, set: v => !v && (revoking.value = null) })
const revokeBusy = ref(false)
async function loadDevices() {
  try {
    devices.value = await useServices().account.listDevices()
    devicesError.value = ''
  } catch (e) {
    devicesError.value = errorText(e)
  }
}
async function revoke() {
  const d = revoking.value
  if (!d) return
  revokeBusy.value = true
  try {
    await useServices().account.revokeDevice(d.id)
    devices.value = (devices.value ?? []).filter(x => x.id !== d.id)
    show(t('devices.revoked', { name: d.name }))
    revoking.value = null
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    revokeBusy.value = false
  }
}
const deviceName = (d: Device) => (d.current ? t('devices.thisBrowser') : d.name)

// ---------- password ----------
const current = ref('')
const next = ref('')
const confirm = ref('')
const pw = reactive<{ current?: string; next?: string; confirm?: string; form?: string }>({})
const savingPw = ref(false)
async function changePassword() {
  pw.current = current.value ? undefined : t('auth.passwordRequired')
  pw.next = next.value.length >= PASSWORD_MIN ? undefined : t('auth.passwordMin', { min: PASSWORD_MIN })
  pw.confirm = confirm.value === next.value ? undefined : t('auth.passwordMismatch')
  pw.form = undefined
  if (pw.current || pw.next || pw.confirm) return
  savingPw.value = true
  try {
    await useServices().account.changePassword({ current: current.value, next: next.value })
    current.value = next.value = confirm.value = ''
    show(t('settings.passwordChanged'))
  } catch (e) {
    if (isPortError(e, 'invalid_credentials')) pw.current = t('settings.wrongPassword')
    else if (isPortError(e, 'validation')) pw.next = t('auth.passwordMin', { min: PASSWORD_MIN })
    else pw.form = errorText(e)
  } finally {
    savingPw.value = false
  }
}
</script>

<template>
  <div class="acc">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('nav.profile') }}</h1>

    <div class="cols">
      <form class="card" novalidate @submit.prevent="saveName">
        <h2>{{ t('settings.identity') }}</h2>
        <UiField v-model="name" :label="t('auth.invite.name')" autocomplete="name" :maxlength="80" :error="nameError" />
        <UiField :model-value="auth.user?.email ?? ''" type="email" :label="t('auth.email')" readonly :hint="pending ? undefined : t('email.hint')" />
        <!-- Until we know whether an email change is waiting: the link's place, not a "Change email" that may be wrong. -->
        <UiSkeleton v-if="!pendingChecked" class="start" h="22px" w="130px" r="4px" />
        <div v-else-if="pending" class="pending" role="status">
          <p>{{ t('email.pending') }} <b dir="ltr">{{ pending.email }}</b></p>
          <small>{{ t('email.pendingHint', { date: formatDay(pending.expiresAt, locale) }) }}</small>
          <span class="p-acts">
            <button type="button" class="link" @click="resendEmail">{{ t('email.resend') }}</button>
            <button type="button" class="link danger" @click="cancelEmail">{{ t('email.cancel') }}</button>
          </span>
        </div>
        <button v-else-if="!emailOpen" type="button" class="link start" @click="emailOpen = true">{{ t('email.change') }}</button>
        <UiButton type="submit" :loading="savingName" :disabled="!nameDirty">{{ t('common.save') }}</UiButton>
      </form>

      <form v-if="emailOpen && !pending" class="card" novalidate @submit.prevent="requestEmail">
        <h2>{{ t('email.change') }}</h2>
        <UiBanner v-if="em.form" tone="error">{{ em.form }}</UiBanner>
        <UiField v-model="newEmail" type="email" :label="t('email.newEmail')" autocomplete="email" :error="em.email" />
        <UiField v-model="emailPw" type="password" :label="t('settings.currentPassword')" autocomplete="current-password" :error="em.password" />
        <p class="note">{{ t('email.note') }}</p>
        <span class="row-acts">
          <UiButton type="submit" :loading="savingEmail">{{ t('email.send') }}</UiButton>
          <UiButton tone="secondary" @click="emailOpen = false">{{ t('common.cancel') }}</UiButton>
        </span>
      </form>

      <form class="card" novalidate @submit.prevent="changePassword">
        <h2>{{ t('settings.changePassword') }}</h2>
        <UiBanner v-if="pw.form" tone="error">{{ pw.form }}</UiBanner>
        <UiField v-model="current" type="password" :label="t('settings.currentPassword')" autocomplete="current-password" :error="pw.current" />
        <UiField v-model="next" type="password" :label="t('auth.reset.new')" autocomplete="new-password" :hint="t('auth.passwordMin', { min: PASSWORD_MIN })" :error="pw.next" />
        <UiField v-model="confirm" type="password" :label="t('auth.reset.confirm')" autocomplete="new-password" :error="pw.confirm" />
        <UiButton type="submit" :loading="savingPw">{{ t('settings.changePassword') }}</UiButton>
      </form>
    </div>

    <section class="devices" aria-labelledby="dev-h">
      <h2 id="dev-h">{{ t('devices.title') }}</h2>
      <p class="note">{{ t('devices.lede') }}</p>
      <UiBanner v-if="devicesError" tone="error">{{ devicesError }}</UiBanner>
      <SkeletonRegion v-else-if="!devices" data-testid="devices-skeleton">
        <SkeletonRows :count="2" height="72px" lead="icon" title-h="17px" meta-h="14px" trail="text" />
      </SkeletonRegion>
      <ul v-else class="dev-list">
        <li v-for="d in devices" :key="d.id" class="dev">
          <UiGlyph :name="d.platform === 'web' ? 'file' : 'mic'" :size="22" class="d-ic" />
          <span class="d-txt">
            <b dir="auto">{{ deviceName(d) }}</b>
            <small>{{ t(`devices.platform.${d.platform}`) }} · {{ t('devices.since', { date: formatDay(d.createdAt, locale) }) }}<template v-if="d.lastUsedAt"> · {{ t('devices.lastUsed', { when: relativeTime(d.lastUsedAt, locale) }) }}</template></small>
          </span>
          <span v-if="d.current" class="here">{{ t('devices.current') }}</span>
          <button v-else type="button" class="link danger" @click="revoking = d">{{ t('devices.signOut') }}</button>
        </li>
      </ul>
    </section>

    <UiDialog v-model:open="revokeOpen" :title="t('devices.confirmTitle', { name: revoking?.name ?? '' })">
      <p>{{ t('devices.confirmLede') }}</p>
      <template #actions>
        <UiButton tone="danger" :loading="revokeBusy" @click="revoke">{{ t('devices.signOut') }}</UiButton>
        <UiButton tone="secondary" @click="revoking = null">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.acc {
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
.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: 22px;
  margin-block-start: 30px;
  align-items: start;
}
.card {
  display: grid;
  gap: 20px;
  padding: 26px 28px 30px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.card h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.card :deep(.ui-btn) {
  justify-self: start;
  min-inline-size: 200px;
}
.pending {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--tilw-surface-selected);
}
.pending p {
  margin: 0;
  font: 400 16px/1.5 var(--tilw-font-ar);
}
.pending b {
  font-family: var(--tilw-font-lat);
  font-weight: 500;
}
.pending small,
.note {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 14px/1.5 var(--tilw-font-ar);
}
.p-acts,
.row-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.link {
  padding: 2px;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.link.start {
  justify-self: start;
}
.link.danger {
  color: var(--tilw-status-error);
}
.link:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.devices {
  display: grid;
  gap: 12px;
  margin-block-start: 34px;
}
.devices h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.dev-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dev {
  display: flex;
  align-items: center;
  gap: 14px;
  min-block-size: 72px;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.d-ic {
  color: var(--tilw-action-primary);
}
.d-txt {
  display: grid;
  flex: 1;
  gap: 2px;
  min-inline-size: 0;
}
.d-txt b {
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.d-txt small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.4 var(--tilw-font-ar);
}
.here {
  color: var(--tilw-status-success);
  font: 500 14px/1.36 var(--tilw-font-ar);
}
@media (max-width: 760px) {
  .dev {
    flex-wrap: wrap;
    padding: 12px 14px;
  }
  .acc {
    padding-block: 20px;
  }
  h1 {
    font-size: 32px;
  }
  .card {
    padding: 20px 18px;
  }
  .card :deep(.ui-btn) {
    justify-self: stretch;
  }
}
</style>
