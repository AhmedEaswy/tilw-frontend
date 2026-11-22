<script setup lang="ts">
/** "Invite someone": an email address that is not necessarily on the waitlist. Sent by the API, never by this page. */
import { isPortError } from '~/services/types'

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const email = ref('')
const error = ref('')
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    email.value = ''
    error.value = ''
  }
})

async function submit() {
  error.value = ''
  const e = normalizeEmail(email.value)
  if (!isEmail(e)) {
    error.value = t('admin.invalidEmail')
    return
  }
  busy.value = true
  try {
    await admin.invite(e)
    show(t('admin.toastInvited', { email: e }))
    open.value = false
  } catch (err) {
    error.value = isPortError(err, 'validation') ? t('admin.invalidEmail')
      : isPortError(err, 'conflict') ? t('admin.alreadyMember')
        : errorText(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('admin.inviteTitle')">
    <form id="admin-invite" novalidate @submit.prevent="submit">
      <UiField v-model="email" type="email" ltr :label="t('admin.emailLabel')" placeholder="name@example.com" autocomplete="off" :error="error" autofocus />
    </form>
    <template #actions>
      <UiButton type="submit" form="admin-invite" :loading="busy">{{ t('admin.send') }}</UiButton>
      <UiButton tone="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
    </template>
  </UiDialog>
</template>
