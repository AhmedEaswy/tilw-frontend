<script setup lang="ts">
/** Sign in · existing member (6:62, phone 6:100). T020. */
import { isPortError } from '~/services/types'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: () => `${t('auth.signIn')} · tilwprompter` })

const auth = useAuthStore()
const route = useRoute()
const errorText = useErrorText()
const { show } = useToast()

const email = ref('')
const password = ref('')
const errors = reactive<{ email?: string; password?: string; form?: string }>({})
const busy = ref(false)
const passwordField = ref<{ focus: () => void }>()

/** Only return to in-app paths, never to another site. */
function nextPath() {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/app') && !n.startsWith('//') ? n : '/app/scripts'
}

function validate() {
  errors.email = !email.value.trim() ? t('auth.emailRequired') : !isEmail(email.value) ? t('auth.emailInvalid') : undefined
  errors.password = !password.value ? t('auth.passwordRequired') : undefined
  errors.form = undefined
  return !errors.email && !errors.password
}

async function submit() {
  if (busy.value || !validate()) return
  busy.value = true
  try {
    const u = await auth.signIn(email.value.trim(), password.value)
    show(t('auth.welcomeBack', { name: u.name }))
    await navigateTo(nextPath(), { replace: true })
  } catch (e) {
    if (isPortError(e, 'invalid_credentials')) {
      password.value = ''
      passwordField.value?.focus()
    }
    errors.form = errorText(e, { invalid_credentials: t('auth.badCredentials') })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <AuthHeading :title="t('auth.signIn')" :lede="t('auth.signInLede')" />
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
      <UiField
        ref="passwordField"
        v-model="password"
        :label="t('auth.password')"
        type="password"
        name="password"
        autocomplete="current-password"
        placeholder="••••••••"
        icon="field-lock"
        :error="errors.password"
      >
        <template #aside>
          <NuxtLink to="/forgot-password" class="forgot">{{ t('auth.forgot') }}</NuxtLink>
        </template>
      </UiField>
      <UiButton type="submit" block :loading="busy" icon-end="arrow-action">{{ t('auth.signIn') }}</UiButton>
      <template #footer>
        <span>{{ t('auth.noAccount') }}</span>
        <NuxtLink to="/waitlist">{{ t('auth.joinWaitlist') }}</NuxtLink>
      </template>
    </AuthForm>
  </div>
</template>

<style scoped>
.forgot {
  font: 500 14px/22px var(--tilw-font-ar);
  color: var(--tilw-action-solid);
  text-decoration: none;
}
.forgot:hover {
  text-decoration: underline;
}
</style>
