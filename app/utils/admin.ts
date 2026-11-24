/**
 * Feature 006: pure helpers for the admin console (unit-tested in tests/unit/admin-logic.test.ts).
 * - `actionAvailability`: which account actions the user detail offers, and why one is disabled (research R11).
 * - Money, numbers and times with Latin digits in both languages (gaps G-D5).
 * - Converting between the page address and filters (research R5).
 */
import type { AdminUserDetail } from '~/services/types'

export type ActionKey =
  | 'suspend' | 'unsuspend' | 'reset' | 'changePlan' | 'credits' | 'makeAdmin' | 'revokeAdmin' | 'scheduleDeletion' | 'cancelDeletion'

export interface Availability {
  /** Shown at all (e.g. Unsuspend only for a suspended person). */
  shown: boolean
  enabled: boolean
  /** i18n key under `admin.detail.why` when disabled. */
  why?: 'self' | 'isAdmin' | 'notActive'
}

/**
 * What the service would refuse, shown before it refuses (FR-010): the admin's own account (they use their own
 * settings), another admin (remove the flag first), and making a suspended or leaving person an admin. The last-admin
 * rule is left to the service: the console doesn't know how many admins there are without another call.
 */
export function actionAvailability(d: Pick<AdminUserDetail, 'id' | 'isAdmin' | 'status' | 'suspension' | 'deletionDueAt'>, meId: string | null | undefined): Record<ActionKey, Availability> {
  const self = d.id === meId
  const suspended = !!d.suspension
  const leaving = !!d.deletionDueAt
  const on = (shown: boolean, why?: Availability['why']): Availability => (why ? { shown, enabled: false, why } : { shown, enabled: true })
  return {
    suspend: on(!suspended, self ? 'self' : d.isAdmin ? 'isAdmin' : undefined),
    unsuspend: on(suspended),
    reset: on(true, self ? 'self' : undefined),
    changePlan: on(true),
    credits: on(true),
    makeAdmin: on(!d.isAdmin, suspended || leaving ? 'notActive' : undefined),
    revokeAdmin: on(d.isAdmin, self ? 'self' : undefined),
    scheduleDeletion: on(!leaving, self ? 'self' : d.isAdmin ? 'isAdmin' : undefined),
    cancelDeletion: on(leaving),
  }
}

/** Typed confirmation (owner decision): the email must match, ignoring case and surrounding spaces. */
export const confirmsEmail = (typed: string, email: string) => typed.trim().toLowerCase() === email.trim().toLowerCase()

const tag = (locale: string) => (locale === 'ar' ? 'ar-u-nu-latn' : 'en')

/** "$1,184" / "$412.50": US dollars from cents, Latin digits, cents only when there are any. */
export function money(cents: number): string {
  const whole = cents % 100 === 0
  return `${cents < 0 ? '−' : ''}$${new Intl.NumberFormat('en', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)}`
}

export const num = (n: number) => new Intl.NumberFormat('en').format(n)

/** "24 Nov 2026, 10:41" in the admin's time zone. */
export function dateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function dateOnly(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

/** Full UTC time, for the `title` on hover. */
export const utc = (iso: string | null | undefined) => (iso ? `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC` : '')

/** `YYYY-MM-DD` (from a date input) → start of that UTC day; `end` → start of the next day (exclusive end). */
export function dayToIso(day: string | undefined, end = false): string | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined
  const t = Date.parse(`${day}T00:00:00.000Z`)
  return new Date(end ? t + 86_400_000 : t).toISOString()
}

/** Reads string filters from the page address, keeping only the given keys and allowed values. */
export function readQuery<K extends string>(q: Record<string, unknown>, keys: readonly K[], allowed: Partial<Record<K, readonly string[]>> = {}): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {}
  for (const k of keys) {
    const v = Array.isArray(q[k]) ? (q[k] as unknown[])[0] : q[k]
    if (typeof v !== 'string' || !v) continue
    const ok = allowed[k]
    if (ok && !ok.includes(v)) continue
    out[k] = v
  }
  return out
}

/** The address query for a set of filters: empty values are left out. */
export function toQuery(filters: Record<string, string | number | boolean | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '') out[k] = String(v)
  return out
}

/** One idempotency key per credits form opening (backend: a repeat applies once). */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** `user.suspend` → `user_suspend` (the i18n key of an audit action). */
export const actionKey = (action: string) => action.replace(/[^a-z0-9]+/gi, '_')
