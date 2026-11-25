import { describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createHttpServices } from '~/services/http'

// The library's paged list (backend ScriptController::page): load more, filters, sort and search.
describe('scripts.page', () => {
  async function signedIn() {
    const m = createMockServices(memoryKV(), { origin: 'http://test', sleep: () => Promise.resolve() })
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    return m.services
  }

  it('pages through every active script with the cursor, without repeats', async () => {
    const s = await signedIn()
    for (let i = 0; i < 5; i++) await s.scripts.create({ title: `Extra ${i}` })
    const all = (await s.scripts.list()).filter(x => !x.archivedAt).map(x => x.id)

    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page = await s.scripts.page({ limit: 3, cursor })
      seen.push(...page.data.map(x => x.id))
      expect(page.libraryCount).toBe((await s.scripts.list()).length)
      cursor = page.nextCursor
      pages++
    } while (cursor && pages < 20)

    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort()).toEqual([...all].sort())
  })

  it('filters, sorts and searches like the service', async () => {
    const s = await signedIn()
    const a = await s.scripts.create({ title: 'Alpha zebra', body: 'needle here' })
    const b = await s.scripts.create({ title: 'Beta' })
    await s.scripts.update(b.id, { pinned: true }, b.version)
    const c = await s.scripts.create({ title: 'Gamma' })
    await s.scripts.update(c.id, { archivedAt: new Date().toISOString() }, c.version)

    expect((await s.scripts.page({ limit: 50, filter: 'pinned' })).data.map(x => x.id)).toContain(b.id)
    expect((await s.scripts.page({ limit: 50, filter: 'pinned' })).data.every(x => x.pinned && !x.archivedAt)).toBe(true)
    expect((await s.scripts.page({ limit: 50, filter: 'archived' })).data.map(x => x.id)).toContain(c.id)
    expect((await s.scripts.page({ limit: 50 })).data.map(x => x.id)).not.toContain(c.id)
    expect((await s.scripts.page({ limit: 50, q: 'needle' })).data.map(x => x.id)).toEqual([a.id])
    const titles = (await s.scripts.page({ limit: 50, sort: 'title' })).data.map(x => x.title)
    expect(titles).toEqual([...titles].sort((x, y) => x.localeCompare(y)))
    await expect(s.scripts.page({ limit: 0 })).rejects.toMatchObject({ code: 'validation' })
  })

  it('the HTTP adapter sends the paging parameters', async () => {
    const urls: string[] = []
    const fetch = (async (url: string) => {
      urls.push(String(url))
      return new Response(JSON.stringify({ data: [], nextCursor: null, libraryCount: 0 }), { status: 200 })
    }) as unknown as typeof globalThis.fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test/', fetch, readCookie: () => null })

    await services.scripts.page({ limit: 20, filter: 'pinned', sort: 'title', q: ' حلقة ', cursor: 'abc' })
    await services.scripts.page({ limit: 20 })

    expect(urls[0]).toBe(`http://api.test/api/scripts?limit=20&filter=pinned&sort=title&q=${encodeURIComponent('حلقة')}&cursor=abc`)
    expect(urls[1]).toBe('http://api.test/api/scripts?limit=20')
  })
})
