import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { memoryBlobStore } from '~/services/mock/drive'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError, type RemoteTakeInput } from '~/services/types'
import { mergeTakes, takePlace } from '~/utils/storage'

// US3 (T034): StoragePort and RemoteTakesPort contract on both adapters, and the take place shown in the UI.

const noSleep = () => Promise.resolve()
async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}
const input = (over: Partial<RemoteTakeInput> = {}): RemoteTakeInput => ({
  clientId: 't1', scriptId: 's_opening', title: 'افتتاحية الحلقة · المحاولة 1', kind: 'audio', mime: 'audio/webm',
  durationMs: 60_000, sizeBytes: 1000, recordedAt: '2026-11-20T10:00:00Z', ...over,
})

describe('storage in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep, blobs: memoryBlobStore() })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })

  it('starts not linked with sync off, and refuses tokens and sync until linked', async () => {
    expect(await m.services.storage.status()).toMatchObject({ state: 'none', syncMode: 'off', autoSyncAllowed: false, quota: null })
    expect(await code(m.services.storage.uploadToken())).toBe('storage_not_linked')
    expect(await code(m.services.storage.setSyncMode('manual'))).toBe('storage_not_linked')
    expect(await code(m.services.storage.setSyncMode('off'))).toBe('ok')
  })

  it('links through the consent URL and reports quota; auto needs Pro', async () => {
    expect(await m.services.storage.connectUrl('web')).toBe('http://test/app/settings/storage?linked=1')
    const st = await m.services.storage.status()
    expect(st).toMatchObject({ state: 'linked', provider: 'google_drive', accountEmail: 'layan@gmail.com' })
    expect(st.quota).toMatchObject({ tilwBytes: 0, tilwTakes: 0 })
    const e = await m.services.storage.setSyncMode('auto').catch(x => x)
    expect(isPortError(e, 'limit_reached')).toBe(true)
    expect(e.limit.key).toBe('storage.auto_sync')
    m.knobs.setPlan(userId, 'pro')
    expect(await m.services.storage.setSyncMode('auto')).toEqual({ mode: 'auto' })
    // Back on Free: auto becomes manual.
    m.knobs.setPlan(userId, 'free')
    expect((await m.services.storage.status()).syncMode).toBe('manual')
  })

  it('declined consent comes back with ?error=denied and links nothing', async () => {
    m.db.setKnobs({ denyDriveConsent: true })
    expect(await m.services.storage.connectUrl('web')).toContain('error=denied')
    expect((await m.services.storage.status()).state).toBe('none')
  })

  it('registers takes idempotently on clientId and checks the take length limit', async () => {
    await m.services.storage.connectUrl('web')
    const a = await m.services.remoteTakes.register(input())
    const b = await m.services.remoteTakes.register(input())
    expect(b.id).toBe(a.id)
    expect(a.state).toBe('uploading')
    const long = await m.services.remoteTakes.register(input({ clientId: 't2', durationMs: 11 * 60_000 })).catch(x => x)
    expect(long.limit).toEqual({ key: 'takes.max_minutes', value: 10, usage: 11 })
    m.db.setKnobs({ driveMode: 'full' })
    expect(await code(m.services.remoteTakes.register(input({ clientId: 't3' })))).toBe('storage_full')
  })

  it('updates and removes records; unlinking marks them unreachable', async () => {
    await m.services.storage.connectUrl('web')
    const t = await m.services.remoteTakes.register(input())
    expect((await m.services.remoteTakes.update(t.id, { state: 'backed_up', providerFileId: 'f1', starred: true })).starred).toBe(true)
    expect(await m.services.remoteTakes.list('s_backstage')).toEqual([])
    await m.services.storage.unlink()
    expect((await m.services.remoteTakes.list())[0]!.state).toBe('unreachable')
    expect(await code(m.services.remoteTakes.remove(t.id, { remote: true }))).toBe('storage_not_linked')
    await m.services.remoteTakes.remove(t.id, { remote: false })
    expect(await m.services.remoteTakes.list()).toEqual([])
    expect(await code(m.services.remoteTakes.update(t.id, { starred: false }))).toBe('not_found')
  })

  it('serves a take from another device: in Drive only, downloadable', async () => {
    await m.services.storage.connectUrl('web')
    await m.knobs.addRemoteOnlyTake(userId)
    const [r] = await m.services.remoteTakes.list()
    const tok = await m.services.storage.uploadToken(r!.scriptId)
    const file = await m.services.storage.uploader().download(r!.providerFileId!, tok.accessToken)
    expect(file.size).toBe(r!.sizeBytes)
    const merged = mergeTakes([], [r!])
    expect(merged[0]).toMatchObject({ driveOnly: true, id: `r_${r!.id}` })
    expect(takePlace(merged[0]!, undefined).place).toBe('driveOnly')
  })
})

