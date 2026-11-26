import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

// The library's sort dropdown and direction button, with Nuxt's auto-imports stubbed as globals.

const script = (id: string, updatedAt: string) => ({ id, title: id, updatedAt, archivedAt: null, pinned: false })
const every = [script('a', '2026-01-03'), script('b', '2026-01-02'), script('c', '2026-01-01')]
const api = { page: vi.fn(), list: vi.fn(), search: vi.fn() }
const takes = {
  loaded: true,
  remoteLoaded: true,
  countByScript: new Map([['c', 2], ['b', 1]]),
}

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useServices', () => ({ scripts: api }))
  vi.stubGlobal('useTakesStore', () => takes)
  api.page.mockResolvedValue({ data: [], nextCursor: null, libraryCount: 3 })
  api.list.mockResolvedValue(every)
})

async function loadedStore() {
  const { useScriptsStore } = await import('~/stores/scripts')
  const store = useScriptsStore()
  await store.load()
  api.page.mockClear()
  return store
}
const settle = async () => {
  await nextTick()
  await new Promise(r => setTimeout(r))
}

describe('library sort', () => {
  it('orders by number of recordings, and the direction button turns it around', async () => {
    const store = await loadedStore()
    store.setSort('takes')
    await settle()
    expect(store.visible.map(s => s.id)).toEqual(['c', 'b', 'a'])
    expect(api.page).not.toHaveBeenCalled()

    store.reversed = true
    await settle()
    expect(store.visible.map(s => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('asks the service for the other direction, and a new sort starts in its usual one', async () => {
    const store = await loadedStore()
    store.reversed = true
    await settle()
    expect(api.page).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'recent', dir: 'asc' }))

    store.setSort('title')
    await settle()
    expect(store.reversed).toBe(false)
    expect(store.ascending).toBe(true)
    expect(api.page).toHaveBeenLastCalledWith(expect.not.objectContaining({ dir: expect.anything() }))
  })
})
