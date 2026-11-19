<script setup lang="ts">
/** Waitlist · signup by invitation (6:63). T023. */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth', authPhoto: 'glass' })
const { t } = useI18n()
useHead({ title: () => `${t('waitlist.title')} · tilwprompter` })

const errorText = useErrorText()
const joined = useWaitlistEmail()
const email = ref('')
const errors = reactive<{ email?: string; form?: string }>({})
const busy = ref(false)

async function submit() {
  errors.email = !email.value.trim() ? t('auth.emailRequired') : !isEmail(email.value) ? t('auth.emailInvalid') : undefined
  errors.form = undefined
  if (errors.email || busy.value) return
  busy.value = true
  try {
    await useServices().waitlist.join({ email: email.value.trim() })
    joined.value = normalizeEmail(email.value)
    await navigateTo('/waitlist/confirmed')
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
    <AuthHeading icon="field-mail" :title="t('waitlist.title')" :lede="t('waitlist.lede')" />
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
      <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('waitlist.submit') }}</UiButton>
    </AuthForm>
    <NuxtLink to="/signin" class="alt">{{ t('waitlist.haveAccount') }}</NuxtLink>
  </div>
</template>

<style scoped>
.alt {
  display: inline-block;
  margin-block-start: 32px;
  color: var(--tilw-action-solid);
  font: 500 16px/24px var(--tilw-font-ar);
  text-decoration: none;
}
.alt:hover {
  text-decoration: underline;
}
</style>
