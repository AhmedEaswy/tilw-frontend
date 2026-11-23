import { describe, expect, it } from 'vitest'
import { createUploadQueue, memoryQueueStore, type QueueProgress, type QueueStore } from '~/services/drive/queue'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { memoryBlobStore } from '~/services/mock/drive'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createMemoryTakesRepo, type TakesRepo } from '~/services/takes'

// US3 (T033): the upload queue against the mock's fake Drive: persistence, resume, single owner, failures.

const tick = () => new Promise(r => setTimeout(r, 0))

/** A fake `navigator.locks`: one holder at a time, the next request waits. */
function fakeLocks() {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    request(_name: string, cb: () => Promise<unknown>) {
      const run = tail.then(cb)
      tail = run.catch(() => {})
      return run
    },
  }
}

/** BroadcastChannel stand-in shared by every "tab" in a test. */
function fakeBus() {
  const subs = new Set<(e: { data: unknown }) => void>()
  return () => {
    let mine: ((e: { data: unknown }) => void) | null = null
    return {
      postMessage: (m: unknown) => subs.forEach(s => s !== mine && s({ data: m })),
      addEventListener: (_t: 'message', cb: (e: { data: unknown }) => void) => void subs.add((mine = cb)),
      close: () => void (mine && subs.delete(mine)),
    }
  }
}

async function setup() {
  const m = createMockServices(memoryKV(), { sleep: () => Promise.resolve(), blobs: memoryBlobStore() })
  const user = await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  await m.services.storage.connectUrl('web')
  await m.services.storage.setSyncMode('manual')
  const takes = createMemoryTakesRepo()
  await takes.put({ id: 't1', scriptId: 's_opening', scriptTitle: 'افتتاحية الحلقة', number: 1, kind: 'audio', mimeType: 'audio/webm', durationMs: 4000, sizeBytes: 1000, starred: false, createdAt: '2026-11-20T10:00:00Z', blob: new Blob([new Uint8Array(1000)], { type: 'audio/webm' }) })
  return { m, user, takes }
}

function queueFor(env: { m: ReturnType<typeof createMockServices>; takes: TakesRepo }, store: QueueStore, extra: Partial<Parameters<typeof createUploadQueue>[0]> = {}) {
  return createUploadQueue({ store, takes: env.takes, storage: env.m.services.storage, remote: env.m.services.remoteTakes, retryDelayMs: 5, ...extra })
}

function until(q: ReturnType<typeof createUploadQueue>, states: QueueProgress['state'][]) {
  return new Promise<QueueProgress>(r => q.onProgress(p => states.includes(p.state) && r(p)))
}

