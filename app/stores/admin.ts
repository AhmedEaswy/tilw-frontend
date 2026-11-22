import { defineStore } from 'pinia'
import type { Invitation, WaitlistEntry } from '~/services/types'

/** Waitlist and invitations for the admin pages. Every change reloads both, since an invitation also flips the waitlist row. */
export const useAdminStore = defineStore('admin', () => {
  const waitlist = ref<WaitlistEntry[] | null>(null)
  const invitations = ref<Invitation[] | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  const waitingCount = computed(() => (waitlist.value ?? []).filter(w => !w.invited).length)
  const pendingCount = computed(() => (invitations.value ?? []).filter(i => i.state === 'pending').length)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const api = useServices().admin
      const [w, i] = await Promise.all([api.waitlist(), api.invitations()])
      waitlist.value = w
      invitations.value = i
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  async function invite(email: string) {
    const created = await useServices().admin.invite({ email })
    await load()
    return created
  }

  async function resend(id: string) {
    await useServices().admin.resend(id)
    await load()
  }

  async function withdraw(id: string) {
    await useServices().admin.withdraw(id)
    await load()
  }

  return { waitlist, invitations, loading, error, waitingCount, pendingCount, load, invite, resend, withdraw }
})
