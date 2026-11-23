import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createMockServices, VERSION_GAP_MS } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'

// US5 (T049): script history: the 10-minute rule, newest first, preview, restore, trimming and conflicts.

const noSleep = () => Promise.resolve()

describe('script history in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  const id = 's_letter'
  /** Edit the body, then move the clock past the 10-minute gap. */
  async function edit(body: string, advance = VERSION_GAP_MS + 60_000) {
    const s = await m.services.scripts.get(id)
    const out = await m.services.scripts.update(id, { body }, s.version)
    m.db.setKnobs({ clockOffsetMs: (m.db.knobs.clockOffsetMs || 0) + advance })
    return out
  }
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { sleep: noSleep })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })

  it('keeps at most one edit snapshot per 10 minutes of editing, newest first', async () => {
    const original = (await m.services.scripts.get(id)).body
    await edit('one', 60_000) // first edit: snapshot of the original
    await edit('two', VERSION_GAP_MS) // within 10 minutes of that snapshot: none
    await edit('three') // more than 10 minutes later: snapshot of "two"
    const list = await m.services.scripts.listVersions(id)
    expect(list).toHaveLength(2)
    expect(list.every(v => v.reason === 'edit')).toBe(true)
    expect(Date.parse(list[0]!.createdAt)).toBeGreaterThan(Date.parse(list[1]!.createdAt))
    expect((await m.services.scripts.getVersion(id, list[1]!.id)).body).toBe(original)
    expect((await m.services.scripts.getVersion(id, list[0]!.id)).body).toBe('two')
  })

  it('restores a version, keeping the current text as "restore", and rejects a stale version', async () => {
    await edit('first')
    await edit('second')
    const [newest] = await m.services.scripts.listVersions(id)
    const current = await m.services.scripts.get(id)
    expect(isPortError(await m.services.scripts.restoreVersion(id, newest!.id, current.version - 1).catch(e => e), 'conflict')).toBe(true)
    const restored = await m.services.scripts.restoreVersion(id, newest!.id, current.version)
    expect(restored.body).toBe('first')
    expect(restored.version).toBe(current.version + 1)
    const after = await m.services.scripts.listVersions(id)
    expect(after[0]!.reason).toBe('restore')
    expect((await m.services.scripts.getVersion(id, after[0]!.id)).body).toBe('second')
  })

  it('trims to history.versions on Free (5), and keeps more on Pro', async () => {
    for (let i = 0; i < 8; i++) await edit(`v${i}`)
    expect(await m.services.scripts.listVersions(id)).toHaveLength(5)
    m.knobs.setPlan(userId, 'pro')
    for (let i = 0; i < 3; i++) await edit(`p${i}`)
    expect(await m.services.scripts.listVersions(id)).toHaveLength(8)
  })

  it('refuses a restore on a read-only script', async () => {
    await edit('x')
    m.knobs.setPlanLimit('free', 'scripts.max_active', 0)
    const [v] = await m.services.scripts.listVersions(id)
    const s = await m.services.scripts.get(id)
    expect(s.readOnly).toBe(true)
    expect(isPortError(await m.services.scripts.restoreVersion(id, v!.id, s.version).catch(e => e), 'limit_reached')).toBe(true)
  })

  it('answers not_found for an unknown version', async () => {
    expect(isPortError(await m.services.scripts.getVersion(id, 'v_nope').catch(e => e), 'not_found')).toBe(true)
  })
})

describe('script history over HTTP', () => {
  it('lists, reads and restores with If-Match', async () => {
    const calls: { method: string; url: string; headers: Record<string, string> }[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? 'GET', url: String(url), headers: (init.headers ?? {}) as Record<string, string> })
      if (String(url).endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204, headers: { 'X-CSRF-TOKEN': 't' } })
      return new Response(JSON.stringify({ id: 'x' }), { status: 200 })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => null })
    await services.scripts.listVersions('s1')
    await services.scripts.getVersion('s1', 'v1')
    await services.scripts.restoreVersion('s1', 'v1', 7)
    const api = calls.filter(c => !c.url.endsWith('csrf-cookie'))
    expect(api.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET http://api.test/api/scripts/s1/versions',
      'GET http://api.test/api/scripts/s1/versions/v1',
      'POST http://api.test/api/scripts/s1/versions/v1/restore',
    ])
    expect(api[2]!.headers['If-Match']).toBe('7')
  })
})
