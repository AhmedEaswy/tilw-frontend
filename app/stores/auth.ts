import { defineStore } from 'pinia'
import type { User } from '~/services/types'

/** Session state. `status` is 'unknown' until the first `init()` resolves on the client. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const status = ref<'unknown' | 'guest' | 'authed'>('unknown')
  let pending: Promise<void> | null = null

  function setUser(u: User | null) {
    user.value = u
    status.value = u ? 'authed' : 'guest'
  }

  /** Resolve the session once; later calls reuse the same promise. */
  function init() {
    if (status.value !== 'unknown') return Promise.resolve()
    pending ??= useServices()
      .auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => (pending = null))
    return pending
  }

  async function signIn(email: string, password: string) {
    setUser(await useServices().auth.signIn({ email, password }))
    return user.value!
  }

  async function signOut() {
    await useServices().auth.signOut()
    setUser(null)
  }

  return { user, status, init, setUser, signIn, signOut }
})
