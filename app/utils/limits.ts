/**
 * Release 2 (US1): what the app says when the service refuses an action with `limit_reached` (research §2).
 * Pure so it can be unit-tested; `useLimitError()` turns it into the R2-2 dialog.
 */
import type { LimitInfo } from '~/services/types'

/** The fixing action the dialog offers besides "Upgrade to Pro". */
export type LimitAction = 'archive' | 'shorten' | 'none'

export interface LimitCopy {
  /** i18n keys under `limits.dialog.*`. */
  title: string
  text: string
  params: Record<string, string | number>
  action: LimitAction
  /** Offer "Upgrade to Pro" (hidden for people already on Pro). */
  upgrade: boolean
}

/** Limit kinds the app knows how to show. Others stay hidden on Plan & usage (spec US1 #5). */
export const KNOWN_LIMITS = ['scripts.max_active', 'scripts.max_words', 'takes.max_minutes', 'storage.auto_sync', 'history.versions', 'history.days'] as const

/** Shown later, once their features ship (AI credits: feature 004, phone link: 003). */
export const FUTURE_LIMITS = ['ai.credits_monthly', 'phone_link.allowed', 'byok.allowed'] as const

const num = (v: unknown) => (typeof v === 'number' ? v : 0)

export function describeLimit(limit: LimitInfo | undefined | null): LimitCopy {
  const value = num(limit?.value)
  const usage = limit?.usage ?? 0
  switch (limit?.key) {
    case 'scripts.max_active':
      return { title: 'limits.dialog.activeTitle', text: 'limits.dialog.activeText', params: { value, usage }, action: 'archive', upgrade: true }
    case 'scripts.max_words':
      return { title: 'limits.dialog.wordsTitle', text: 'limits.dialog.wordsText', params: { value, usage }, action: 'shorten', upgrade: true }
    case 'takes.max_minutes':
      return { title: 'limits.dialog.minutesTitle', text: 'limits.dialog.minutesText', params: { value, usage }, action: 'none', upgrade: true }
    case 'storage.auto_sync':
      return { title: 'limits.dialog.autoSyncTitle', text: 'limits.dialog.autoSyncText', params: {}, action: 'none', upgrade: true }
    case 'storage.providers':
      return { title: 'limits.dialog.providersTitle', text: 'limits.dialog.providersText', params: {}, action: 'none', upgrade: true }
    default:
      return { title: 'limits.dialog.genericTitle', text: 'limits.dialog.genericText', params: {}, action: 'none', upgrade: true }
  }
}

/** Share of a counted limit in use, 0..1; null when the limit is unlimited or not counted. */
export function usageRatio(value: unknown, usage: number | null | undefined): number | null {
  if (typeof value !== 'number' || value <= 0 || typeof usage !== 'number') return null
  return Math.min(1, usage / value)
}

/** Meters turn to the warning colour at 80 % and above (spec US1 #1). */
export const WARN_AT = 0.8
