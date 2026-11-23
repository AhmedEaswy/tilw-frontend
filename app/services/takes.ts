/**
 * Takes repository (contracts/ports.md → TakesRepo). Recordings live in this browser (constitution IV). Release 2:
 * when the person chooses, a copy also goes straight from the browser to their own Google Drive (services/drive);
 * this repository stays device-only and only remembers the link to that copy in `remote`.
 *
 * Metadata and the media blob are stored under separate keys so the recordings list can load without
 * reading every file: `tilw:take-meta:<id>` and `tilw:take:<id>`.
 */
import { createStore, del, get, getMany, keys, set, type UseStore } from 'idb-keyval'
import type { RemoteTakeState } from './types'

export interface TakeMeta {
  id: string
  scriptId: string
  /** Snapshot so the list survives a renamed or deleted script. */
  scriptTitle: string
  /** "المحاولة 2" — counts per script. */
  number: number
  label?: string
  kind: 'audio' | 'video'
  mimeType: string
  durationMs: number
  sizeBytes: number
  starred: boolean
  /** Set when the take stopped on its own (10-minute cap, device lost, storage full). */
  endedBy?: 'limit' | 'interrupted' | 'quota'
  /** Small JPEG data URL of the first frame (video takes), made the first time the list shows it. */
  poster?: string
  createdAt: string
  /** Release 2: the service's record of this take's copy in Drive. */
  remote?: { id: string; state: RemoteTakeState; providerFileId: string | null }
  /** UI only: a take whose only copy is in Drive (made on another device, or this browser was cleared). */
  driveOnly?: boolean
}

export interface Take extends TakeMeta {
  blob: Blob
}

export interface TakesRepo {
  list(): Promise<TakeMeta[]>
  get(id: string): Promise<Take | null>
  put(take: Take): Promise<void>
  update(id: string, patch: Partial<Pick<TakeMeta, 'starred' | 'label' | 'poster' | 'remote'>>): Promise<TakeMeta>
  remove(id: string): Promise<void>
  estimate(): Promise<{ quota?: number; usage?: number } | null>
}

const META = 'tilw:take-meta:'
const BLOB = 'tilw:take:'

/** Minimal key-value surface shared by IndexedDB and the in-memory test store. */
interface KV {
  get<T>(k: string): Promise<T | undefined>
  getMany<T>(ks: string[]): Promise<(T | undefined)[]>
  set(k: string, v: unknown): Promise<void>
  del(k: string): Promise<void>
  keys(): Promise<string[]>
}

function repo(kv: KV, estimate: TakesRepo['estimate']): TakesRepo {
  return {
    async list() {
      const metaKeys = (await kv.keys()).filter(k => k.startsWith(META))
      const metas = (await kv.getMany<TakeMeta>(metaKeys)).filter((m): m is TakeMeta => !!m)
      return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async get(id) {
      const [meta, blob] = await Promise.all([kv.get<TakeMeta>(META + id), kv.get<Blob>(BLOB + id)])
      return meta && blob ? { ...meta, blob } : null
    },
    async put(take) {
      const { blob, ...meta } = take
      // Blob first: a take is only listed once its media is safely stored.
      await kv.set(BLOB + take.id, blob)
      await kv.set(META + take.id, meta)
    },
    async update(id, patch) {
      const meta = await kv.get<TakeMeta>(META + id)
      if (!meta) throw new Error('not_found')
      const next = { ...meta, ...patch }
      await kv.set(META + id, next)
      return next
    },
    async remove(id) {
      await kv.del(META + id)
      await kv.del(BLOB + id)
    },
    estimate,
  }
}

export function createIdbTakesRepo(): TakesRepo {
  const store: UseStore = createStore('tilw-takes', 'takes')
  return repo(
    {
      get: k => get(k, store),
      getMany: ks => getMany(ks, store),
      set: (k, v) => set(k, v, store),
      del: k => del(k, store),
      keys: () => keys<string>(store),
    },
    async () => {
      try {
        return (await navigator.storage?.estimate?.()) ?? null
      } catch {
        return null
      }
    },
  )
}

export function createMemoryTakesRepo(quota?: { quota: number; usage: number }): TakesRepo {
  const m = new Map<string, unknown>()
  return repo(
    {
      get: async <T>(k: string) => m.get(k) as T | undefined,
      getMany: async <T>(ks: string[]) => ks.map(k => m.get(k) as T | undefined),
      set: async (k, v) => void m.set(k, v),
      del: async k => void m.delete(k),
      keys: async () => [...m.keys()],
    },
    async () => quota ?? null,
  )
}
