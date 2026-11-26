import { defineStore } from 'pinia'
import type { StorageStatus, SyncMode } from '~/services/types'

/**
 * Linked storage (release 2, US3): Google Drive link, sync mode and space figures. Only metadata comes from the
 * service; take files go from the browser straight to Drive (services/drive).
 */
export const useStorageStore = defineStore('storage', () => {
  const status = ref<StorageStatus | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  const linked = computed(() => status.value?.state === 'linked')
  const syncMode = computed<SyncMode>(() => (linked.value ? status.value!.syncMode : 'off'))

  async function load() {
    loading.value = true
    try {
      status.value = await useServices().storage.status()
      error.value = null
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Leaves the app for Google's consent page; it comes back to /app/settings/storage?linked=1|error=… */
  async function connect() {
    const url = await useServices().storage.connectUrl('web')
    window.location.assign(url)
  }

  async function unlink() {
    await useServices().storage.unlink()
    // Nothing more goes to Drive: drop cached Drive tokens and stop the running and queued uploads.
    await useUploadsStore().unlinked()
    await load()
  }

  async function setSyncMode(mode: SyncMode) {
    const before = status.value
    if (before) status.value = { ...before, syncMode: mode }
    try {
      await useServices().storage.setSyncMode(mode)
    } catch (e) {
      status.value = before
      throw e
    }
    // Takes already on this device go too, without waiting for the next app start.
    if (mode === 'auto') void Promise.resolve(useUploadsStore().backfill()).catch(() => {})
  }

  function reset() {
    status.value = null
  }

  return { status, loading, error, linked, syncMode, load, connect, unlink, setSyncMode, reset }
})
