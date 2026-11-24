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
  const savedKey = () => {
    const id = useAuthStore().user?.id
    return id ? `tilw:plan-limits:${id}` : null
  }
  function readSaved(): Record<string, unknown> | null {
    const k = savedKey()
    if (!k || !import.meta.client) return null
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null')
    } catch {
      return null
    }
  }
  function writeSaved(m: MyPlan) {
    const k = savedKey()
    if (!k || !import.meta.client) return
    try {
      localStorage.setItem(k, JSON.stringify(Object.fromEntries(m.limits.map(l => [l.key, l.value]))))
    } catch { /* storage full or blocked: the in-memory plan still applies */ }
  }
  const clock = useClock()
  let inflight: Promise<void> | null = null

  /** The effective value of a limit, or `undefined` while unknown (not loaded, or a kind the app doesn't know). */
  function limit(key: string): number | boolean | string[] | null | undefined {
    const l = my.value?.limits.find(x => x.key === key)
    return l ? l.value : undefined
  }
  /**
   * Like `limit()`, but when the plan can't be read (offline, server error) it falls back to the value last read for
   * this account, kept in this browser. The studio uses it so a Pro take isn't cut to the Free length by a failed read.
   */
  function knownLimit(key: string): number | boolean | string[] | null | undefined {
    const v = limit(key)
    if (v !== undefined) return v
    const saved = readSaved()
    return saved && key in saved ? (saved[key] as number | boolean | string[] | null) : undefined
  }
  /** The plan was read, or the last read failed (then `knownLimit()` is the best guess). */
  const settled = computed(() => !!my.value || (!!error.value && !loading.value))
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
        writeSaved(next)
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
    error.value = null
    notice.value = null
    loadedAt = 0
  }

  return { plans, my, loading, error, notice, isPro, daysLeft, limit, knownLimit, settled, usage, load, loadPublic, refreshIfStale, requestUpgrade, cancelRequest, consumeNotice, reset }
})
