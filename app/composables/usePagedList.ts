import type { Page } from '~/services/types'

/**
 * Feature 006 (research R4): one "Load more" list for every admin table. `reload()` starts again from the first page
 * (filters changed); answers that arrive for an older request are dropped, so fast typing never shows stale rows.
 */
export function usePagedList<P extends Page<unknown>, T = P['items'][number]>(
  fetchPage: (cursor: string | null) => Promise<P>,
  /** Runs for the answer that is kept (never for one a newer request replaced), with `first` for a first page. */
  onPage?: (page: P, first: boolean) => void,
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const cursor = ref<string | null>(null)
  const done = ref(false)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<unknown>(null)
  let seq = 0

  async function run(reset: boolean) {
    const mine = ++seq
    loading.value = true
    error.value = null
    try {
      const page = await fetchPage(reset ? null : cursor.value)
      if (mine !== seq) return
      onPage?.(page, reset)
      items.value = (reset ? page.items : [...items.value, ...page.items]) as T[]
      cursor.value = page.nextCursor
      done.value = !page.nextCursor
      loaded.value = true
    } catch (e) {
      if (mine === seq) error.value = e
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  const reload = () => run(true)
  const more = () => (done.value || loading.value ? Promise.resolve() : run(false))
  /** Replace one row in place (after an action on it). */
  function replace(match: (x: T) => boolean, next: T) {
    items.value = items.value.map(x => (match(x) ? next : x))
  }

  return { items, loading, loaded, error, done, reload, more, replace }
}
