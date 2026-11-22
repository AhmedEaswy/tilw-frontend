/**
 * Provides the service ports as `$services` (use `useServices()`): the in-browser mock by default, or the Laravel
 * API adapter with `servicesMode: 'http'` (NUXT_PUBLIC_SERVICES_MODE=http, NUXT_PUBLIC_API_BASE_URL=...).
 *
 * Every port call is wrapped: an `unauthenticated` rejection (session ended elsewhere) clears the
 * session and sends the user to sign in, returning them to the same page afterwards (T025).
 */
import type { Services } from '~/services/ports'
import { createHttpServices } from '~/services/http'
import { createMockServices, type MockBackend } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { isPortError } from '~/services/types'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const mode = config.public.servicesMode
  if (mode !== 'mock' && mode !== 'http') {
    throw new Error(`Unknown servicesMode "${mode}" (use "mock" or "http").`)
  }

  // Mock: during prerender there is no localStorage; the app pages render client-side anyway.
  const kv = import.meta.client ? window.localStorage : memoryKV()
  const mock = mode === 'mock'
    ? createMockServices(kv, { origin: import.meta.client ? window.location.origin : '' })
    : null
  const base: Services = mock
    ? mock.services
    : createHttpServices({ baseUrl: config.public.apiBaseUrl as string }).services

  let redirecting = false
  async function onUnauthenticated() {
    if (redirecting || !import.meta.client) return
    const route = nuxtApp.$router.currentRoute.value
    if (!route.path.startsWith('/app')) return
    redirecting = true
    await nuxtApp.runWithContext(async () => {
      useAuthStore().setUser(null)
      useToast().show((nuxtApp.$i18n as { t: (k: string) => string }).t('errors.sessionEnded'), 'info')
      await navigateTo({ path: '/signin', query: { next: route.fullPath } }, { replace: true })
    })
    redirecting = false
  }

  function guard<T extends object>(port: T): T {
    return new Proxy(port, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) =>
          (value as (...a: unknown[]) => Promise<unknown>).apply(target, args).catch((e: unknown) => {
            if (isPortError(e, 'unauthenticated')) void onUnauthenticated()
            throw e
          })
      },
    })
  }

  const services: Services = {
    auth: base.auth,
    waitlist: base.waitlist,
    scripts: guard(base.scripts),
    account: guard(base.account),
    legacy: guard(base.legacy),
  }

  return {
    provide: {
      services,
      // Only the mock has knobs and an outbox (the /__mock dev page); null when talking to the real API.
      mock: mock as MockBackend | null,
    },
  }
})
