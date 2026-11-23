import { defineStore } from 'pinia'
import type { MyPlan, Plan, UpgradePeriod } from '~/services/types'

/** Refetch the plan on window focus at most this often (research §3). */
const FOCUS_REFRESH_MS = 60_000

/**
 * The person's plan, effective limits and pending upgrade request (release 2, US1–US2). The service decides every
 * limit; the app only reads them (the recording cap is the one value applied on the device, research §3).
 */
export const usePlanStore = defineStore('plan', () => {
  const plans = ref<Plan[]>([])
  const my = ref<MyPlan | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)
  /** One-time notice from the last read (`pro_started` / `pro_ended`), until a screen shows it. */
  const notice = ref<'pro_started' | 'pro_ended' | null>(null)
  let loadedAt = 0
  const clock = useClock()
  let inflight: Promise<void> | null = null

  /** The effective value of a limit, or `undefined` while unknown (not loaded, or a kind the app doesn't know). */
  function limit(key: string): number | boolean | string[] | null | undefined {
    const l = my.value?.limits.find(x => x.key === key)
    return l ? l.value : undefined
  }
  function usage(key: string): number | null | undefined {
    return my.value?.limits.find(x => x.key === key)?.usage
  }
  const isPro = computed(() => !!my.value && my.value.plan.key !== 'free')
  /** Days until Pro ends (ceil), or null when not on a paid plan or no end date. */
  const daysLeft = computed(() => {
    const end = my.value?.endsAt
    if (!isPro.value || !end) return null
    void loadedAt // recomputed after each read
    return Math.max(0, Math.ceil((Date.parse(end) - clock()) / 86_400_000))
  })

  function load(): Promise<void> {
    inflight ??= (async () => {
      loading.value = true
      try {
        const next = await useServices().plans.myPlan()
        my.value = next
        if (next.notice) notice.value = next.notice
        error.value = null
        loadedAt = Date.now()
      } catch (e) {
        error.value = e
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  async function loadPublic() {
    plans.value = await useServices().plans.listPlans()
    return plans.value
  }

  /** Refetch when the tab gets focus again, at most once a minute. */
  function refreshIfStale() {
    if (my.value && Date.now() - loadedAt < FOCUS_REFRESH_MS) return
    return load()
  }

  async function requestUpgrade(period: UpgradePeriod, plan = 'pro') {
    const res = await useServices().plans.requestUpgrade({ plan, period })
    if (my.value) my.value = { ...my.value, pendingRequest: res.request }
    return res
  }

  async function cancelRequest() {
    await useServices().plans.cancelRequest()
    if (my.value) my.value = { ...my.value, pendingRequest: null }
  }

  function consumeNotice() {
    const n = notice.value
    notice.value = null
    return n
  }

  function reset() {
    my.value = null
    notice.value = null
    loadedAt = 0
  }

  return { plans, my, loading, error, notice, isPro, daysLeft, limit, usage, load, loadPublic, refreshIfStale, requestUpgrade, cancelRequest, consumeNotice, reset }
})
