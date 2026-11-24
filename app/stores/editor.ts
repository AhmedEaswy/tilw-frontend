import { defineStore } from 'pinia'
import type { DeliveryMark, Script } from '~/services/types'
import { isPortError } from '~/services/types'

/**
 * Script editor state (US4, T050).
 * - Working copy of title / body / marks, autosaved 800 ms after the last change.
 * - Every change is also kept as a local draft, so nothing is lost offline or on reload.
 * - Saves send the version they started from; a newer server copy puts the editor in `conflict`
 *   (6:72 compare → 6:73 confirm) instead of overwriting either side.
 * - Undo / redo keep their own history because the body is set programmatically.
 */
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'offline' | 'error' | 'conflict'

interface Snapshot { title: string; body: string; marks: DeliveryMark[] }
interface Draft extends Snapshot { baseVersion: number; at: number }

const DRAFT_KEY = (id: string) => `tilw:draft:${id}`
const AUTOSAVE_MS = 800
const HISTORY_MS = 600
const HISTORY_MAX = 100

export const useEditorStore = defineStore('editor', () => {
  const script = ref<Script | null>(null) // last copy the server confirmed
  const title = ref('')
  const body = ref('')
  const marks = ref<DeliveryMark[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
  const loadError = ref<unknown>(null)
  const saveState = ref<SaveState>('saved')
  const serverCopy = ref<Script | null>(null) // set while in conflict
  const restoredDraft = ref(false)

  const past = ref<Snapshot[]>([])
  const future = ref<Snapshot[]>([])
  let lastSnap: Snapshot | null = null
  let historyTimer: ReturnType<typeof setTimeout> | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saving: Promise<void> | null = null
  let applying = false

  const api = () => useServices().scripts
  const snap = (): Snapshot => ({ title: title.value, body: body.value, marks: marks.value.map(m => ({ ...m })) })
  const dirty = computed(() =>
    !!script.value && (title.value !== script.value.title || body.value !== script.value.body || JSON.stringify(marks.value) !== JSON.stringify(script.value.marks)),
  )

  /** Release 2 (R2-3): the service keeps this script read-only over a lowered limit. */
  const readOnly = computed(() => !!script.value?.readOnly)

  const words = computed(() => countWords(body.value))
  const paragraphs = computed(() => splitParagraphs(body.value).length)

  // ---------- drafts ----------
  function readDraft(id: string): Draft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(id))
      return raw ? (JSON.parse(raw) as Draft) : null
    } catch {
      return null
    }
  }
  function writeDraft() {
    if (!script.value) return
    try {
      const d: Draft = { ...snap(), baseVersion: script.value.version, at: Date.now() }
      localStorage.setItem(DRAFT_KEY(script.value.id), JSON.stringify(d))
    } catch { /* storage full or blocked: autosave still runs */ }
  }
  function clearDraft(id: string) {
    try {
      localStorage.removeItem(DRAFT_KEY(id))
    } catch { /* ignore */ }
  }

  // ---------- load ----------
  async function load(id: string) {
    reset()
    status.value = 'loading'
    try {
      let s = await api().get(id)
      // Mark as opened (feeds "آخر نص فتحته"); this doesn't change the edited date.
      try {
        s = await api().update(id, { lastOpenedAt: new Date().toISOString() }, s.version)
      } catch { /* not important enough to block opening */ }
      adopt(s)
      useScriptsStore().upsert(s)

      // A read-only script can't take edits; any old draft stays on the device for when it unlocks.
      const draft = s.readOnly ? null : readDraft(id)
      if (draft && (draft.title !== s.title || draft.body !== s.body || JSON.stringify(draft.marks) !== JSON.stringify(s.marks))) {
        restoredDraft.value = true
        setContent(draft, { history: false })
        if (draft.baseVersion < s.version) {
          // The account copy moved on while these edits sat on this device.
          serverCopy.value = s
          saveState.value = 'conflict'
        } else {
          saveState.value = 'unsaved'
          scheduleSave(0)
        }
      } else if (draft) {
        clearDraft(id)
      }
      status.value = 'ready'
    } catch (e) {
      loadError.value = e
      status.value = isPortError(e, 'not_found') ? 'missing' : 'error'
    }
  }

  function adopt(s: Script) {
    script.value = s
    applying = true
    title.value = s.title
    body.value = s.body
    marks.value = cleanMarks(s.marks, s.body.length)
    applying = false
    lastSnap = snap()
  }

  // ---------- editing ----------
  /** Apply a change from the UI. Marks follow body edits automatically. */
  function setContent(next: Partial<Snapshot>, opts: { history?: boolean } = {}) {
    if (readOnly.value) return
    if (next.body !== undefined && next.marks === undefined) {
      marks.value = shiftMarks(marks.value, diffEdit(body.value, next.body))
    }
    if (next.title !== undefined) title.value = next.title
    if (next.body !== undefined) body.value = next.body
    if (next.marks !== undefined) marks.value = cleanMarks(next.marks, body.value.length)
    if (opts.history !== false) recordHistory()
    changed()
  }

  function changed() {
    if (applying || !script.value) return
    writeDraft()
    if (saveState.value === 'conflict') return
    saveState.value = dirty.value ? 'unsaved' : 'saved'
    if (dirty.value) scheduleSave()
  }

  const historyPending = ref(false)
  function recordHistory() {
    clearTimeout(historyTimer)
    historyPending.value = true
    // Group fast typing into one undo step.
    historyTimer = setTimeout(() => {
      historyPending.value = false
      historyTimer = undefined
      const now = snap()
      if (lastSnap && (lastSnap.title !== now.title || lastSnap.body !== now.body || JSON.stringify(lastSnap.marks) !== JSON.stringify(now.marks))) {
        past.value = [...past.value.slice(-HISTORY_MAX + 1), lastSnap]
        future.value = []
      }
      lastSnap = now
    }, HISTORY_MS)
  }
  function flushHistory() {
    if (!historyTimer) return
    clearTimeout(historyTimer)
    const now = snap()
    if (lastSnap && JSON.stringify(lastSnap) !== JSON.stringify(now)) {
      past.value = [...past.value.slice(-HISTORY_MAX + 1), lastSnap]
      future.value = []
    }
    lastSnap = now
    historyTimer = undefined
    historyPending.value = false
  }
  const canUndo = computed(() => past.value.length > 0 || historyPending.value)
  const canRedo = computed(() => future.value.length > 0)
  function undo() {
    if (readOnly.value) return
    flushHistory()
    const prev = past.value.at(-1)
    if (!prev) return
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, snap()]
    restore(prev)
  }
  function redo() {
    if (readOnly.value) return
    const next = future.value.at(-1)
    if (!next) return
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, snap()]
    restore(next)
  }
  function restore(s: Snapshot) {
    title.value = s.title
    body.value = s.body
    marks.value = cleanMarks(s.marks, s.body.length)
    lastSnap = snap()
    changed()
  }

  // ---------- marks ----------
  const newId = () => (globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  function addMark(m: Omit<DeliveryMark, 'id'>) {
    if (readOnly.value) return
    flushHistory()
    setContent({ marks: [...marks.value, { ...m, id: newId() }] })
  }
  function removeMark(id: string) {
    if (readOnly.value) return
    flushHistory()
    setContent({ marks: marks.value.filter(m => m.id !== id) })
  }

  // ---------- saving ----------
  function scheduleSave(ms = AUTOSAVE_MS) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void save(), ms)
  }

  async function save(): Promise<void> {
    if (!script.value || saveState.value === 'conflict') return
    if (saving) {
      await saving
      if (dirty.value) return save()
      return
    }
    if (!dirty.value) {
      saveState.value = 'saved'
      return
    }
    clearTimeout(saveTimer)
    const id = script.value.id
    const sent = snap()
    if (!sent.title.trim()) {
      saveState.value = 'error'
      return
    }
    saveState.value = 'saving'
    saving = (async () => {
      try {
        const s = await api().update(id, { title: sent.title.trim(), body: sent.body, marks: sent.marks }, script.value!.version)
        script.value = s
        useScriptsStore().upsert(s)
        if (dirty.value) {
          writeDraft()
          saveState.value = 'unsaved'
          scheduleSave()
        } else {
          clearDraft(id)
          saveState.value = 'saved'
        }
      } catch (e) {
        if (isPortError(e, 'conflict')) {
          serverCopy.value = e.current as Script
          saveState.value = 'conflict'
        } else if (isPortError(e, 'limit_reached')) {
          // Over the word limit, or the script became read-only: the draft stays, the dialog explains.
          saveState.value = 'error'
          useLimitError().handle(e)
          if (e.limit?.key === 'scripts.max_active') void reloadScript(id)
        } else if (isPortError(e, 'network')) {
          saveState.value = 'offline'
          scheduleSave(5000) // keep trying; the draft is safe meanwhile
        } else {
          saveState.value = 'error'
        }
      }
    })()
    try {
      await saving
    } finally {
      saving = null
    }
  }

  /** Fresh copy from the service (its readOnly flag may have changed), keeping local text in the draft. */
  async function reloadScript(id: string) {
    try {
      const s = await api().get(id)
      script.value = s
      useScriptsStore().upsert(s)
    } catch { /* keep what we have */ }
  }

  /** Release 2 (US5): adopt a restored copy as the confirmed one, clearing any local draft. */
  function adoptRestored(s: Script) {
    clearDraft(s.id)
    adopt(s)
    past.value = []
    future.value = []
    saveState.value = 'saved'
    useScriptsStore().upsert(s)
  }

  /**
   * Release 2 (US5): restore a version. Saves pending edits first so they are kept in History too; a newer copy on
   * the service puts the editor in the release-1 conflict flow.
   */
  async function restoreVersion(versionId: string) {
    if (!script.value) return null
    if (dirty.value) await save()
    if (saveState.value === 'conflict') return null
    try {
      const s = await api().restoreVersion(script.value.id, versionId, script.value.version)
      adoptRestored(s)
      return s
    } catch (e) {
      if (isPortError(e, 'conflict')) {
        serverCopy.value = e.current as Script
        saveState.value = 'conflict'
        reviewing.value = false
        return null
      }
      throw e
    }
  }

  // ---------- conflict resolution (6:72 / 6:73) ----------
  /** Keep the account copy; local edits are discarded (the user confirmed in 6:73). */
  function acceptServerCopy() {
    const s = serverCopy.value
    if (!s) return
    clearDraft(s.id)
    serverCopy.value = null
    adopt(s)
    past.value = []
    future.value = []
    saveState.value = 'saved'
    useScriptsStore().upsert(s)
  }

  /** Save local edits as a new script, then show the account copy here. Returns the new script. */
  async function saveMineAsNew(copyTitle: string) {
    const s = serverCopy.value
    if (!s) return null
    const created = await useScriptsStore().create(copyTitle, body.value)
    if (marks.value.length) {
      const withMarks = await api().update(created.id, { marks: marks.value }, created.version)
      useScriptsStore().upsert(withMarks)
    }
    acceptServerCopy()
    return created
  }

  /** Back to the editor without choosing: keep editing locally; saving stays paused. */
  const reviewing = ref(false)

  function reset() {
    clearTimeout(saveTimer)
    clearTimeout(historyTimer)
    historyTimer = undefined
    historyPending.value = false
    script.value = null
    title.value = ''
    body.value = ''
    marks.value = []
    status.value = 'idle'
    saveState.value = 'saved'
    serverCopy.value = null
    restoredDraft.value = false
    reviewing.value = false
    past.value = []
    future.value = []
    lastSnap = null
  }

  return {
    script, title, body, marks, status, loadError, saveState, serverCopy, restoredDraft, reviewing,
    dirty, readOnly, words, paragraphs, canUndo, canRedo,
    load, setContent, undo, redo, addMark, removeMark, save, acceptServerCopy, saveMineAsNew, adoptRestored, reloadScript, restoreVersion, reset,
  }
})
