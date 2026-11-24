import { readQuery, toQuery } from '~/utils/admin'

/**
 * Feature 006 (FR-006): a page's filters live in its address, so a reload or a shared link restores them.
 * `filters` is reactive; changes are written back with `router.replace` (text debounced) and `onChange` runs.
 */
export function useQueryFilters<K extends string>(keys: readonly K[], opts: { allowed?: Partial<Record<K, readonly string[]>>; debounce?: K[]; onChange: () => void }) {
  const route = useRoute()
  const router = useRouter()
  const filters = reactive(readQuery(route.query, keys, opts.allowed)) as Partial<Record<K, string>>
  let timer: ReturnType<typeof setTimeout> | null = null
  let last = JSON.stringify(toQuery(filters as Record<string, string>))

  function apply() {
    const next = toQuery(filters as Record<string, string>)
    const json = JSON.stringify(next)
    if (json === last) return
    last = json
    void router.replace({ query: next })
    opts.onChange()
  }
  watch(() => ({ ...filters }), (now, before) => {
    const typed = (opts.debounce ?? []).some(k => now[k] !== before?.[k])
    if (timer) clearTimeout(timer)
    if (typed) timer = setTimeout(apply, 250)
    else apply()
  })
  onBeforeUnmount(() => timer && clearTimeout(timer))

  return filters
}
