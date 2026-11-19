<script setup lang="ts">
/**
 * Accept an invitation and create the account (G1 — no Figma frame; built from the auth frame 6:62).
 * States: checking → form | expired | invalid. Success signs in and opens the (empty) library. T030–T032.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: () => `${t('auth.invite.title')} · tilwprompter` })

const route = useRoute()
const auth = useAuthStore()
const errorText = useErrorText()
const { show } = useToast()

const token = computed(() => String(route.params.token ?? ''))
const state = ref<'checking' | 'form' | 'expired' | 'invalid'>('checking')
const email = ref('')
const name = ref('')
const password = ref('')
const confirm = ref('')
const agreed = ref(false)
const errors = reactive<{ name?: string; password?: string; confirm?: string; agree?: string; form?: string }>({})
const busy = ref(false)

function fromError(e: unknown) {
  if (isPortError(e, 'token_expired')) state.value = 'expired'
  else if (isPortError(e, 'token_invalid')) state.value = 'invalid'
  else return false
  return true
}

onMounted(async () => {
  // Already signed in on this browser: the invite can't be for this session, so go to the app.
  await auth.init()
  if (auth.status === 'authed') return navigateTo('/app/scripts', { replace: true })
  try {
    email.value = (await useServices().auth.checkInvite(token.value)).email
    state.value = 'form'
  } catch (e) {
    if (!fromError(e)) {
      state.value = 'form'
      errors.form = errorText(e)
    }
  }
})

async function submit() {
  errors.name = !name.value.trim() ? t('auth.nameRequired') : undefined
  errors.password = password.value.length < PASSWORD_MIN ? t('auth.passwordMin', { min: PASSWORD_MIN }) : undefined
  errors.confirm = !errors.password && confirm.value !== password.value ? t('auth.passwordMismatch') : undefined
  errors.agree = !agreed.value ? t('auth.invite.agreeRequired') : undefined
  errors.form = undefined
  if (errors.name || errors.password || errors.confirm || errors.agree || busy.value) return
  busy.value = true
  try {
    const u = await useServices().auth.acceptInvite({ token: token.value, name: name.value, password: password.value })
    auth.setUser(u)
    show(t('auth.invite.welcome', { name: u.name }))
    await navigateTo('/app/scripts', { replace: true })
  } catch (e) {
    if (!fromError(e)) errors.form = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="state === 'checking'" class="checking" role="status">{{ t('common.loading') }}</p>

    <template v-else-if="state === 'form'">
      <AuthHeading icon="mail-check" :title="t('auth.invite.title')" :lede="t('auth.invite.lede')" />
      <AuthForm :error="errors.form" @submit="submit">
        <UiField :model-value="email" :label="t('auth.email')" type="email" name="email" autocomplete="username" icon="field-mail" readonly />
        <UiField
          v-model="name"
          :label="t('auth.invite.name')"
          name="name"
          autocomplete="name"
          :placeholder="t('auth.invite.namePlaceholder')"
          :maxlength="80"
          :error="errors.name"
          autofocus
        />
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
        <UiField
          v-model="confirm"
          :label="t('auth.reset.confirm')"
          type="password"
          name="confirm-password"
          autocomplete="new-password"
          icon="field-lock"
          :error="errors.confirm"
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
        <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('auth.invite.submit') }}</UiButton>
      </AuthForm>
    </template>

    <div v-else class="dead">
      <AuthHeading
        icon="clock"
        :title="state === 'expired' ? t('auth.invite.expiredTitle') : t('auth.invite.invalidTitle')"
        :lede="state === 'expired' ? t('auth.invite.expiredLede') : t('auth.invite.invalidLede')"
      />
      <UiButton :to="state === 'expired' ? '/waitlist' : '/signin'" block icon-end="arrow-action">
        {{ state === 'expired' ? t('auth.joinWaitlist') : t('auth.signIn') }}
      </UiButton>
      <NuxtLink v-if="state === 'expired'" to="/signin" class="alt">{{ t('auth.invite.haveAccount') }}</NuxtLink>
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
.dead {
  display: grid;
  gap: 22px;
}
.dead :deep(.ui-btn) {
  min-block-size: 52px;
  border-radius: 10px;
}
.alt {
  justify-self: start;
  color: var(--tilw-action-solid);
  font: 500 16px/24px var(--tilw-font-ar);
  text-decoration: none;
}
.alt:hover {
  text-decoration: underline;
}
</style>
