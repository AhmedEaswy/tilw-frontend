import { defineStore } from 'pinia'
import { createIdbTakesRepo, type Take, type TakeMeta, type TakesRepo } from '~/services/takes'
import { isPortError, type RemoteTake } from '~/services/types'
import { mergeTakes } from '~/utils/storage'

/**
 * Takes kept in this browser (US6 T076, US7). Holds metadata only; blobs are read when a take is reviewed
 * or downloaded. Release 2 (US3): with linked storage, the service's take records are merged in by `clientId`, so a
 * take backed up from another device shows as "In Drive only" and plays from Drive. With sync off and no link,
 * nothing about takes is sent to or read from the service (release-1 behaviour).
 */
let repoSingleton: TakesRepo | null = null
export function useTakesRepo(): TakesRepo {
  return (repoSingleton ??= createIdbTakesRepo())
}
/** Tests swap in the in-memory repo. */
export function setTakesRepo(r: TakesRepo | null) {
  repoSingleton = r
}

export const useTakesStore = defineStore('takes', () => {
  const list = ref<TakeMeta[]>([])
  const loaded = ref(false)
  /** Release 2: the service's records of takes in Drive (every device). */
  const remote = ref<RemoteTake[]>([])
  const remoteLoaded = ref(false)
  /** Device takes plus Drive-only takes, newest first. */
  const all = computed(() => mergeTakes(list.value, remote.value))
  /** Recordings per script id, as the library shows (and sorts by) them. */
  const countByScript = computed(() => {
    const m = new Map<string, number>()
    for (const x of all.value) if (x.scriptId) m.set(x.scriptId, (m.get(x.scriptId) ?? 0) + 1)
    return m
  })
  const estimate = ref<{ quota?: number; usage?: number } | null>(null)

  const free = computed(() => freeBytes(estimate.value))
  const lowStorage = computed(() => free.value !== null && free.value < LOW_STORAGE_BYTES)

  async function load() {
    list.value = await useTakesRepo().list()
    loaded.value = true
    await refreshEstimate()
  }

  async function refreshEstimate() {
    estimate.value = await useTakesRepo().estimate()
    return free.value
  }

  function nextNumber(scriptId: string) {
    return list.value.filter(t => t.scriptId === scriptId).reduce((n, t) => Math.max(n, t.number), 0) + 1
  }

  async function save(input: Omit<Take, 'id' | 'number' | 'starred' | 'createdAt' | 'sizeBytes'>) {
    if (!loaded.value) await load()
    const take: Take = {
      ...input,
      id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      number: nextNumber(input.scriptId),
      starred: false,
      sizeBytes: input.blob.size,
      createdAt: new Date().toISOString(),
    }
    await useTakesRepo().put(take)
    const { blob: _b, ...meta } = take
    list.value = [meta, ...list.value]
    void refreshEstimate()
    return meta
  }

  async function remove(id: string) {
    await useTakesRepo().remove(id)
    list.value = list.value.filter(t => t.id !== id)
    void useUploadsStore().cancel(id)
    void refreshEstimate()
  }

  /**
   * Release 2: read the service's take records (metadata only; this sends nothing about the device's takes). Read even
   * when Drive is unlinked, so takes that were only in Drive show as "Not reachable" (US3 #9).
   */
  async function loadRemote() {
    const storage = useStorageStore()
    if (!storage.status) await storage.load().catch(() => {})
    try {
      remote.value = await useServices().remoteTakes.list()
    } finally {
      remoteLoaded.value = true
    }
  }

  const find = (id: string) => all.value.find(t => t.id === id) ?? null

  /**
   * Delete a take (R2-8). `everywhere` also deletes its Drive copy and record; otherwise a backed-up take stays in
   * Drive and shows as "In Drive only". A Drive-only take is always removed from Drive.
   */
  async function removeTake(id: string, everywhere: boolean) {
    const t = find(id)
    if (!t) return
    if (t.driveOnly) {
      await useServices().remoteTakes.remove(t.remote!.id, { remote: t.remote!.state !== 'unreachable' })
      remote.value = remote.value.filter(r => r.id !== t.remote!.id)
      return
    }
    if (everywhere && t.remote?.id) {
      await useServices().remoteTakes.remove(t.remote.id, { remote: true })
      remote.value = remote.value.filter(r => r.id !== t.remote!.id)
    }
    await remove(id)
  }

  /** Remove a device take's copy from Drive (and its record); the original stays in this browser. */
  async function unsync(id: string) {
    const t = find(id)
    if (!t || t.driveOnly || !t.remote?.id) return
    await useServices().remoteTakes.remove(t.remote.id, { remote: true })
    remote.value = remote.value.filter(r => r.id !== t.remote!.id)
    const meta = await useTakesRepo().update(id, { remote: undefined })
    list.value = list.value.map(x => (x.id === id ? meta : x))
  }

  async function setStarred(id: string, starred: boolean) {
    const t = find(id)
    if (t?.driveOnly) {
      const r = await useServices().remoteTakes.update(t.remote!.id, { starred })
      remote.value = remote.value.map(x => (x.id === r.id ? r : x))
      return
    }
    const meta = await useTakesRepo().update(id, { starred })
    list.value = list.value.map(t => (t.id === id ? meta : t))
  }

  /** The take's file: from this browser, or streamed from Drive for a Drive-only take. */
  async function blobFor(id: string): Promise<Blob | null> {
    const t = find(id)
    if (!t) return null
    if (!t.driveOnly) return (await useTakesRepo().get(id))?.blob ?? null
    const fileId = t.remote?.providerFileId
    if (!fileId) return null
    try {
      const tok = await useServices().storage.uploadToken(t.scriptId === 'none' ? null : t.scriptId)
      return await useServices().storage.uploader().download(fileId, tok.accessToken)
    } catch (e) {
      if (isPortError(e, 'not_found')) await markUnreachable(t.remote!.id)
      throw e
    }
  }

  async function markUnreachable(remoteId: string) {
    try {
      const r = await useServices().remoteTakes.update(remoteId, { state: 'unreachable' })
      remote.value = remote.value.map(x => (x.id === r.id ? r : x))
    } catch { /* shown as failed next time */ }
  }

  /** After an upload finishes: refresh the device meta (it now links to Drive) and the remote list. */
  async function refreshOne(id: string) {
    const take = await useTakesRepo().get(id)
    if (take) {
      const { blob: _b, ...meta } = take
      list.value = list.value.map(t => (t.id === id ? meta : t))
    }
    if (useStorageStore().linked) void loadRemote().catch(() => {})
  }

  async function setPoster(id: string, poster: string) {
    const meta = await useTakesRepo().update(id, { poster })
    list.value = list.value.map(t => (t.id === id ? meta : t))
  }

  /** Takes grouped by script, newest script activity first; each group newest take first. */
  const groups = computed(() => {
    const by = new Map<string, TakeMeta[]>()
    for (const t of all.value) (by.get(t.scriptId) ?? by.set(t.scriptId, []).get(t.scriptId)!).push(t)
    return [...by.values()]
  })

  const forScript = (scriptId: string) => list.value.filter(t => t.scriptId === scriptId)

  function reset() {
    remote.value = []
    remoteLoaded.value = false
  }

  return {
    list, loaded, estimate, free, lowStorage, groups, remote, remoteLoaded, all, countByScript,
    load, refreshEstimate, save, remove, removeTake, unsync, setStarred, setPoster, forScript, nextNumber,
    loadRemote, find, blobFor, markUnreachable, refreshOne, reset,
  }
})
