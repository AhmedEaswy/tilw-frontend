import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'
import { PortError } from '~/services/types'

// Review fixes (002): store and plugin wiring, with Nuxt's auto-imports stubbed as globals.

const services = {
  auth: { me: vi.fn() },
  storage: { unlink: vi.fn(), status: vi.fn() },
}
const uploads = { start: vi.fn(), stop: vi.fn(), unlinked: vi.fn() }
const reset = { reset: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useServices', () => services)
  vi.stubGlobal('useUploadsStore', () => uploads)
  vi.stubGlobal('useScriptsStore', () => reset)
  vi.stubGlobal('usePlanStore', () => reset)
})

describe('auth.init', () => {
  async function store() {
    const { useAuthStore } = await import('~/stores/auth')
    vi.stubGlobal('useStorageStore', () => reset)
    return useAuthStore()
  }

  it('treats only "unauthenticated" as signed out', async () => {
    const auth = await store()
    services.auth.me.mockRejectedValueOnce(new PortError('unauthenticated'))
    await auth.init()
    expect(auth.status).toBe('guest')
  })

  it('stays unknown on a network or server error, and the next init asks again', async () => {
    const auth = await store()
    services.auth.me.mockRejectedValueOnce(new PortError('network')).mockRejectedValueOnce(new PortError('unknown'))
    await auth.init()
    expect(auth.status).toBe('unknown')
    await auth.init()
    expect(auth.status).toBe('unknown')
    services.auth.me.mockResolvedValueOnce({ id: 'u1', email: 'a@b.c' })
    await auth.init()
    expect(auth.status).toBe('authed')
    expect(services.auth.me).toHaveBeenCalledTimes(3)
  })
})

describe('storage.unlink', () => {
  it('stops uploads (and their cached Drive tokens) after the service unlinks', async () => {
    const { useStorageStore } = await import('~/stores/storage')
    services.storage.unlink.mockResolvedValue(undefined)
    services.storage.status.mockResolvedValue({ state: 'none', accountEmail: null, syncMode: 'off' })
    await useStorageStore().unlink()
    expect(services.storage.unlink).toHaveBeenCalledOnce()
    expect(uploads.unlinked).toHaveBeenCalledOnce()
  })

  it('keeps uploading when the service refuses to unlink', async () => {
    const { useStorageStore } = await import('~/stores/storage')
    services.storage.unlink.mockRejectedValue(new PortError('network'))
    await expect(useStorageStore().unlink()).rejects.toThrow()
    expect(uploads.unlinked).not.toHaveBeenCalled()
  })
})

describe('uploads plugin', () => {
  it('starts the queue for whoever is signed in on any layout, and stops it on sign-out', async () => {
    const user = ref<{ id: string } | null>({ id: 'u1' })
    vi.stubGlobal('defineNuxtPlugin', (fn: unknown) => fn)
    vi.stubGlobal('useAuthStore', () => ({ get user() { return user.value } }))
    const plugin = (await import('~/plugins/uploads.client')).default as unknown as (app: { runWithContext: <T>(f: () => T) => T }) => void
    plugin({ runWithContext: f => f() })
    expect(uploads.start).toHaveBeenCalledWith('u1')
    user.value = null
    await nextTick()
    expect(uploads.stop).toHaveBeenCalledOnce()
    user.value = { id: 'u2' }
    await nextTick()
    expect(uploads.start).toHaveBeenLastCalledWith('u2')
  })
})