describe('upload queue', () => {
  it('uploads a take to the fake Drive, records it and links the device take', async () => {
    const env = await setup()
    const q = queueFor(env, memoryQueueStore())
    const seen: string[] = []
    q.onProgress(p => seen.push(p.state))
    const done = until(q, ['done'])
    await q.start(env.user.id)
    await q.enqueue('t1')
    await done
    expect(seen[0]).toBe('waiting')
    expect(seen).toContain('uploading')
    const [rec] = await env.m.services.remoteTakes.list()
    expect(rec).toMatchObject({ clientId: 't1', state: 'backed_up' })
    expect(Object.keys(env.m.db.s.drive.files)).toEqual([rec!.providerFileId])
    expect((await env.takes.get('t1'))?.remote).toMatchObject({ id: rec!.id, state: 'backed_up' })
    expect(await q.entries()).toEqual([])
  })

  it('uploads takes whose script is unknown to the service, or "none", to the root folder with no script', async () => {
    const env = await setup()
    const base = { scriptTitle: 'قديم', number: 1, kind: 'audio' as const, mimeType: 'audio/webm', durationMs: 4000, sizeBytes: 10, starred: false, createdAt: '2026-11-20T10:00:00Z', blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }) }
    await env.takes.put({ ...base, id: 't_gone', scriptId: 's_deleted_long_ago' })
    await env.takes.put({ ...base, id: 't_none', scriptId: 'none' })
    const q = queueFor(env, memoryQueueStore())
    const done = new Set<string>()
    const both = new Promise<void>(r => q.onProgress(p => p.state === 'done' && done.add(p.takeId) && done.size === 2 && r()))
    await q.start(env.user.id)
    await q.enqueue('t_gone')
    await q.enqueue('t_none')
    await both
    const recs = await env.m.services.remoteTakes.list()
    expect(recs.filter(r => r.clientId !== 't1').map(r => [r.clientId, r.scriptId ?? null]).sort()).toEqual([['t_gone', null], ['t_none', null]])
  })

  it('keeps the session and offset, and resumes after a "reload" instead of restarting', async () => {
    const env = await setup()
    env.m.db.setKnobs({ driveMode: 'slow' })
    const store = memoryQueueStore()
    const first = queueFor(env, store)
    let sends = 0
    first.onProgress(p => p.state === 'uploading' && p.sent > 0 && ++sends === 3 && first.stop())
    await first.start(env.user.id)
    await first.enqueue('t1')
    while (sends < 3) await tick()
    await tick()
    const [saved] = await store.list()
    expect(saved!.sessionUrl).toMatch(/^mock-drive:\/\//)
    expect(saved!.offset).toBeGreaterThan(0)

    // Same browser, new page: a new queue picks the entry up from the saved session.
    env.m.db.setKnobs({ driveMode: 'ok' })
    const second = queueFor(env, store)
    const offsets: number[] = []
    second.onProgress(p => p.state === 'uploading' && offsets.push(p.sent))
    const done = until(second, ['done'])
    await second.start(env.user.id)
    await done
    expect(offsets[0]).toBe(saved!.offset) // resumed, not from 0
    expect(Object.keys(env.m.db.s.drive.files)).toHaveLength(1)
  })

  it('lets only the lock holder upload; the other tab sees the same progress', async () => {
    const env = await setup()
    const store = memoryQueueStore()
    const locks = fakeLocks()
    const bus = fakeBus()
    const a = queueFor(env, store, { locks, channel: bus })
    const b = queueFor(env, store, { locks, channel: bus })
    await a.start(env.user.id)
    await b.start(env.user.id)
    await tick()
    expect(a.isOwner).toBe(true)
    expect(b.isOwner).toBe(false)
    const seenByB = until(b, ['done'])
    await b.enqueue('t1') // added in the second tab, uploaded by the first
    expect((await seenByB).takeId).toBe('t1')
    expect(await env.m.services.remoteTakes.list()).toHaveLength(1)

    // The owner tab closes: the lock passes to the other tab.
    a.stop()
    await tick()
    expect(b.isOwner).toBe(true)
  })

  it('marks failures with the reason, keeps the device take, and retries', async () => {
    const env = await setup()
    env.m.db.setKnobs({ driveMode: 'full' })
    const q = queueFor(env, memoryQueueStore())
    const failed = until(q, ['failed'])
    await q.start(env.user.id)
    await q.enqueue('t1')
    expect(await failed).toMatchObject({ state: 'failed', error: 'storage_full' })
    expect(await env.takes.get('t1')).not.toBeNull() // SC-004: never removed from the device
    expect((await q.entries())[0]).toMatchObject({ state: 'failed', error: 'storage_full' })

    env.m.db.setKnobs({ driveMode: 'ok' })
    const done = until(q, ['done'])
    await q.retry('t1')
    await done
    expect(await env.takes.get('t1')).not.toBeNull()
  })

  it('reports storage_not_linked when Google revoked the link, and network after retries', async () => {
    const env = await setup()
    env.m.db.setKnobs({ driveMode: 'revoked' })
    const q = queueFor(env, memoryQueueStore())
    const failed = until(q, ['failed'])
    await q.start(env.user.id)
    await q.enqueue('t1')
    expect((await failed).error).toBe('storage_not_linked')

    const env2 = await setup()
    const q2 = queueFor(env2, memoryQueueStore(), { maxNetworkTries: 2 })
    env2.m.db.setKnobs({ offline: true })
    const net = until(q2, ['failed'])
    await q2.start(env2.user.id)
    await q2.enqueue('t1')
    expect((await net).error).toBe('network')
  })

  it('ignores other accounts\' entries and stops on sign-out', async () => {
    const env = await setup()
    const store = memoryQueueStore()
    await store.put({ key: 'someone:t9', userId: 'someone', takeId: 't9', remoteId: null, sessionUrl: null, offset: 0, total: 0, state: 'waiting', error: null, updatedAt: '2026-01-01T00:00:00Z' })
    const q = queueFor(env, store)
    await q.start(env.user.id)
    expect(await q.entries()).toEqual([])
    q.stop()
    await q.enqueue('t1') // signed out: nothing happens
    expect((await store.list()).map(e => e.key)).toEqual(['someone:t9'])
  })

  it('pauses while recording and resumes after', async () => {
    const env = await setup()
    const q = queueFor(env, memoryQueueStore())
    await q.start(env.user.id)
    q.pause()
    await q.enqueue('t1')
    await tick()
    expect(await env.m.services.remoteTakes.list()).toEqual([])
    const done = until(q, ['done'])
    q.resume()
    await done
  })
})
