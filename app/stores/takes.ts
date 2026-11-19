import { defineStore } from 'pinia'
import { createIdbTakesRepo, type Take, type TakeMeta, type TakesRepo } from '~/services/takes'

/**
 * Takes kept in this browser (US6 T076, US7). Holds metadata only; blobs are read when a take is reviewed
 * or downloaded. Nothing here talks to the account service: recordings never leave the device.
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
    void refreshEstimate()
  }

  async function setStarred(id: string, starred: boolean) {
    const meta = await useTakesRepo().update(id, { starred })
    list.value = list.value.map(t => (t.id === id ? meta : t))
  }

  async function setPoster(id: string, poster: string) {
    const meta = await useTakesRepo().update(id, { poster })
    list.value = list.value.map(t => (t.id === id ? meta : t))
  }

  /** Takes grouped by script, newest script activity first; each group newest take first. */
  const groups = computed(() => {
    const by = new Map<string, TakeMeta[]>()
    for (const t of list.value) (by.get(t.scriptId) ?? by.set(t.scriptId, []).get(t.scriptId)!).push(t)
    return [...by.values()]
  })

  const forScript = (scriptId: string) => list.value.filter(t => t.scriptId === scriptId)

  return { list, loaded, estimate, free, lowStorage, groups, load, refreshEstimate, save, remove, setStarred, setPoster, forScript, nextNumber }
})
