<script setup lang="ts">
/**
 * Public sign-up (feature 006 US6, Figma D11 `314:100` open, `314:132` invite-only): while sign-up is open, name,
 * email and password create an account on Free and open the studio. While invite-only (the default, and the answer
 * `signup_closed`), it explains that and points to the waitlist. An email with an account shows on the email field.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('signup.title')} · tilwprompter` })

const auth = useAuthStore()
const errorText = useErrorText()
const { show } = useToast()
const { settings, signupOpen, load } = usePublicSettings()
/** The service said "closed" on submit (the mode changed while the form was open). */
const closed = ref(false)
const open = computed(() => signupOpen.value && !closed.value)

const name = ref('')
const email = ref('')
const password = ref('')
const agreed = ref(false)
const errors = reactive<{ name?: string; email?: string; password?: string; agree?: string; form?: string }>({})
const busy = ref(false)

async function submit() {
  errors.name = !name.value.trim() ? t('auth.nameRequired') : undefined
  errors.email = !email.value.trim() ? t('auth.emailRequired') : !isEmail(email.value) ? t('auth.emailInvalid') : undefined
  errors.password = password.value.length < PASSWORD_MIN ? t('auth.passwordMin', { min: PASSWORD_MIN }) : undefined
  errors.agree = !agreed.value ? t('auth.invite.agreeRequired') : undefined
  errors.form = undefined
  if (errors.name || errors.email || errors.password || errors.agree || busy.value) return
  busy.value = true
  try {
    const u = await auth.signUp({ name: name.value.trim(), email: email.value.trim(), password: password.value, locale: locale.value === 'en' ? 'en' : 'ar' })
    show(t('signup.welcome', { name: u.name }), 'success')
    await navigateTo('/app/scripts', { replace: true })
  } catch (e) {
    if (isPortError(e, 'signup_closed')) {
      closed.value = true
      void load(true)
    } else if (isPortError(e, 'validation') && e.fields?.email) {
      errors.email = e.fields.email === 'taken' || /taken|exists|already/i.test(e.fields.email) ? t('signup.emailTaken') : t('auth.emailInvalid')
    } else {
      errors.form = errorText(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="!settings && !closed" class="checking" role="status">{{ t('common.loading') }}</p>

    <template v-else-if="open">
      <AuthHeading :title="t('signup.title')" :lede="t('signup.lede')" />
      <AuthForm :error="errors.form" @submit="submit">
        <UiField v-model="name" :label="t('auth.invite.name')" name="name" autocomplete="name" :placeholder="t('auth.invite.namePlaceholder')" :maxlength="120" :error="errors.name" autofocus />
        <UiField v-model="email" :label="t('auth.email')" type="email" name="email" autocomplete="email" placeholder="name@example.com" icon="field-mail" :error="errors.email" />
        <UiField
          v-model="password"
          :label="t('auth.password')"
          type="password"
          name="new-password"
          autocomplete="new-password"
          icon="field-lock"
          :hint="t('auth.passwordMin', { min: PASSWORD_MIN })"
          :error="errors.password"
        />
        <div class="agree" :class="{ invalid: errors.agree }">
          <label>
            <input v-model="agreed" type="checkbox" :aria-invalid="errors.agree ? 'true' : undefined" aria-describedby="agree-err">
            <i18n-t keypath="auth.invite.agree" tag="span" scope="global">
              <template #terms><NuxtLink to="/terms" target="_blank">{{ t('legal.terms') }}</NuxtLink></template>
              <template #privacy><NuxtLink to="/privacy" target="_blank">{{ t('legal.privacy') }}</NuxtLink></template>
            </i18n-t>
          </label>
          <p v-if="errors.agree" id="agree-err" class="err" role="alert">{{ errors.agree }}</p>
        </div>
        <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('signup.submit') }}</UiButton>
        <template #footer>
          <span>{{ t('auth.invite.haveAccount') }}</span>
          <NuxtLink to="/signin">{{ t('auth.signIn') }}</NuxtLink>
        </template>
      </AuthForm>
    </template>

    <div v-else class="closed" data-testid="signup-closed">
      <AuthHeading icon="mail" :title="t('signup.closedTitle')" :lede="t('signup.closedLede')" />
      <UiButton to="/waitlist" block icon-end="arrow-action">{{ t('auth.joinWaitlist') }}</UiButton>
      <NuxtLink to="/signin" class="alt">{{ t('auth.invite.haveAccount') }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.checking {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-body);
}
.agree {
  display: grid;
  gap: 6px;
}
.agree label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font: 400 15px/24px var(--tilw-font-ar);
  color: var(--tilw-text-ink);
  cursor: pointer;
}
.agree input {
  flex: 0 0 auto;
  inline-size: 20px;
  block-size: 20px;
  margin-block-start: 2px;
  accent-color: var(--tilw-action-solid);
}
.agree a {
  color: var(--tilw-action-solid);
}
.agree .err {
  font: var(--tilw-type-meta);
  color: var(--tilw-status-error);
}
.closed {
  display: grid;
  gap: 22px;
}
.closed :deep(.ui-btn) {
  min-block-size: 52px;
  border-radius: 10px;
}
.alt {
  justify-self: start;
  color: var(--tilw-action-solid);
  font: 500 16px/24px var(--tilw-font-ar);
  text-decoration: none;
}
</style>
