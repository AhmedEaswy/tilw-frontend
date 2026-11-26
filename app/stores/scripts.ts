import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { Script, ScriptPage, ScriptPatch, ScriptSummary } from '~/services/types'
import { isPortError } from '~/services/types'

export type ScriptFilter = 'all' | 'pinned' | 'archived'
/** Library order: last edited, title, or number of recordings. */
export type ScriptSort = 'recent' | 'title' | 'takes'

/** Scripts per page of the library (load more). */
export const SCRIPTS_PAGE_SIZE = 20

/**
 * Script library state (US3, T040): a paged list (filter, sort and search run on the service; "load more" fetches the
 * next page), the last-opened card, and the row actions. `items` caches every script seen so far (pages, the
 * last-opened card, the editor and reader's saves), so a row updated elsewhere stays current.
 * Pin / archive / rename are optimistic: the row changes at once and rolls back if the save fails.
 */
export const useScriptsStore = defineStore('scripts', () => {
  const items = ref<ScriptSummary[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref<unknown>(null)
  const filter = ref<ScriptFilter>('all')
  const sort = ref<ScriptSort>('recent')
  /** The sort's usual direction (newest, A to Z, most recordings) turned around. */
  const reversed = ref(false)
  const ascending = computed(() => (sort.value === 'title') !== reversed.value)
  /** Every matching script in recordings order, which this app pages itself (see `takesPage`). */
  let ranked: ScriptSummary[] = []
  const query = ref('')
  /** The loaded pages, in the service's order. */
  const listIds = ref<string[]>([])
  const nextCursor = ref<string | null>(null)
  const loadingMore = ref(false)
  /** A new filter, sort or search is fetching its first page (the rows on screen belong to the old one). */
  const reloading = ref(false)
  /** Every script the person has (archived too), from the last page read; null before the first. */
  const libraryCount = ref<number | null>(null)
  let listSeq = 0
  let reloadSeq = 0

  const api = () => useServices().scripts

  /** Put fetched summaries in the cache without reordering it. */
  function remember(list: ScriptSummary[]) {
    for (const s of list) {
      const i = items.value.findIndex(x => x.id === s.id)
      if (i >= 0) items.value[i] = s
      else items.value.push(s)
    }
  }

  /** The last "Load more" failed; the page shows it next to the button. */
  const moreError = shallowRef<unknown>(null)

  async function fetchPage(first: boolean) {
    if (first) moreError.value = null
    const seq = first ? ++listSeq : listSeq
    const cursor = first ? null : nextCursor.value
    const by = sort.value
    const page = by === 'takes'
      ? await takesPage(seq, cursor)
      : await api().page({
          limit: SCRIPTS_PAGE_SIZE, filter: filter.value, sort: by, q: query.value, cursor,
          ...(reversed.value ? { dir: ascending.value ? 'asc' as const : 'desc' as const } : {}),
        })
    if (seq !== listSeq) return // a newer filter, sort or search took over
    remember(page.data)
    const ids = page.data.map(s => s.id)
    listIds.value = first ? ids : [...listIds.value, ...ids.filter(id => !listIds.value.includes(id))]
    nextCursor.value = page.nextCursor
    libraryCount.value = page.libraryCount
  }

  /**
   * A page in recordings order. The service can't sort by it (recordings kept only on this device never reach it), so
   * the first page reads every script and orders them by the count the rows show; later pages follow that order.
   */
  async function takesPage(seq: number, cursor: string | null): Promise<ScriptPage> {
    let total = libraryCount.value ?? 0
    if (!cursor) {
      const takes = useTakesStore()
      await Promise.all([
        takes.loaded ? null : takes.load().catch(() => {}),
        takes.remoteLoaded ? null : takes.loadRemote().catch(() => {}),
      ])
      const q = query.value.trim()
      const [every, matches] = await Promise.all([api().list(), q ? api().search(q).then(ids => new Set(ids)) : null])
      const sign = ascending.value ? 1 : -1
      const count = (s: ScriptSummary) => takes.countByScript.get(s.id) ?? 0
      const order = every
        .filter(s => (filter.value === 'archived' ? !!s.archivedAt : !s.archivedAt && (filter.value !== 'pinned' || s.pinned)))
        .filter(s => !matches || matches.has(s.id))
        // Equal counts keep the newest edit first, whichever way the counts run.
        .sort((a, b) => sign * (count(a) - count(b)) || b.updatedAt.localeCompare(a.updatedAt))
      total = every.length
      if (seq === listSeq) ranked = order
    }
    const start = Number(cursor ?? 0)
    const end = start + SCRIPTS_PAGE_SIZE
    return { data: ranked.slice(start, end), nextCursor: end < ranked.length ? String(end) : null, libraryCount: total }
  }

  /** The "آخر نص فتحته" card's script: the most recently opened active one (it may not be on the first page). */
  async function fetchLastOpened() {
    const page = await api().page({ limit: 1, filter: 'opened', sort: 'opened' })
    remember(page.data)
  }

  async function load(force = false) {
    if (status.value === 'loading' || (status.value === 'ready' && !force)) return
    status.value = 'loading'
    try {
      await Promise.all([fetchPage(true), fetchLastOpened()])
      status.value = 'ready'
      error.value = null
    } catch (e) {
      error.value = e
      status.value = 'error'
    }
  }

  /**
   * The first page again, for a new filter, sort or search. `wait` marks the rows on screen as stale (the library shows
   * row skeletons): a new filter or search changes which scripts belong; a new sort only reorders the same ones, so
   * those rows stay usable until the new order lands.
   */
  async function reloadList(wait = true) {
    if (status.value === 'idle') return
    const mine = ++reloadSeq
    reloading.value = wait
    try {
      await fetchPage(true)
      if (status.value === 'error') status.value = 'ready'
    } catch (e) {
      // Offline: fall back to the scripts already seen, matched by title.
      const f = foldForSearch(query.value)
      listIds.value = items.value.filter(s => !f || foldForSearch(s.title).includes(f)).map(s => s.id)
      nextCursor.value = null
      if (!items.value.length) {
        error.value = e
        status.value = 'error'
      }
    } finally {
      // Only the newest request clears it: an older one finishing must not hide the wait for the newer one.
      if (mine === reloadSeq) reloading.value = false
    }
  }
  watch(filter, () => void reloadList())
  watch([sort, reversed], () => void reloadList(false))

  /** A newly picked sort starts in its usual direction. */
  function setSort(value: ScriptSort) {
    reversed.value = false
    sort.value = value
  }

  async function loadMore() {
    if (!nextCursor.value || loadingMore.value) return
    loadingMore.value = true
    moreError.value = null
    const seq = listSeq
    try {
      await fetchPage(false)
    } catch (e) {
      if (seq === listSeq) moreError.value = e
    } finally {
      loadingMore.value = false
    }
  }
  const hasMore = computed(() => !!nextCursor.value)

  /** Search over title and text on the service; an empty query clears it. The last request wins. */
  async function setQuery(q: string) {
    query.value = q
    await reloadList()
  }

  const active = computed(() => items.value.filter(s => !s.archivedAt))
  const hasAny = computed(() => (libraryCount.value ?? 0) > 0 || items.value.length > 0)

  /** The loaded rows, still matching the filter after an optimistic pin, archive or restore. */
  const visible = computed(() => listIds.value
    .map(id => items.value.find(s => s.id === id))
    .filter((s): s is ScriptSummary => {
      if (!s) return false
      if (filter.value === 'archived') return !!s.archivedAt
      if (s.archivedAt) return false
      return filter.value === 'pinned' ? s.pinned : true
    }))

  /** The "آخر نص فتحته" card: most recently opened script that is not archived. */
  const lastOpened = computed(() =>
    active.value
      .filter(s => s.lastOpenedAt)
      .sort((a, b) => b.lastOpenedAt!.localeCompare(a.lastOpenedAt!))[0] ?? null,
  )

  function upsert(s: Script | ScriptSummary) {
    const summary = 'body' in s ? toSummary(s) : s
    const i = items.value.findIndex(x => x.id === s.id)
    if (i >= 0) items.value[i] = summary
    else items.value.unshift(summary)
  }

  /** A script made just now (created, duplicated, imported) goes to the top of the list it belongs to. */
  function added(s: Script) {
    upsert(s)
    if (libraryCount.value !== null) libraryCount.value++
    if (filter.value === 'all') listIds.value = [s.id, ...listIds.value.filter(id => id !== s.id)]
  }

  async function create(title: string, body = '') {
    const s = await api().create({ title, body })
    added(s)
    return s
  }

  async function duplicate(id: string) {
    const s = await api().duplicate(id)
    added(s)
    return s
  }

  /**
   * Optimistic patch for list-level fields. On a version conflict the fresh server copy is taken
   * and the patch is applied once more on top of it (these fields don't overlap with editor content).
   */
  async function patch(id: string, p: Pick<ScriptPatch, 'title' | 'pinned' | 'archivedAt'>) {
    const i = items.value.findIndex(x => x.id === id)
    if (i < 0) return
    const before = items.value[i]!
    items.value[i] = { ...before, ...p } as ScriptSummary
    try {
      let saved: Script
      try {
        saved = await api().update(id, p, before.version)
      } catch (e) {
        if (!isPortError(e, 'conflict')) throw e
        const fresh = e.current as Script
        saved = await api().update(id, p, fresh.version)
      }
      upsert(saved)
    } catch (e) {
      const j = items.value.findIndex(x => x.id === id)
      if (j >= 0) items.value[j] = before
      throw e
    }
  }

  const rename = (id: string, title: string) => patch(id, { title: title.trim() })
  const setPinned = (id: string, pinned: boolean) => patch(id, { pinned })
  const setArchived = (id: string, archived: boolean) =>
    patch(id, { archivedAt: archived ? new Date().toISOString() : null })

  function reset() {
    listSeq++
    items.value = []
    status.value = 'idle'
    query.value = ''
    listIds.value = []
    nextCursor.value = null
    libraryCount.value = null
    filter.value = 'all'
  }

  return {
    items, status, error, filter, sort, reversed, ascending, setSort, query, visible, lastOpened, hasAny, hasMore, loadingMore, moreError, reloading, libraryCount,
    load, loadMore, setQuery, create, duplicate, rename, setPinned, setArchived, upsert, reset,
  }
})

function toSummary(s: Script): ScriptSummary {
  const { body, marks: _m, ...rest } = s
  return { ...rest, excerpt: firstLine(body), wordCount: countWords(body), paragraphCount: splitParagraphs(body).length }
}
