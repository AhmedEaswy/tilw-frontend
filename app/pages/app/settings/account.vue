<script setup lang="ts">
/**
 * Account (US8, T093 — G5, approved: auth-frame fields inside the settings layout). Edit the name; change
 * the password with the current one, a new one and a confirmation. The email is shown read-only until the
 * backend supports changing it.
 */
import { isPortError } from '~/services/types'

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
        <UiField :model-value="auth.user?.email ?? ''" type="email" :label="t('auth.email')" readonly :hint="t('settings.emailLocked')" />
        <UiButton type="submit" :loading="savingName" :disabled="!nameDirty">{{ t('common.save') }}</UiButton>
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
@media (max-width: 760px) {
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
