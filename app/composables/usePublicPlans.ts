import type { LimitValue, Plan } from '~/services/types'

/**
 * Release 2 (US4): plans for the prerendered landing page. The HTML is built with the starting values from runtime
 * config (so the section never shows a broken state); after hydration the live catalogue from the service replaces
 * them in place (FR-001, SC-006). If the service can't be reached, the fallback stays.
 */
type Fallback = Record<'free' | 'pro', { priceMonthlyCents: number; priceYearlyCents: number }>

/** The starting limits (backend PlanSeeder), only for the fallback lines. */
const FALLBACK_LIMITS: Record<'free' | 'pro', Record<string, LimitValue['value']>> = {
  free: { 'scripts.max_active': 20, 'takes.max_minutes': 10, 'storage.auto_sync': false, 'storage.providers': ['google_drive'], 'history.versions': 5, 'history.days': null },
  pro: { 'scripts.max_active': null, 'takes.max_minutes': 60, 'storage.auto_sync': true, 'storage.providers': ['google_drive'], 'history.versions': null, 'history.days': 365 },
}

export function fallbackPlans(fallback: Fallback): Plan[] {
  return (['free', 'pro'] as const).map(key => ({
    key,
    name: key === 'free' ? 'Free' : 'Pro',
    priceMonthlyCents: fallback[key].priceMonthlyCents,
    priceYearlyCents: fallback[key].priceYearlyCents,
    currency: 'USD' as const,
    limits: Object.entries(FALLBACK_LIMITS[key]).map(([k, value]) => ({
      key: k,
      type: typeof value === 'boolean' ? 'bool' as const : Array.isArray(value) ? 'list' as const : 'int' as const,
      label: k,
      value,
      usage: null,
      overridden: false,
    })),
  }))
}

export function usePublicPlans() {
  const config = useRuntimeConfig()
  const plans = ref<Plan[]>(fallbackPlans(config.public.landingPlansFallback as Fallback))
  const live = ref(false)

  onMounted(async () => {
    try {
      const list = await useServices().plans.listPlans()
      if (list.some(p => p.key === 'free') && list.some(p => p.key === 'pro')) {
        plans.value = list
        live.value = true
      }
    } catch { /* keep the baked-in prices */ }
  })

  return { plans, live }
}
