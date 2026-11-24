<script setup lang="ts">
/**
 * Confirm an email change from the link sent to the new address (R2-10 `264:1125` success, `264:1144` expired), in
 * the task-card layout (6:66). Public: the link may be opened in a browser where nobody is signed in. When someone is
 * signed in here, their profile is refreshed with the new address.
 */
import { isPortError } from '~/services/types'

definePageMeta({ layout: false })
const { t, localeProperties } = useI18n()
useHead({ title: () => `${t('email.confirmTitle')} · tilwprompter`, htmlAttrs: { dir: () => localeProperties.value.dir ?? 'rtl' } })

type ConfirmState = 'checking' | 'done' | 'expired' | 'invalid' | 'error'
interface ConfirmResult { state: ConfirmState; email: string }

const route = useRoute()
const auth = useAuthStore()
const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & { _emailConfirm?: Record<string, Promise<ConfirmResult>> }
const result = ref<ConfirmResult>({ state: 'checking', email: '' })
const state = computed(() => result.value.state)
const email = computed(() => result.value.email)

async function confirm(token: string): Promise<ConfirmResult> {
  try {
    const { email: confirmed } = await useServices().auth.confirmEmail(token)
    return { state: 'done', email: confirmed }
  } catch (e) {
    return { state: isPortError(e, 'token_expired') ? 'expired' : isPortError(e, 'token_invalid') ? 'invalid' : 'error', email: '' }
  }
}

// The page is prerendered without a query, so the token is read once mounted (as reset-password does). One request per
// token and page load: a remount reuses the first answer instead of spending the used token again.
onMounted(async () => {
  // While a prerendered page hydrates, the route can still be the prerendered one (no query), so read the address bar.
  const token = new URLSearchParams(window.location.search).get('token') ?? (typeof route.query.token === 'string' ? route.query.token : '')
  if (!token) return void (result.value = { state: 'invalid', email: '' })
  const inflight = (nuxtApp._emailConfirm ??= {})
  result.value = await (inflight[token] ??= confirm(token))
  if (result.value.state !== 'done') return
  await auth.init()
  if (auth.status === 'authed') auth.setUser(await useServices().auth.me())
})

const signedIn = computed(() => auth.status === 'authed')
</script>

<template>
  <main class="confirm">
    <NuxtLink to="/" class="brand" aria-label="tilwprompter"><BrandSignature :width="143" /></NuxtLink>

    <div v-if="state === 'checking'" class="wait" aria-busy="true"><UiSkeleton h="260px" r="16px" /></div>

    <TaskCard v-else-if="state === 'done'" :kicker="t('settings.account')" :title="t('email.confirmedTitle')" :lede="t('email.confirmedLede', { email })">
      <template #actions>
        <UiButton :to="signedIn ? '/app/settings/account' : '/signin'">{{ signedIn ? t('email.toAccount') : t('auth.signIn') }}</UiButton>
      </template>
    </TaskCard>

    <TaskCard
      v-else
      :kicker="t('settings.account')"
      :title="state === 'expired' ? t('email.expiredTitle') : state === 'invalid' ? t('email.invalidTitle') : t('errors.unknown')"
      :lede="state === 'expired' ? t('email.expiredLede') : t('email.invalidLede')"
    >
      <template #actions>
        <UiButton :to="signedIn ? '/app/settings/account' : '/signin'">{{ signedIn ? t('email.requestNew') : t('auth.signIn') }}</UiButton>
      </template>
    </TaskCard>
  </main>
</template>

<style scoped>
.confirm {
  min-block-size: 100dvh;
  padding: 32px 16px;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.brand {
  display: block;
  inline-size: fit-content;
  margin-inline: auto;
}
.wait {
  inline-size: min(628px, 100%);
  margin: 70px auto;
}
</style>
