import { defineStore } from 'pinia'
import { isPortError, type User } from '~/services/types'

/** Session state. `status` is 'unknown' until the first `init()` resolves on the client. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const status = ref<'unknown' | 'guest' | 'authed'>('unknown')
  /** Release 2: one-time notice from the last sign-in, shown by the app layout as a toast. */
  const notice = ref<'deletion_cancelled' | null>(null)
  /** Feature 006: the last session check found the account suspended (the sign-in page explains it). */
  const suspended = ref(false)
  let pending: Promise<void> | null = null

  function setUser(u: User | null) {
    // Another account (or none): drop the previous account's cached scripts.
    if (u?.id !== user.value?.id) {
      useScriptsStore().reset()
      usePlanStore().reset()
      useStorageStore().reset()
      // Feature 004: the previous account's link (socket, keep-alive, tab lock) goes with it.
      useLinkStore().reset()
      // Feature 005: credits, the masked key and waiting suggestions belong to that account.
      useAiStore().reset()
      // Feature 006: the admin console's cached lists belong to that admin.
      useAdminStore().reset()
    }
    user.value = u
    status.value = u ? 'authed' : 'guest'
  }

  /** Resolve the session once; later calls reuse the same promise. */
  function init() {
    if (status.value !== 'unknown') return Promise.resolve()
    pending ??= useServices()
      .auth.me()
      .then(setUser)
      // Only a "not signed in" answer means guest. A network error or a server error leaves the session unknown, so
      // the next init() (the next navigation) asks again instead of signing the person out.
      .catch((e: unknown) => {
        if (isPortError(e, 'unauthenticated')) setUser(null)
        // Feature 006: the API ends a suspended account's session with this code; sign-in then says why.
        if (isPortError(e, 'account_suspended')) {
          suspended.value = true
          setUser(null)
        }
      })
      .finally(() => (pending = null))
    return pending
  }

  /** Feature 006: public sign-up (only while sign-up is open). */
  async function signUp(input: { name: string; email: string; password: string; locale: 'ar' | 'en' }) {
    setUser(await useServices().auth.signUp(input))
    return user.value!
  }

  async function signIn(email: string, password: string) {
    setUser(await useServices().auth.signIn({ email, password }))
    notice.value = useServices().auth.lastNotice()
    return user.value!
  }

  async function signOut() {
    await useServices().auth.signOut()
    setUser(null)
  }

  function consumeNotice() {
    const n = notice.value
    notice.value = null
    return n
  }

  return { user, status, notice, suspended, init, setUser, signIn, signUp, signOut, consumeNotice }
})
