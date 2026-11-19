import { defineStore } from 'pinia'
import type { Script, ScriptPatch, ScriptSummary } from '~/services/types'
import { isPortError } from '~/services/types'

export type ScriptFilter = 'all' | 'pinned' | 'archived'
export type ScriptSort = 'recent' | 'title'

/**
 * Script library state (US3, T040): list, filter, sort, search, and the row actions.
 * Pin / archive / rename are optimistic: the row changes at once and rolls back if the save fails.
 */
export const useScriptsStore = defineStore('scripts', () => {
  const items = ref<ScriptSummary[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref<unknown>(null)
  const filter = ref<ScriptFilter>('all')
  const sort = ref<ScriptSort>('recent')
  const query = ref('')
  const matchIds = ref<Set<string> | null>(null)
  let searchSeq = 0

  const api = () => useServices().scripts

  async function load(force = false) {
    if (status.value === 'loading' || (status.value === 'ready' && !force)) return
    status.value = 'loading'
    try {
      items.value = await api().list()
      status.value = 'ready'
      error.value = null
    } catch (e) {
      error.value = e
      status.value = 'error'
    }
  }

  /** Server-side search over title and body; empty query clears it. Last request wins. */
  async function setQuery(q: string) {
    query.value = q
    const seq = ++searchSeq
    if (!q.trim()) {
      matchIds.value = null
      return
    }
    try {
      const ids = await api().search(q)
      if (seq === searchSeq) matchIds.value = new Set(ids)
    } catch {
      // Fall back to a title-only match while offline.
      if (seq === searchSeq) {
        const f = foldForSearch(q)
        matchIds.value = new Set(items.value.filter(s => foldForSearch(s.title).includes(f)).map(s => s.id))
      }
    }
  }

  const collator = computed(() => new Intl.Collator(['ar', 'en'], { sensitivity: 'base', numeric: true }))

  const active = computed(() => items.value.filter(s => !s.archivedAt))
  const hasAny = computed(() => items.value.length > 0)

  const visible = computed(() => {
    let list = items.value.filter((s) => {
      if (filter.value === 'archived') return !!s.archivedAt
      if (s.archivedAt) return false
      return filter.value === 'pinned' ? s.pinned : true
    })
    if (matchIds.value) list = list.filter(s => matchIds.value!.has(s.id))
    return [...list].sort((a, b) =>
      sort.value === 'title' ? collator.value.compare(a.title, b.title) : b.updatedAt.localeCompare(a.updatedAt),
    )
  })

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

  async function create(title: string, body = '') {
    const s = await api().create({ title, body })
    upsert(s)
    return s
  }

  async function duplicate(id: string) {
    const s = await api().duplicate(id)
    upsert(s)
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
    items.value = []
    status.value = 'idle'
    query.value = ''
    matchIds.value = null
    filter.value = 'all'
  }

  return { items, status, error, filter, sort, query, visible, lastOpened, hasAny, load, setQuery, create, duplicate, rename, setPinned, setArchived, upsert, reset }
})

function toSummary(s: Script): ScriptSummary {
  const { body, marks: _m, ...rest } = s
  return { ...rest, excerpt: firstLine(body), wordCount: countWords(body), paragraphCount: splitParagraphs(body).length }
}
