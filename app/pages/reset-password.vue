<script setup lang="ts">
/**
 * Set a new password from the reset link (G2 — no Figma frame; built from the auth frame 6:62/6:101).
 * States: checking → form | expired | invalid. Success signs the user in. T022.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: () => `${t('auth.reset.title')} · tilwprompter` })

const route = useRoute()
const auth = useAuthStore()
const errorText = useErrorText()
const { show } = useToast()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const state = ref<'checking' | 'form' | 'expired' | 'invalid'>('checking')
const email = ref('')
const password = ref('')
const confirm = ref('')
const errors = reactive<{ password?: string; confirm?: string; form?: string }>({})
const busy = ref(false)

function fromError(e: unknown) {
  if (isPortError(e, 'token_expired')) state.value = 'expired'
  else if (isPortError(e, 'token_invalid')) state.value = 'invalid'
  else return false
  return true
}

onMounted(async () => {
  if (!token.value) return (state.value = 'invalid')
  try {
    email.value = (await useServices().auth.checkResetToken(token.value)).email
    state.value = 'form'
  } catch (e) {
    if (!fromError(e)) {
      state.value = 'form'
      errors.form = errorText(e)
    }
  }
})

async function submit() {
  errors.password = password.value.length < PASSWORD_MIN ? t('auth.passwordMin', { min: PASSWORD_MIN }) : undefined
  errors.confirm = !errors.password && confirm.value !== password.value ? t('auth.passwordMismatch') : undefined
  errors.form = undefined
  if (errors.password || errors.confirm || busy.value) return
  busy.value = true
  try {
    auth.setUser(await useServices().auth.resetPassword({ token: token.value, password: password.value }))
    show(t('auth.reset.done'))
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
    <p v-if="state === 'checking'" class="checking" role="status">{{ t('auth.reset.checking') }}</p>

    <template v-else-if="state === 'form'">
      <AuthHeading icon="field-lock" :title="t('auth.reset.title')">
        <i18n-t keypath="auth.reset.lede" tag="p" class="lede" scope="global">
          <template #email><bdi>{{ email }}</bdi></template>
        </i18n-t>
      </AuthHeading>
      <AuthForm :error="errors.form" @submit="submit">
        <input type="email" :value="email" autocomplete="username" hidden readonly>
        <UiField
          v-model="password"
          :label="t('auth.reset.new')"
          type="password"
          name="new-password"
          autocomplete="new-password"
          icon="field-lock"
          :hint="t('auth.passwordMin', { min: PASSWORD_MIN })"
          :error="errors.password"
          autofocus
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
        <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('auth.reset.submit') }}</UiButton>
      </AuthForm>
    </template>

    <div v-else class="dead">
      <AuthHeading
        icon="clock"
        :title="state === 'expired' ? t('auth.reset.expiredTitle') : t('auth.reset.invalidTitle')"
        :lede="state === 'expired' ? t('auth.reset.expiredLede') : t('auth.reset.invalidLede')"
      />
      <UiButton to="/forgot-password" block icon-end="arrow-action">{{ t('auth.reset.requestNew') }}</UiButton>
      <NuxtLink to="/signin" class="alt">{{ t('auth.recovery.backToSignIn') }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.checking {
  color: var(--tilw-text-muted);
  font: var(--tilw-type-body);
}
.lede {
  font: 400 18px/29px var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.lede bdi {
  color: var(--tilw-text-ink);
  font-family: var(--tilw-font-lat);
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