describe('take place (data-model table)', () => {
  const device = { id: 't1', scriptId: 's', scriptTitle: 'A', number: 1, kind: 'audio' as const, mimeType: 'audio/webm', durationMs: 1, sizeBytes: 1, starred: false, createdAt: '2026-01-01T00:00:00Z' }
  it('derives every state from the device take, its record and the queue', () => {
    expect(takePlace(device, undefined).place).toBe('device')
    expect(takePlace(device, { takeId: 't1', state: 'waiting', sent: 0, total: 0, error: null }).place).toBe('waiting')
    expect(takePlace(device, { takeId: 't1', state: 'uploading', sent: 50, total: 200, error: null })).toEqual({ place: 'uploading', percent: 25 })
    expect(takePlace(device, { takeId: 't1', state: 'failed', sent: 0, total: 0, error: 'storage_full' })).toEqual({ place: 'failed', error: 'storage_full' })
    expect(takePlace({ ...device, remote: { id: 'r', state: 'backed_up', providerFileId: 'f' } }, undefined).place).toBe('drive')
    expect(takePlace({ ...device, driveOnly: true, remote: { id: 'r', state: 'unreachable', providerFileId: 'f' } }, undefined).place).toBe('unreachable')
  })
  it('merges by clientId: a device take that is backed up is not listed twice', () => {
    const r = { id: 'r1', clientId: 't1', scriptId: 's', title: 'A', kind: 'audio' as const, mime: 'audio/webm', durationMs: 1, sizeBytes: 1, recordedAt: '2026-01-01T00:00:00Z', starred: false, providerFileId: 'f', state: 'backed_up' as const }
    const merged = mergeTakes([device], [r])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.remote?.state).toBe('backed_up')
  })
})

describe('storage over HTTP', () => {
  it('maps the storage and take routes', async () => {
    const calls: string[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204, headers: { 'X-CSRF-TOKEN': 't' } })
      calls.push(`${init.method ?? 'GET'} ${url}`)
      if (String(url).includes('/google/connect')) return new Response(JSON.stringify({ url: 'https://accounts.google.test/o' }))
      return new Response(init.method === 'DELETE' ? null : JSON.stringify({}), { status: init.method === 'DELETE' ? 204 : 200 })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => null })
    await services.storage.status()
    expect(await services.storage.connectUrl('web')).toBe('https://accounts.google.test/o')
    await services.storage.setSyncMode('manual')
    await services.storage.uploadToken('s1')
    await services.storage.unlink()
    await services.remoteTakes.list('s1')
    await services.remoteTakes.register(input())
    await services.remoteTakes.update('r1', { state: 'backed_up', providerFileId: 'f' })
    await services.remoteTakes.remove('r1', { remote: true })
    expect(calls).toEqual([
      'GET http://api.test/api/storage',
      'GET http://api.test/api/storage/google/connect?client=web',
      'PUT http://api.test/api/user/sync',
      'POST http://api.test/api/storage/token',
      'DELETE http://api.test/api/storage',
      'GET http://api.test/api/takes?scriptId=s1',
      'POST http://api.test/api/takes',
      'PATCH http://api.test/api/takes/r1',
      'DELETE http://api.test/api/takes/r1?remote=1',
    ])
  })
})
