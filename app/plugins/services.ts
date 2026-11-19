/**
 * Provides the service ports as `$services` (use `useServices()`). Phase 1 always uses the mock;
 * `servicesMode: 'http'` is reserved for the Laravel adapter.
 *
 * Every port call is wrapped: an `unauthenticated` rejection (session ended elsewhere) clears the
 * session and sends the user to sign in, returning them to the same page afterwards (T025).
 */
import type { Services } from '~/services/ports'
import { createMockServices, type MockBackend } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { isPortError } from '~/services/types'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  if (config.public.servicesMode !== 'mock') {
    throw new Error(`servicesMode "${config.public.servicesMode}" is not implemented yet (Phase 1 is mock only).`)
  }

  // During prerender there is no localStorage; the app pages render client-side anyway.
  const kv = import.meta.client ? window.localStorage : memoryKV()
  const mock = createMockServices(kv, { origin: import.meta.client ? window.location.origin : '' })

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
    auth: mock.services.auth,
    waitlist: mock.services.waitlist,
    scripts: guard(mock.services.scripts),
    account: guard(mock.services.account),
    legacy: guard(mock.services.legacy),
  }

  return {
    provide: {
      services,
      mock: mock as MockBackend,
    },
  }
})
