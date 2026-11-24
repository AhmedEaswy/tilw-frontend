import { readQuery, toQuery } from '~/utils/admin'

/**
 * Feature 006 (FR-006): a page's filters live in its address, so a reload or a shared link restores them.
 * `filters` is reactive; changes are written back with `router.replace` (text debounced) and `onChange` runs.
 * A link to the same page with other filters (e.g. from the attention strip) updates `filters` too.
 */
export function useQueryFilters<K extends string>(keys: readonly K[], opts: { allowed?: Partial<Record<K, readonly string[]>>; debounce?: K[]; onChange: () => void }) {
  const route = useRoute()
  const router = useRouter()
  const filters = reactive(readQuery(route.query, keys, opts.allowed)) as Partial<Record<K, string>>
  let timer: ReturnType<typeof setTimeout> | null = null
  const snapshot = () => JSON.stringify(toQuery(filters as Record<string, string>))
  let last = snapshot()
  let syncing = false

  function apply() {
    const json = snapshot()
    if (json === last) return
    last = json
    void router.replace({ query: toQuery(filters as Record<string, string>) })
    opts.onChange()
  }
  watch(() => ({ ...filters }), (now, before) => {
    if (syncing) return
    const typed = (opts.debounce ?? []).some(k => now[k] !== before?.[k])
    if (timer) clearTimeout(timer)
    if (typed) timer = setTimeout(apply, 250)
    else apply()
  })
  watch(() => route.query, (q) => {
    const next = readQuery(q, keys, opts.allowed)
    const json = JSON.stringify(toQuery(next as Record<string, string>))
    if (json === last) return
    syncing = true
    for (const k of keys) {
      if (next[k] === undefined) delete filters[k]
      else filters[k] = next[k]
    }
    last = json
    void nextTick(() => (syncing = false))
    opts.onChange()
  })
  onBeforeUnmount(() => timer && clearTimeout(timer))

  return filters
}
