/**
 * Upload queue (release 2, US3, research §7). One entry per take in IndexedDB (`tilw-uploads`), so an upload survives
 * a reload and resumes from the offset Google reports. Only the tab holding the Web Lock `tilw-uploads` uploads;
 * every tab hears progress on `BroadcastChannel('tilw-uploads')`, so two tabs show the same badge and never send the
 * same take twice. Browsers without Web Locks run the queue in the tab that started it.
 *
 * The device copy of a take is never touched: a failure marks the entry `failed` with the reason and keeps it for
 * Retry (FR-013, SC-004). Uploads pause while the studio counts down or records (constitution V).
 */
import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval'
import type { RemoteTakesPort, StoragePort } from '../ports'
import type { TakesRepo } from '../takes'
import { isPortError, PortError, type UploadToken } from '../types'
import { DriveTokenError } from './uploader'

export type QueueError = 'storage_full' | 'storage_not_linked' | 'network' | 'limit_reached'

export interface QueueEntry {
  /** `${userId}:${takeId}`: entries of other accounts are ignored. */
  key: string
  userId: string
  takeId: string
  remoteId: string | null
  sessionUrl: string | null
  /** Bytes Google has confirmed. */
  offset: number
  total: number
  state: 'waiting' | 'uploading' | 'failed'
  error: QueueError | null
  updatedAt: string
}

export interface QueueProgress {
  takeId: string
  state: 'waiting' | 'uploading' | 'failed' | 'done' | 'removed'
  sent: number
  total: number
  error: QueueError | null
}

export interface QueueStore {
  list(): Promise<QueueEntry[]>
  put(e: QueueEntry): Promise<void>
  del(key: string): Promise<void>
}

interface LockLike {
  request(name: string, cb: () => Promise<unknown>): Promise<unknown>
}
interface ChannelLike {
  postMessage(m: unknown): void
  addEventListener(type: 'message', cb: (e: { data: unknown }) => void): void
  close(): void
}

export interface QueueDeps {
  store: QueueStore
  takes: TakesRepo
  storage: StoragePort
  remote: RemoteTakesPort
  /** `navigator.locks`; undefined → this tab owns the queue. */
  locks?: LockLike
  channel?: () => ChannelLike
  /** Take title for Drive and the service ("افتتاحية الحلقة · المحاولة 2"). */
  titleFor?: (t: { scriptTitle: string; number: number }) => string
  fileNameFor?: (t: { scriptTitle: string; number: number; mimeType: string }) => string
  /** Wait before retrying after a network error. */
  retryDelayMs?: number
  /** Network errors in a row before the entry shows as failed. */
  maxNetworkTries?: number
}

/** Refresh the Drive token this long before it expires (research §6). */
export const TOKEN_MARGIN_MS = 2 * 60_000

export function memoryQueueStore(): QueueStore {
  const m = new Map<string, QueueEntry>()
  return {
    list: async () => [...m.values()].map(e => ({ ...e })),
    put: async e => void m.set(e.key, { ...e }),
    del: async k => void m.delete(k),
  }
}

export function idbQueueStore(): QueueStore {
  const store: UseStore = createStore('tilw-uploads', 'queue')
  return {
    async list() {
      const ks = await keys<string>(store)
      const all = await Promise.all(ks.map(k => get<QueueEntry>(k, store)))
      return all.filter((e): e is QueueEntry => !!e)
    },
    put: e => set(e.key, e, store),
    del: k => del(k, store),
  }
}

