<script setup lang="ts">
/** Password recovery (6:101). Always continues to the "check your email" screen (no account enumeration). T021. */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth', authBack: '/signin' })
const { t } = useI18n()
useHead({ title: () => `${t('auth.recovery.title')} · tilwprompter` })

const errorText = useErrorText()
const email = ref('')
const errors = reactive<{ email?: string; form?: string }>({})
const busy = ref(false)

async function submit() {
  errors.email = !email.value.trim() ? t('auth.emailRequired') : !isEmail(email.value) ? t('auth.emailInvalid') : undefined
  errors.form = undefined
  if (errors.email || busy.value) return
  busy.value = true
  try {
    await useServices().auth.requestPasswordReset({ email: email.value.trim() })
    await navigateTo('/forgot-password/sent')
  } catch (e) {
    if (isPortError(e, 'validation')) errors.email = t('auth.emailInvalid')
    else errors.form = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <AuthHeading icon="field-lock" :title="t('auth.recovery.title')" :lede="t('auth.recovery.lede')" />
    <AuthForm :error="errors.form" @submit="submit">
      <UiField
        v-model="email"
        :label="t('auth.email')"
        type="email"
        name="email"
        autocomplete="email"
        placeholder="name@example.com"
        icon="field-mail"
        :error="errors.email"
        autofocus
      />
      <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('auth.recovery.submit') }}</UiButton>
    </AuthForm>
  </div>
</template>
