/**
 * Shared types and pure helpers for the form controls in components/ui (UiSelect, UiAutocomplete, UiDatePicker,
 * UiSearchField). Kept free of Vue so they are easy to unit-test.
 */
import type { GlyphName } from '~/components/ui/UiGlyph.vue'

export type UiOptionValue = string | number

/** One choice in UiSelect / UiAutocomplete. Options sharing a `group` are shown under one heading. */
export interface UiOption<V extends UiOptionValue = UiOptionValue> {
  value: V
  label: string
  /** Secondary text beside the label (an email, a plan, a count…). */
  hint?: string
  /** Heading of the group this option belongs to (rendered as an ARIA group). */
  group?: string
  icon?: GlyphName
  disabled?: boolean
  /** Anything the caller wants back on `select` (e.g. the full row an autocomplete result came from). */
  data?: unknown
}

export interface UiOptionGroup<V extends UiOptionValue = UiOptionValue> {
  /** '' for options without a group (rendered first, without a heading). */
  label: string
  options: { option: UiOption<V>; index: number }[]
}

/** Groups options in first-appearance order of their group; ungrouped options come first. Indexes are flat. */
export function groupOptions<V extends UiOptionValue>(options: readonly UiOption<V>[]): UiOptionGroup<V>[] {
  const groups = new Map<string, UiOptionGroup<V>>()
  groups.set('', { label: '', options: [] })
  for (const option of options) {
    const key = option.group ?? ''
    if (!groups.has(key)) groups.set(key, { label: key, options: [] })
    groups.get(key)!.options.push({ option, index: -1 })
  }
  let i = 0
  const out = [...groups.values()].filter(g => g.options.length)
  for (const g of out) for (const o of g.options) o.index = i++
  return out
}

/** The options in the order they are shown (groups flattened). */
export function flatOptions<V extends UiOptionValue>(options: readonly UiOption<V>[]): UiOption<V>[] {
  return groupOptions(options).flatMap(g => g.options.map(o => o.option))
}

/** Next enabled index from `from` moving by `step` (clamped, no wrap). Returns `from` when there is none. */
export function stepEnabled(options: readonly UiOption[], from: number, step: number): number {
  const n = options.length
  if (!n) return -1
  const dir = Math.sign(step) || 1
  const target = Math.max(0, Math.min(n - 1, from + step))
  // Moving can land on a disabled option: keep going the same way, then back towards where we started.
  for (let i = target; i >= 0 && i < n; i += dir) if (!options[i]!.disabled) return i
  for (let i = target - dir; i >= 0 && i < n && i !== from; i -= dir) if (!options[i]!.disabled) return i
  return from
}

export function firstEnabled(options: readonly UiOption[]): number {
  return options.findIndex(o => !o.disabled)
}

export function lastEnabled(options: readonly UiOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i]!.disabled) return i
  return -1
}

/**
 * Type-ahead: the index of the next enabled option whose label starts with `buffer` (case-insensitive), searching
 * after `from` and wrapping. A buffer of one repeated letter ("bbb") cycles through the options starting with it;
 * a longer word keeps the current option while it still matches.
 */
export function typeAhead(options: readonly UiOption[], buffer: string, from: number): number {
  const n = options.length
  if (!n || !buffer) return -1
  const q = buffer.toLocaleLowerCase()
  const repeated = q.length > 1 && [...q].every(c => c === q[0])
  const needle = repeated ? q[0]! : q
  const start = q.length > 1 && !repeated ? Math.max(from, 0) : from + 1
  for (let k = 0; k < n; k++) {
    const i = (((start + k) % n) + n) % n
    const o = options[i]!
    if (!o.disabled && o.label.toLocaleLowerCase().startsWith(needle)) return i
  }
  return -1
}

// ---------------------------------------------------------------------------------------------- dates (local time)

/** `YYYY-MM-DD` for a local date (never via toISOString, which shifts by the time zone). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local Date for `YYYY-MM-DD`, or null when it isn't a real date in that form. */
export function fromIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null
}

export interface UiDateRange {
  from: string
  to: string
}

export type UiDatePreset = 'last7' | 'last30' | 'last90' | 'thisMonth'
export const UI_DATE_PRESETS: readonly UiDatePreset[] = ['last7', 'last30', 'last90', 'thisMonth']

/** The range for a quick preset, ending today, clamped to min/max. Null when the clamp leaves nothing. */
export function presetRange(preset: UiDatePreset, today: Date, min?: string | null, max?: string | null): UiDateRange | null {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let start: Date
  if (preset === 'thisMonth') start = new Date(end.getFullYear(), end.getMonth(), 1)
  else {
    const days = preset === 'last7' ? 7 : preset === 'last30' ? 30 : 90
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
  }
  let from = toIsoDate(start)
  let to = toIsoDate(end)
  if (min && from < min) from = min
  if (max && to > max) to = max
  return from <= to ? { from, to } : null
}

/** BCP 47 tag for showing dates, matching the rest of the app (Latin digits in Arabic). */
export function dateLocaleTag(locale: string): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'
}

/** "12 Nov 2026" / "12 نوفمبر 2026" short date for an ISO day, or '' when it isn't one. */
export function formatIsoDate(iso: string | null | undefined, locale: string): string {
  const d = fromIsoDate(iso)
  return d ? new Intl.DateTimeFormat(dateLocaleTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : ''
}