export function createUploadQueue(deps: QueueDeps) {
  const listeners = new Set<(p: QueueProgress) => void>()
  const retryDelay = deps.retryDelayMs ?? 10_000
  const maxTries = deps.maxNetworkTries ?? 3
  const titleFor = deps.titleFor ?? (t => `${t.scriptTitle} · ${t.number}`)
  const fileNameFor = deps.fileNameFor ?? (t => `${titleFor(t)}.${t.mimeType.includes('mp4') ? 'mp4' : 'webm'}`)

  let userId: string | null = null
  let owner = false
  let running = false
  let paused = false
  let release: (() => void) | null = null
  let channel: ChannelLike | null = null
  let abort: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const tries = new Map<string, number>()
  /** Drive tokens per folder (scriptId), kept in memory only. */
  const tokens = new Map<string, UploadToken>()

  const keyOf = (takeId: string) => `${userId}:${takeId}`

  function emit(p: QueueProgress, broadcast = true) {
    listeners.forEach(l => l(p))
    if (broadcast) channel?.postMessage({ type: 'progress', userId, progress: p })
  }

  async function mine(): Promise<QueueEntry[]> {
    const all = await deps.store.list()
    return all.filter(e => e.userId === userId).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  }

  async function token(scriptId: string | null, force = false): Promise<UploadToken> {
    const k = scriptId ?? ''
    const cached = tokens.get(k)
    if (!force && cached && Date.parse(cached.expiresAt) - Date.now() > TOKEN_MARGIN_MS) return cached
    const fresh = await deps.storage.uploadToken(scriptId)
    tokens.set(k, fresh)
    return fresh
  }

  async function save(e: QueueEntry, patch: Partial<QueueEntry>) {
    Object.assign(e, patch, { updatedAt: new Date().toISOString() })
    await deps.store.put(e)
  }

  /** Upload one entry. Resolves when it is done, failed, or put back to wait. */
  async function process(e: QueueEntry) {
    const take = await deps.takes.get(e.takeId)
    if (!take) {
      // The take was deleted from this device: nothing left to send.
      await deps.store.del(e.key)
      emit({ takeId: e.takeId, state: 'removed', sent: 0, total: 0, error: null })
      return
    }
    await save(e, { state: 'uploading', error: null, total: take.blob.size })
    emit({ takeId: e.takeId, state: 'uploading', sent: e.offset, total: take.blob.size, error: null })
    abort = new AbortController()
    const signal = abort.signal
    try {
      // 'none' = a take with no script. A script the service doesn't know (deleted, or recorded before this account
      // used the API) goes to the root `Tilw` folder as a take with no script rather than failing for good.
      let scriptId: string | null = take.scriptId === 'none' ? null : take.scriptId
      let tok: UploadToken
      try {
        tok = await token(scriptId)
      } catch (err) {
        if (!scriptId || !isPortError(err, 'not_found')) throw err
        scriptId = null
        tok = await token(null)
      }
      if (!e.remoteId) {
        const rt = await deps.remote.register({
          clientId: take.id,
          scriptId,
          title: take.label || titleFor(take),
          kind: take.kind,
          mime: take.mimeType,
          durationMs: Math.max(1, Math.round(take.durationMs)),
          sizeBytes: take.blob.size,
          recordedAt: take.createdAt,
          starred: take.starred,
        })
        await save(e, { remoteId: rt.id })
        if (rt.state === 'backed_up' && rt.providerFileId) return await finish(e, rt.providerFileId)
      }
      const drive = deps.storage.uploader()
      let tokenRetried = false
      let sessionRetried = false
      for (;;) {
        try {
          if (!e.sessionUrl) {
            const session = await drive.start(take.blob, { name: fileNameFor(take), mimeType: take.mimeType }, tok.folderId ?? tok.rootFolderId, tok.accessToken)
            await save(e, { sessionUrl: session.url, offset: 0 })
          }
          const { fileId } = await drive.resume({ url: e.sessionUrl! }, take.blob, tok.accessToken, (sent, total) => {
            e.offset = sent
            void deps.store.put({ ...e, updatedAt: new Date().toISOString() })
            emit({ takeId: e.takeId, state: 'uploading', sent, total, error: null })
          }, signal)
          return await finish(e, fileId)
        } catch (err) {
          if (err instanceof DriveTokenError && !tokenRetried) {
            tokenRetried = true
            tok = await token(scriptId, true)
            continue
          }
          if (err instanceof DriveTokenError) throw new PortError('storage_not_linked')
          // Google forgot the session (about a week old): start a new one once.
          if (isPortError(err, 'not_found') && !sessionRetried) {
            sessionRetried = true
            await save(e, { sessionUrl: null, offset: 0 })
            continue
          }
          throw err
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        await save(e, { state: 'waiting' })
        emit({ takeId: e.takeId, state: 'waiting', sent: e.offset, total: e.total, error: null })
        return
      }
      const code = isPortError(err) ? err.code : 'network'
      const reason: QueueError = code === 'storage_full' || code === 'storage_not_linked' || code === 'limit_reached' ? code : 'network'
      const n = (tries.get(e.key) ?? 0) + 1
      tries.set(e.key, n)
      if (reason === 'network' && n < maxTries) {
        await save(e, { state: 'waiting', error: 'network' })
        emit({ takeId: e.takeId, state: 'waiting', sent: e.offset, total: e.total, error: 'network' })
        scheduleRetry()
        return
      }
      tries.delete(e.key)
      await save(e, { state: 'failed', error: reason })
      emit({ takeId: e.takeId, state: 'failed', sent: e.offset, total: e.total, error: reason })
    } finally {
      abort = null
    }
  }

  async function finish(e: QueueEntry, fileId: string) {
    const rt = await deps.remote.update(e.remoteId!, { state: 'backed_up', providerFileId: fileId })
    try {
      await deps.takes.update(e.takeId, { remote: { id: rt.id, state: 'backed_up', providerFileId: fileId } })
    } catch { /* the device copy is gone; the record still says it's in Drive */ }
    await deps.store.del(e.key)
    tries.delete(e.key)
    emit({ takeId: e.takeId, state: 'done', sent: e.total, total: e.total, error: null })
  }

  function scheduleRetry() {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => void kick(), retryDelay)
  }

  /** Work through waiting entries, oldest first. Only the owner tab does this. */
  async function kick() {
    if (!owner || running || paused || !userId) return
    running = true
    try {
      for (;;) {
        if (paused || !owner || !userId) break
        const next = (await mine()).find(e => e.state === 'waiting' || e.state === 'uploading')
        if (!next) break
        await process(next)
        if (next.state === 'waiting' && next.error === 'network') break // wait for the retry timer
      }
    } finally {
      running = false
    }
  }

  function onChannel(msg: unknown) {
    const m = msg as { type?: string; userId?: string; progress?: QueueProgress }
    if (m?.userId !== userId) return
    if (m.type === 'progress' && m.progress) emit(m.progress, false)
    if (m.type === 'kick') void kick()
  }

  return {
    /** Start for a signed-in person: join the channel and wait for the lock. */
    async start(uid: string) {
      if (userId === uid) return
      this.stop()
      userId = uid
      channel = deps.channel?.() ?? null
      channel?.addEventListener('message', e => onChannel(e.data))
      if (!deps.locks) {
        owner = true
        void kick()
        return
      }
      const held = new Promise<void>(r => (release = r))
      void deps.locks.request('tilw-uploads', async () => {
        if (userId !== uid) return
        owner = true
        void kick()
        await held
        owner = false
      })
    },

    /** Sign-out: stop uploading here; entries stay for that account only. */
    stop() {
      abort?.abort()
      clearTimeout(retryTimer)
      release?.()
      release = null
      owner = false
      channel?.close()
      channel = null
      userId = null
      tokens.clear()
    },

    async enqueue(takeId: string) {
      if (!userId) return
      const existing = (await mine()).find(e => e.takeId === takeId)
      if (existing && existing.state !== 'failed') return
      const e: QueueEntry = existing ?? { key: keyOf(takeId), userId, takeId, remoteId: null, sessionUrl: null, offset: 0, total: 0, state: 'waiting', error: null, updatedAt: '' }
      await save(e, { state: 'waiting', error: null })
      tries.delete(e.key)
      emit({ takeId, state: 'waiting', sent: e.offset, total: e.total, error: null })
      if (owner) void kick()
      else channel?.postMessage({ type: 'kick', userId })
    },

    retry(takeId: string) {
      return this.enqueue(takeId)
    },

    /** Drop the entry (the take was deleted, or the person gave up). The device take stays. */
    async cancel(takeId: string) {
      if (!userId) return
      const e = (await mine()).find(x => x.takeId === takeId)
      if (!e) return
      if (e.state === 'uploading') abort?.abort()
      await deps.store.del(e.key)
      emit({ takeId, state: 'removed', sent: 0, total: 0, error: null })
    },

    entries: () => mine(),

    /** The studio is counting down or recording: let go of the network until it's done. */
    pause() {
      paused = true
      abort?.abort()
    },
    resume() {
      paused = false
      void kick()
    },

    onProgress(cb: (p: QueueProgress) => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    /** For tests and the second-tab case. */
    get isOwner() {
      return owner
    },
    kick,
  }
}

export type UploadQueue = ReturnType<typeof createUploadQueue>
