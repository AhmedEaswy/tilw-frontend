/**
 * The period an admin report covers, kept in the address: `?days=7|90|365` (30 is the default and leaves the address
 * clean), or a custom range `?from=YYYY-MM-DD&to=YYYY-MM-DD` of whole UTC days (backend AdminPeriod: at most 366 days,
 * not after today). Shared by the dashboard and Analytics so a link between them keeps the period.
 */
import type { AdminPeriodQuery } from '~/services/types'
import { dateOnly } from '~/utils/admin'

export const ADMIN_PERIODS = [7, 30, 90, 365] as const
export const ADMIN_PERIOD_MAX_DAYS = 366
const DAY = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export const todayUtc = () => new Date().toISOString().slice(0, 10)
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`)

/** A valid custom range, or null. */
export function parseRange(from: unknown, to: unknown, today = todayUtc()): { from: string; to: string } | null {
  if (typeof from !== 'string' || typeof to !== 'string' || !ISO_DAY.test(from) || !ISO_DAY.test(to)) return null
  if (Number.isNaN(dayMs(from)) || Number.isNaN(dayMs(to)) || from > to || to > today) return null
  if (rangeDays({ from, to }) > ADMIN_PERIOD_MAX_DAYS) return null
  return { from, to }
}
export const rangeDays = (r: { from: string; to: string }) => Math.round((dayMs(r.to) - dayMs(r.from)) / DAY) + 1

export function useAdminPeriod() {
  const route = useRoute()
  const router = useRouter()
  const { t, locale } = useI18n()

  const range = computed(() => parseRange(route.query.from, route.query.to))
  const days = computed<number>(() => {
    if (range.value) return rangeDays(range.value)
    const d = Number(route.query.days)
    return (ADMIN_PERIODS as readonly number[]).includes(d) ? d : 30
  })
  const period = computed<AdminPeriodQuery>(() => range.value ?? days.value)
  /** The address query for this period (for links to the other report). */
  const query = computed(() => {
    const q: Record<string, string> = {}
    if (range.value) Object.assign(q, range.value)
    else if (days.value !== 30) q.days = String(days.value)
    return q
  })

  const fmt = (d: string) => dateOnly(`${d}T00:00:00Z`, locale.value)
  const rangeLabel = computed(() => (range.value ? t('admin.customPeriod.range', { from: fmt(range.value.from), to: fmt(range.value.to) }) : ''))
  /** The page subtitle. */
  const sub = (at: string) => (range.value ? t('admin.customPeriod.sub', { range: rangeLabel.value, at }) : t('admin.dash.sub', { n: days.value, at }))
  /** The note under a figure counted over the period. */
  const inPeriod = computed(() => (range.value ? rangeLabel.value : t('admin.dash.inDays', { n: days.value })))

  const setDays = (d: number) => router.replace({ query: d === 30 ? {} : { days: String(d) } })
  const setRange = (r: { from: string; to: string } | null) => {
    if (r && parseRange(r.from, r.to)) router.replace({ query: { from: r.from, to: r.to } })
  }

  return { range, days, period, query, rangeLabel, sub, inPeriod, setDays, setRange }
}
