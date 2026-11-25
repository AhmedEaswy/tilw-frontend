import type { UiDateRange, UiOption } from '~/utils/uiControls'

/**
 * Bridges between the admin pages' address filters (`useQueryFilters`: strings, `undefined` = not set) and the UI kit
 * controls' models (`UiSelect` / `UiAutocomplete`: a value or null; `UiDatePicker` range: `{ from, to }` or null).
 */
type Filters<K extends string> = Partial<Record<K, string>>

/**
 * A select filter whose first option is "All" (value `''`): `''` / null in the control means the filter is not set.
 * Use as `v-model="planModel"` with `options` starting with `{ value: '', label: t('admin.list.all') }`.
 */
export function filterModel<K extends string>(filters: Filters<K>, key: K) {
  return computed<string | null>({
    get: () => filters[key] ?? '',
    set: (v) => {
      filters[key] = v ? v : undefined
    },
  })
}

/**
 * A from/to pair of day filters (`YYYY-MM-DD`) as one range model. A pair set by hand in the address with only one
 * side shows as a one-day range; clearing the picker clears both.
 */
export function rangeModel<K extends string>(filters: Filters<K>, from: K, to: K) {
  return computed<UiDateRange | null>({
    get: () => {
      const f = filters[from]
      const t = filters[to]
      if (!f && !t) return null
      return { from: (f || t)!, to: (t || f)! }
    },
    set: (v) => {
      filters[from] = v?.from || undefined
      filters[to] = v?.to || undefined
    },
  })
}

/** Options for a `filterModel` select: "All" (value `''`) first, then `options`. */
export function withAll(label: string, options: readonly UiOption<string>[]): UiOption<string>[] {
  return [{ value: '', label }, ...options]
}

/** A text filter for `UiSearchField` (which debounces itself): `''` in the field means the filter is not set. */
export function textModel<K extends string>(filters: Filters<K>, key: K) {
  return computed<string>({
    get: () => filters[key] ?? '',
    set: (v) => {
      filters[key] = v || undefined
    },
  })
}
