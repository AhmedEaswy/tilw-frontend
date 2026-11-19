<script setup lang="ts">
/**
 * Account export (US8, T091): confirm password (6:66) → download requested (6:67). The file is the
 * account and its scripts as JSON (`tilw-account-v1.json`); recordings are downloaded from the library.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.exportTitle')} · tilwprompter` })
const errorText = useErrorText()

const FILE = 'tilw-account-v1.json'
const step = ref<'confirm' | 'sent'>('confirm')
const password = ref('')
const error = ref('')
const busy = ref(false)
let lastBlob: Blob | null = null

function save(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function submit() {
  error.value = ''
  if (!password.value) {
    error.value = t('auth.passwordRequired')
    return
  }
  busy.value = true
  try {
    lastBlob = await useServices().account.exportData({ password: password.value })
    save(lastBlob)
    password.value = ''
    step.value = 'sent'
  } catch (e) {
    error.value = isPortError(e, 'invalid_credentials') ? t('settings.wrongPassword') : errorText(e)
  } finally {
    busy.value = false
  }
}
function again() {
  if (lastBlob) save(lastBlob)
}
</script>

<template>
  <TaskCard v-if="step === 'confirm'" :kicker="t('settings.accountData')" :title="t('settings.exportHeading')" :lede="t('settings.exportLede')">
    <form id="export-form" novalidate @submit.prevent="submit">
      <UiField v-model="password" type="password" :label="t('settings.confirmPassword')" autocomplete="current-password" :error="error" autofocus />
    </form>
    <template #actions>
      <UiButton type="submit" form="export-form" :loading="busy">{{ t('settings.downloadCopy') }}</UiButton>
      <UiButton tone="secondary" to="/app/settings">{{ t('common.cancel') }}</UiButton>
    </template>
  </TaskCard>

  <TaskCard v-else :kicker="t('settings.accountData')" :title="t('recordings.sentTitle')" :lede="t('settings.exportSentLede')">
    <p class="file" dir="ltr">{{ FILE }}</p>
    <template #actions>
      <UiButton to="/app/settings">{{ t('settings.backToSettings') }}</UiButton>
      <UiButton tone="secondary" @click="again">{{ t('settings.downloadAgain') }}</UiButton>
    </template>
  </TaskCard>
</template>

<style scoped>
.file {
  margin: 0;
  padding: 16px 18px;
  border-radius: 9px;
  background: var(--tilw-surface-paper);
  font: 500 17px/1.36 var(--tilw-font-lat);
}
:dir(rtl) .file {
  text-align: end;
}
</style>
