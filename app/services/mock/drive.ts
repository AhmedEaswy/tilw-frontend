/**
 * Fake Google Drive for the mock adapter (release 2, US3). It speaks the same DriveUploader interface as the real
 * uploader (services/drive/uploader.ts), so the upload queue runs unchanged against it. Uploaded blobs live in a
 * separate IndexedDB store (`tilw-mock-drive`) in the browser, or in memory in unit tests.
 *
 * Modes (from /__mock): ok, full (no room: storage_full), revoked (Google revoked the link: storage_not_linked),
 * slow (small chunks with a pause, to test progress, a second tab and resume after reload).
 */
import type { DriveSession, DriveUploader } from '../ports'
import { PortError } from '../types'

export type DriveMode = 'ok' | 'full' | 'revoked' | 'slow'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  folderId: string
  createdAt: number
}

export interface DriveSessionRecord {
  url: string
  name: string
  mimeType: string
  folderId: string
  total: number
  /** Bytes the fake Drive has confirmed. */
  offset: number
}

export interface BlobStore {
  get(id: string): Promise<Blob | undefined>
  set(id: string, blob: Blob): Promise<void>
  del(id: string): Promise<void>
}

export interface FakeDriveState {
  files: Record<string, DriveFile>
  sessions: Record<string, DriveSessionRecord>
}

export const DRIVE_TOTAL_BYTES = 15 * 1024 ** 3
/** Space other files already use in the fake account. */
export const DRIVE_OTHER_BYTES = 2.4 * 1024 ** 3

export function memoryBlobStore(): BlobStore {
  const m = new Map<string, Blob>()
  return {
    get: async id => m.get(id),
    set: async (id, b) => void m.set(id, b),
    del: async id => void m.delete(id),
  }
}

/** Browser store; loaded lazily so unit tests in node never touch IndexedDB. */
export function idbBlobStore(): BlobStore {
  let store: Promise<{ get: (k: string) => Promise<Blob | undefined>; set: (k: string, v: Blob) => Promise<void>; del: (k: string) => Promise<void> }> | null = null
  const open = () => (store ??= import('idb-keyval').then(({ createStore, get, set, del }) => {
    const s = createStore('tilw-mock-drive', 'files')
    return { get: (k: string) => get<Blob>(k, s), set: (k: string, v: Blob) => set(k, v, s), del: (k: string) => del(k, s) }
  }))
  return {
    get: async id => (await open()).get(id),
    set: async (id, b) => (await open()).set(id, b),
    del: async id => (await open()).del(id),
  }
}

export interface FakeDriveDeps {
  state: () => FakeDriveState
  /** Persist after a change. */
  write: (fn: (s: FakeDriveState) => void) => void
  mode: () => DriveMode
  /** A token is valid when the mock storage is linked and the token was issued by the mock. */
  tokenOk: (token: string) => boolean
  blobs: BlobStore
  sleep: (ms: number) => Promise<void>
  /** Chunk size: Google requires multiples of 256 KiB; the real uploader uses 8 MiB. */
  chunkBytes?: number
}

const uid = () => Math.random().toString(36).slice(2, 12)

export function usedBytes(s: FakeDriveState): number {
  return Object.values(s.files).reduce((n, f) => n + f.sizeBytes, 0)
}

export function createFakeDrive(deps: FakeDriveDeps): DriveUploader {
  function auth(token: string) {
    if (deps.mode() === 'revoked' || !deps.tokenOk(token)) throw new PortError('storage_not_linked')
  }
  function room(total: number) {
    const free = DRIVE_TOTAL_BYTES - DRIVE_OTHER_BYTES - usedBytes(deps.state())
    if (deps.mode() === 'full' || total > free) throw new PortError('storage_full')
  }

  return {
    async start(file, meta, folderId, token): Promise<DriveSession> {
      auth(token)
      room(file.size)
      const url = `mock-drive://upload/${uid()}`
      deps.write((s) => {
        s.sessions[url] = { url, name: meta.name, mimeType: meta.mimeType, folderId, total: file.size, offset: 0 }
      })
      return { url }
    },

    async resume(session, file, token, onProgress, signal) {
      const slow = deps.mode() === 'slow'
      const chunk = slow ? Math.max(1, Math.ceil(file.size / 20)) : (deps.chunkBytes ?? 8 * 1024 * 1024)
      for (;;) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        auth(token)
        const rec = deps.state().sessions[session.url]
        // Google forgets sessions after about a week; the queue then starts a new one.
        if (!rec) throw new PortError('not_found')
        if (rec.offset >= rec.total) break
        room(0)
        if (slow) await deps.sleep(400)
        const next = Math.min(rec.total, rec.offset + chunk)
        deps.write(s => (s.sessions[session.url]!.offset = next))
        onProgress(next, rec.total)
      }
      const rec = deps.state().sessions[session.url]!
      const id = `drive_${uid()}`
      await deps.blobs.set(id, file)
      deps.write((s) => {
        s.files[id] = { id, name: rec.name, mimeType: rec.mimeType, sizeBytes: rec.total, folderId: rec.folderId, createdAt: Date.now() }
        delete s.sessions[session.url]
      })
      return { fileId: id }
    },

    async download(fileId, token) {
      auth(token)
      const f = deps.state().files[fileId]
      const blob = f ? await deps.blobs.get(fileId) : undefined
      if (!f || !blob) throw new PortError('not_found')
      return blob
    },

    async remove(fileId, token) {
      auth(token)
      await deps.blobs.del(fileId)
      deps.write(s => void delete s.files[fileId])
    },
  }
}
