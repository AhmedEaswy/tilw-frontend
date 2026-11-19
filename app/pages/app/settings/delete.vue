<script setup lang="ts">
/**
 * Delete account (US8, T094 — G4, approved: follows the export pattern 6:66 → 6:67). Explains what is removed
 * (the account and its scripts) and what stays (recordings in this browser), asks for the password, then shows
 * a done screen and leaves the user signed out.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.deleteTitle')} · tilwprompter` })
const auth = useAuthStore()
const errorText = useErrorText()

const step = ref<'confirm' | 'done'>('confirm')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (!password.value) {
    error.value = t('auth.passwordRequired')
    return
  }
  busy.value = true
  try {
    await useServices().account.deleteAccount({ password: password.value })
    step.value = 'done'
  } catch (e) {
    error.value = isPortError(e, 'invalid_credentials') ? t('settings.wrongPassword') : errorText(e)
  } finally {
    busy.value = false
  }
}

// The session is already gone on the server; clear it here once the user leaves the done screen.
async function finish() {
  auth.setUser(null)
  await navigateTo('/', { replace: true })
}
onBeforeUnmount(() => {
  if (step.value === 'done') auth.setUser(null)
})
</script>

<template>
  <TaskCard v-if="step === 'confirm'" :kicker="t('settings.account')" :title="t('settings.deleteHeading')" :lede="t('settings.deleteLede')">
    <ul class="what">
      <li class="gone">{{ t('settings.deleteGone') }}</li>
      <li class="stays">{{ t('settings.deleteStays') }}</li>
    </ul>
    <form id="delete-form" novalidate @submit.prevent="submit">
      <UiField v-model="password" type="password" :label="t('settings.confirmPassword')" autocomplete="current-password" :error="error" />
    </form>
    <template #actions>
      <UiButton type="submit" form="delete-form" tone="danger" :loading="busy">{{ t('settings.deleteConfirm') }}</UiButton>
      <UiButton tone="secondary" to="/app/settings">{{ t('common.cancel') }}</UiButton>
    </template>
  </TaskCard>

  <TaskCard v-else :kicker="t('settings.account')" :title="t('settings.deletedTitle')" :lede="t('settings.deletedLede')">
    <template #actions>
      <UiButton @click="finish">{{ t('settings.toHome') }}</UiButton>
    </template>
  </TaskCard>
</template>

<style scoped>
.what {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font: 400 17px/1.5 var(--tilw-font-ar);
}
.what li {
  padding: 12px 16px;
  border-radius: 9px;
  background: var(--tilw-surface-paper);
}
.what .gone {
  border-inline-start: 3px solid var(--tilw-status-error);
}
.what .stays {
  border-inline-start: 3px solid var(--tilw-status-success);
}
</style>
