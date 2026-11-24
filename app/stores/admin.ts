import { defineStore } from 'pinia'
import type { AdminPlan, AdminUserDetail, AuditAction, Invitation, WaitlistEntry } from '~/services/types'

/**
 * Admin console (feature 006): lists shared by several pages, loaded once per visit (plans for the plan filters and
 * dialogs, the audit action names) plus the waitlist and invitations, which change each other (an invitation flips the
 * waitlist row), so every change reloads both.
 */
export const useAdminStore = defineStore('admin', () => {
  const waitlist = ref<WaitlistEntry[] | null>(null)
  const invitations = ref<Invitation[] | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)
  const waitFilter = ref<{ q?: string; invited?: boolean }>({})

  const plans = ref<AdminPlan[] | null>(null)
  const actions = ref<AuditAction[] | null>(null)

  const waitingCount = computed(() => (waitlist.value ?? []).filter(w => !w.invited && !w.hasAccount).length)
  const pendingCount = computed(() => (invitations.value ?? []).filter(i => i.state === 'pending').length)

  async function load(filter = waitFilter.value) {
    waitFilter.value = filter
    loading.value = true
    error.value = null
    try {
      const api = useServices().admin
      const [w, i] = await Promise.all([api.waitlist(filter), api.invitations()])
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
  async function removeWaitlist(id: string) {
    await useServices().admin.removeWaitlist(id)
    await load()
  }

  async function loadPlans(force = false) {
    if (plans.value && !force) return plans.value
    plans.value = await useServices().admin.plans()
    return plans.value
  }
  async function loadActions() {
    actions.value ??= await useServices().admin.auditActions()
    return actions.value
  }

  function reset() {
    waitlist.value = null
    invitations.value = null
    plans.value = null
    actions.value = null
  }

  return { waitlist, invitations, loading, error, waitingCount, pendingCount, plans, actions, load, invite, resend, withdraw, removeWaitlist, loadPlans, loadActions, reset }
})

/** The person open in the user detail. Every action answers the person's new state, which replaces `detail`. */
export const useAdminUserStore = defineStore('adminUser', () => {
  const detail = ref<AdminUserDetail | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)
  /** The person no longer exists (deleted while the page was open). */
  const gone = ref(false)
  const busy = ref<string | null>(null)

  async function open(id: string) {
    if (detail.value?.id !== id) detail.value = null
    gone.value = false
    loading.value = true
    error.value = null
    try {
      detail.value = await useServices().admin.user(id)
    } catch (e) {
      if (isNotFound(e)) gone.value = true
      else error.value = e
    } finally {
      loading.value = false
    }
  }

  /** Runs an action; on success the answer (if a detail) replaces the person, then any refusal reloads them. */
  async function act<T>(name: string, fn: () => Promise<T>): Promise<T> {
    busy.value = name
    try {
      const out = await fn()
      if (out && typeof out === 'object' && 'limits' in (out as object) && 'plan' in (out as object)) detail.value = out as unknown as AdminUserDetail
      else if (detail.value) detail.value = await useServices().admin.user(detail.value.id)
      return out
    } catch (e) {
      if (isNotFound(e)) gone.value = true
      else if (detail.value) void open(detail.value.id)
      throw e
    } finally {
      busy.value = null
    }
  }

  return { detail, loading, error, gone, busy, open, act }
})

function isNotFound(e: unknown) {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'not_found'
}
