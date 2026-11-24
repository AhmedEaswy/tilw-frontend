/**
 * Plans and limits for the in-browser mock (release 2). Same catalogue and rules as the backend's PlanSeeder and
 * Limits class: effective value = personal override → plan in force → Free → the limit kind's default.
 */
import type { LimitValue, Locale, Plan } from '../types'

export type LimitType = 'int' | 'bool' | 'list'
export type RawLimit = number | boolean | string[] | null

export interface MockLimitDefinition {
  key: string
  type: LimitType
  default: RawLimit
  counted: boolean
  label: Record<Locale, string>
}

export interface MockPlan {
  key: string
  name: Record<Locale, string>
  priceMonthlyCents: number
  priceYearlyCents: number
  limits: Record<string, RawLimit>
}

export interface MockSubscription {
  id: string
  userId: string
  plan: string
  period: 'monthly' | 'yearly' | 'custom'
  startsAt: number
  endsAt: number
}

export const LIMIT_DEFINITIONS: MockLimitDefinition[] = [
  { key: 'scripts.max_active', type: 'int', default: null, counted: true, label: { ar: 'النصوص النشطة', en: 'Active scripts' } },
  { key: 'scripts.max_words', type: 'int', default: null, counted: true, label: { ar: 'كلمات النص الواحد', en: 'Words per script' } },
  { key: 'takes.max_minutes', type: 'int', default: null, counted: false, label: { ar: 'مدة المحاولة (دقائق)', en: 'Take length (minutes)' } },
  { key: 'ai.credits_monthly', type: 'int', default: 0, counted: false, label: { ar: 'رصيد الذكاء الاصطناعي الشهري', en: 'Monthly AI credits' } },
  { key: 'storage.auto_sync', type: 'bool', default: false, counted: false, label: { ar: 'المزامنة التلقائية', en: 'Automatic sync' } },
  { key: 'storage.providers', type: 'list', default: [], counted: false, label: { ar: 'مزودو التخزين', en: 'Storage providers' } },
  { key: 'history.versions', type: 'int', default: null, counted: false, label: { ar: 'عدد نسخ السجل', en: 'History versions' } },
  { key: 'history.days', type: 'int', default: null, counted: false, label: { ar: 'أيام السجل', en: 'History days' } },
  { key: 'ai.audio_max_minutes', type: 'int', default: 60, counted: false, label: { ar: 'أطول صوت للتحويل (دقائق)', en: 'Longest audio to transcribe (minutes)' } },
  { key: 'byok.allowed', type: 'bool', default: false, counted: false, label: { ar: 'مفاتيحك الخاصة للذكاء الاصطناعي', en: 'Your own AI keys' } },
  { key: 'phone_link.allowed', type: 'bool', default: false, counted: false, label: { ar: 'التحكم من الهاتف', en: 'Phone link' } },
]

export function seedPlans(): MockPlan[] {
  return [
    {
      key: 'free',
      name: { ar: 'مجانية', en: 'Free' },
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      limits: {
        'scripts.max_active': 20,
        'scripts.max_words': 50000,
        'takes.max_minutes': 10,
        'ai.credits_monthly': 20,
        'ai.audio_max_minutes': 60,
        'storage.auto_sync': false,
        'storage.providers': ['google_drive'],
        'history.versions': 5,
        'history.days': null,
        'byok.allowed': true,
        'phone_link.allowed': true,
      },
    },
    {
      key: 'pro',
      name: { ar: 'Pro', en: 'Pro' },
      priceMonthlyCents: 800,
      priceYearlyCents: 7700,
      limits: {
        'scripts.max_active': null,
        'scripts.max_words': null,
        'takes.max_minutes': 60,
        'ai.credits_monthly': 500,
        'ai.audio_max_minutes': 60,
        'storage.auto_sync': true,
        'storage.providers': ['google_drive'],
        'history.versions': null,
        'history.days': 365,
        'byok.allowed': true,
        'phone_link.allowed': true,
      },
    },
  ]
}

export interface LimitContext {
  definitions: MockLimitDefinition[]
  plans: MockPlan[]
  /** Key of the plan in force (Free when no subscription). */
  planKey: string
  overrides: Record<string, RawLimit>
  usage: (key: string) => number | null
}

/** The effective value of one limit. */
export function limitValue(ctx: LimitContext, key: string): RawLimit {
  if (key in ctx.overrides) return ctx.overrides[key] ?? null
  const plan = ctx.plans.find(p => p.key === ctx.planKey)
  if (plan && key in plan.limits) return plan.limits[key] ?? null
  const free = ctx.plans.find(p => p.key === 'free')
  if (free && key in free.limits) return free.limits[key] ?? null
  return ctx.definitions.find(d => d.key === key)?.default ?? null
}

/** Every limit kind with its effective value, as `GET /api/user/plan` lists them. */
export function allLimits(ctx: LimitContext, locale: Locale): LimitValue[] {
  return ctx.definitions.map(d => ({
    key: d.key,
    type: d.type,
    label: d.label[locale],
    value: limitValue(ctx, d.key),
    usage: d.counted ? ctx.usage(d.key) : null,
    overridden: d.key in ctx.overrides,
  }))
}

/** A plan as `GET /api/plans` shows it (plan values only, no person). */
export function publicPlan(p: MockPlan, definitions: MockLimitDefinition[], locale: Locale): Plan {
  return {
    key: p.key,
    name: p.name[locale],
    priceMonthlyCents: p.priceMonthlyCents,
    priceYearlyCents: p.priceYearlyCents,
    currency: 'USD',
    limits: definitions.map(d => ({
      key: d.key,
      type: d.type,
      label: d.label[locale],
      value: d.key in p.limits ? (p.limits[d.key] ?? null) : d.default,
      usage: null,
      overridden: false,
    })),
  }
}

/** "TLW-" + 4 characters without look-alikes (0/O, 1/I). */
export function requestReference(rand: () => number = Math.random): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return `TLW-${Array.from({ length: 4 }, () => abc[Math.floor(rand() * abc.length)]).join('')}`
}

/** Calendar end of a period started at `from` (monthly = +1 month, yearly = +1 year). */
export function periodEnd(from: number, period: 'monthly' | 'yearly'): number {
  const d = new Date(from)
  if (period === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.getTime()
}
