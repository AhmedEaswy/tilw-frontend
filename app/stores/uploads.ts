import { defineStore } from 'pinia'
import { createUploadQueue, idbQueueStore, type QueueProgress, type UploadQueue } from '~/services/drive/queue'

/**
 * Release 2 (US3): live state of take uploads to Drive, mirrored from the upload queue (services/drive/queue.ts),
 * which one tab owns while every tab sees the same progress. Starts with sign-in and stops with sign-out, on every
 * layout (plugins/uploads.client.ts).
 */
let queue: UploadQueue | null = null

export const useUploadsStore = defineStore('uploads', () => {
  const entries = ref<Record<string, QueueProgress>>({})
  let off: (() => void) | null = null

  function q(): UploadQueue | null {
    if (!import.meta.client) return null
    if (queue) return queue
    const services = useServices()
    const { t } = useNuxtApp().$i18n as unknown as { t: (k: string, p?: Record<string, unknown>) => string }
    queue = createUploadQueue({
      store: idbQueueStore(),
      takes: useTakesRepo(),
      storage: services.storage,
      remote: services.remoteTakes,
      locks: typeof navigator !== 'undefined' && navigator.locks
        ? { request: (name, cb) => navigator.locks.request(name, cb) }
        : undefined,
      channel: typeof BroadcastChannel !== 'undefined' ? () => new BroadcastChannel('tilw-uploads') : undefined,
      titleFor: take => `${take.scriptTitle} · ${t('recordings.take', { n: take.number })}`,
      fileNameFor: take => takeFileName(take.scriptTitle, take.number, take.mimeType, t('studio.takeWord')),
    })
    return queue
  }

  async function start(userId: string) {
    const queue = q()
    if (!queue) return
    off?.()
    off = queue.onProgress((p) => {
      if (p.state === 'done' || p.state === 'removed') {
        const { [p.takeId]: _gone, ...rest } = entries.value
        entries.value = rest
        if (p.state === 'done') void useTakesStore().refreshOne(p.takeId)
        return
      }
      entries.value = { ...entries.value, [p.takeId]: p }
    })
    await queue.start(userId)
    const list = await queue.entries()
    entries.value = Object.fromEntries(list.map(e => [e.takeId, { takeId: e.takeId, state: e.state, sent: e.offset, total: e.total, error: e.error }]))
    // Auto sync: takes recorded while the queue wasn't running (or before a reload) still go to Drive.
    const storage = useStorageStore()
    if (!storage.status) await storage.load().catch(() => {})
    if (storage.linked && storage.syncMode === 'auto') await queue.backfill()
  }

  function stop() {
    off?.()
    off = null
    queue?.stop()
    entries.value = {}
  }

  const enqueue = (takeId: string) => q()?.enqueue(takeId)
  const retry = (takeId: string) => q()?.retry(takeId)
  const cancel = (takeId: string) => q()?.cancel(takeId)
  const pause = () => q()?.pause()
  const resume = () => q()?.resume()
  /** Drive was unlinked: stop uploading and keep the entries as failed until the person links again. */
  const unlinked = () => q()?.unlinked()

  return { entries, start, stop, enqueue, retry, cancel, pause, resume, unlinked }
})
