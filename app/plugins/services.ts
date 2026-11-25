/**
 * Provides the service ports as `$services` (use `useServices()`): the in-browser mock by default, or the Laravel
 * API adapter with `servicesMode: 'http'` (NUXT_PUBLIC_SERVICES_MODE=http, NUXT_PUBLIC_API_BASE_URL=...).
 *
 * Every port call is wrapped: an `unauthenticated` rejection (session ended elsewhere) clears the
 * session and sends the user to sign in, returning them to the same page afterwards (T025).
 */
import type { Services } from '~/services/ports'
import { createHttpServices } from '~/services/http'
import type { MockBackend } from '~/services/mock'
import { isPortError, type RealtimeSettings } from '~/services/types'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const mode = config.public.servicesMode
  if (mode !== 'mock' && mode !== 'http') {
    throw new Error(`Unknown servicesMode "${mode}" (use "mock" or "http").`)
  }

  // A path base (`/_api`, the dev proxy) needs the page's origin when fetching on the server.
  // (Read before the `await` below: composables need the Nuxt context, which an await may drop on the server.)
  const apiBase = config.public.apiBaseUrl as string
  const baseUrl = apiBase.startsWith('/') && import.meta.server ? useRequestURL().origin + apiBase : apiBase
  // Mock: loaded only in mock mode (feature 006 review, gaps G-D10), so an HTTP build never ships the in-browser
  // backend in its entry chunk. During prerender there is no localStorage; the app pages render client-side anyway.
  let mock: MockBackend | null = null
  if (mode === 'mock') {
    const [{ createMockServices }, { memoryKV }] = await Promise.all([import('~/services/mock'), import('~/services/mock/db')])
    const kv = import.meta.client ? window.localStorage : memoryKV()
    mock = createMockServices(kv, {
      origin: import.meta.client ? window.location.origin : '',
      locale: (): 'ar' | 'en' => ((nuxtApp.$i18n as unknown as { locale: { value: string } } | undefined)?.locale.value === 'en' ? 'en' : 'ar'),
    })
  }
  // G-A5: in the mock, dictation hears a scripted recognizer (or none, per the /__mock knob) instead of the microphone.
  if (mock && import.meta.client) {
    const { installMockRecognition } = await import('~/services/mock/recognition')
    installMockRecognition(window as unknown as Window & Record<string, unknown>, window.localStorage)
  }
  // Release 2: another tab of the mock may upload or change plans; pick up what it wrote (the real API needs nothing).
  if (mock && import.meta.client) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'tilw:mock:v1' || e.key === 'tilw:mock:knobs') mock.db.reload()
    })
  }
  const base: Services = mock
    ? mock.services
    : createHttpServices({ baseUrl, realtime: (config.public.realtime as RealtimeSettings | undefined) ?? null }).services

  let redirecting = false
  /**
   * The session ended (or, feature 006, the account was suspended: the API ends the session with `account_suspended`
   * on any signed-in call). Studio and admin pages go to sign-in; a suspension says so there instead of a toast.
   */
  async function onUnauthenticated(suspended = false) {
    if (redirecting || !import.meta.client) return
    const route = nuxtApp.$router.currentRoute.value
    if (!route.path.startsWith('/app') && !route.path.startsWith('/admin')) return
    redirecting = true
    await nuxtApp.runWithContext(async () => {
      useAuthStore().setUser(null)
      if (suspended) {
        await navigateTo({ path: '/signin', query: { suspended: '1' } }, { replace: true })
      } else {
        useToast().show((nuxtApp.$i18n as { t: (k: string) => string }).t('errors.sessionEnded'), 'info')
        await navigateTo({ path: '/signin', query: { next: route.fullPath } }, { replace: true })
      }
    })
    redirecting = false
  }

  function guard<T extends object>(port: T): T {
    return new Proxy(port, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          const out = (value as (...a: unknown[]) => unknown).apply(target, args)
          // Synchronous members (StoragePort.uploader) pass straight through.
          if (!out || typeof (out as Promise<unknown>).catch !== 'function') return out
          return (out as Promise<unknown>).catch((e: unknown) => {
            if (isPortError(e, 'unauthenticated')) void onUnauthenticated()
            else if (isPortError(e, 'account_suspended')) void onUnauthenticated(true)
            throw e
          })
        }
      },
    })
  }

  const services: Services = {
    auth: base.auth,
    waitlist: base.waitlist,
    scripts: guard(base.scripts),
    account: guard(base.account),
    admin: guard(base.admin),
    legacy: guard(base.legacy),
    plans: guard(base.plans),
    storage: guard(base.storage),
    remoteTakes: guard(base.remoteTakes),
    // Feature 004: the owner's link actions behave like any account port; the relay and the live channel are also
    // used by the phone, which has no session, so a 401 there means "pairing gone", not "sign in again".
    links: guard(base.links),
    relay: base.relay,
    realtime: base.realtime,
    // Feature 005: AI routes behave like any account port; the speech port talks to the provider only.
    ai: guard(base.ai),
    speech: base.speech,
    // Feature 006: public settings need no sign-in.
    settings: base.settings,
    // Feature 007: a practice run is logged in the background; a failure never signs anyone out from here.
    practice: base.practice,
  }

  return {
    provide: {
      services,
      // Feature 004: the link host's own background checks, without the sign-in redirect (it could stop a take).
      servicesQuiet: { links: base.links } as Pick<Services, 'links'>,
      // Only the mock has knobs and an outbox (the /__mock dev page); null when talking to the real API.
      mock: mock as MockBackend | null,
    },
  }
})
