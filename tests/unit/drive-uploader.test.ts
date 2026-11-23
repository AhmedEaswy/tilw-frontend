import { describe, expect, it } from 'vitest'
import { CHUNK_BYTES, createDriveUploader, DRIVE_UPLOAD, DriveTokenError, rangeEnd } from '~/services/drive/uploader'
import { createUploadQueue, memoryQueueStore, TOKEN_MARGIN_MS } from '~/services/drive/queue'
import type { RemoteTakesPort, StoragePort } from '~/services/ports'
import { createMemoryTakesRepo } from '~/services/takes'
import { isPortError, type RemoteTake } from '~/services/types'

// US3 (T032): Google's resumable upload protocol over fetch, and how its errors map.

interface Call { method: string; url: string; headers: Record<string, string>; size: number }

/** A fake resumable endpoint that keeps how many bytes it has. */
function fakeGoogle(opts: { failWith?: { status: number; reason?: string }; startAt?: number } = {}) {
  const calls: Call[] = []
  let have = opts.startAt ?? 0
  const f = (async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    const body = init.body as Blob | string | undefined
    calls.push({ method: init.method ?? 'GET', url: String(url), headers, size: body instanceof Blob ? body.size : 0 })
    if (opts.failWith) {
      return new Response(JSON.stringify({ error: { errors: [{ reason: opts.failWith.reason }] } }), { status: opts.failWith.status })
    }
    if (String(url).startsWith(DRIVE_UPLOAD)) return new Response(null, { status: 200, headers: { Location: 'https://upload.test/session/1' } })
    const range = headers['Content-Range']!
    const total = Number(range.split('/')[1])
    if (range.startsWith('bytes */')) {
      if (have >= total) return new Response(JSON.stringify({ id: 'file_1' }), { status: 200 })
      return new Response(null, { status: 308, headers: have ? { Range: `bytes=0-${have - 1}` } : {} })
    }
    have += body instanceof Blob ? body.size : 0
    if (have >= total) return new Response(JSON.stringify({ id: 'file_1' }), { status: 201 })
    return new Response(null, { status: 308, headers: { Range: `bytes=0-${have - 1}` } })
  }) as unknown as typeof fetch
  return { f, calls }
}

const blob = (n: number) => new Blob([new Uint8Array(n)], { type: 'video/webm' })

describe('Drive uploader', () => {
  it('opens a resumable session with the file metadata and reads Location', async () => {
    const g = fakeGoogle()
    const up = createDriveUploader({ fetch: g.f })
    const s = await up.start(blob(10), { name: 'take.webm', mimeType: 'video/webm' }, 'folder_1', 'tok')
    expect(s.url).toBe('https://upload.test/session/1')
    const c = g.calls[0]!
    expect(c.url).toContain('uploadType=resumable')
    expect(c.headers.Authorization).toBe('Bearer tok')
    expect(c.headers['X-Upload-Content-Length']).toBe('10')
  })

  it('sends chunks with Content-Range and follows 308 Range to the end', async () => {
    const g = fakeGoogle()
    const chunk = 256 * 1024
    const up = createDriveUploader({ fetch: g.f, chunkBytes: chunk })
    const progress: number[] = []
    const r = await up.resume({ url: 'https://upload.test/session/1' }, blob(chunk * 2 + 100), 'tok', s => progress.push(s))
    expect(r).toEqual({ fileId: 'file_1' })
    const puts = g.calls.filter(c => !c.headers['Content-Range']!.startsWith('bytes */'))
    expect(puts.map(c => c.headers['Content-Range'])).toEqual([
      `bytes 0-${chunk - 1}/${chunk * 2 + 100}`,
      `bytes ${chunk}-${chunk * 2 - 1}/${chunk * 2 + 100}`,
      `bytes ${chunk * 2}-${chunk * 2 + 99}/${chunk * 2 + 100}`,
    ])
    expect(progress.at(-1)).toBe(chunk * 2 + 100)
    expect(CHUNK_BYTES).toBe(8 * 1024 * 1024)
  })

  it('resumes from the offset Google reports after a reload', async () => {
    const g = fakeGoogle({ startAt: 300 })
    const up = createDriveUploader({ fetch: g.f, chunkBytes: 256 * 1024 })
    await up.resume({ url: 'https://upload.test/session/1' }, blob(500), 'tok', () => {})
    const puts = g.calls.filter(c => !c.headers['Content-Range']!.startsWith('bytes */'))
    expect(puts.map(c => c.headers['Content-Range'])).toEqual(['bytes 300-499/500'])
    expect(rangeEnd('bytes=0-299')).toBe(300)
    expect(rangeEnd(null)).toBe(0)
  })

  it('maps 403 storageQuotaExceeded to storage_full and 401 to a token error', async () => {
    const full = createDriveUploader({ fetch: fakeGoogle({ failWith: { status: 403, reason: 'storageQuotaExceeded' } }).f })
    const e1 = await full.resume({ url: 'u' }, blob(10), 't', () => {}).catch(e => e)
    expect(isPortError(e1, 'storage_full')).toBe(true)
    const expired = createDriveUploader({ fetch: fakeGoogle({ failWith: { status: 401 } }).f })
    expect(await expired.start(blob(1), { name: 'a', mimeType: 'audio/webm' }, 'f', 't').catch(e => e)).toBeInstanceOf(DriveTokenError)
    const gone = createDriveUploader({ fetch: fakeGoogle({ failWith: { status: 404 } }).f })
    expect(isPortError(await gone.resume({ url: 'u' }, blob(1), 't', () => {}).catch(e => e), 'not_found')).toBe(true)
  })
})

describe('Drive tokens in the queue', () => {
  function setup(drive: Partial<ReturnType<StoragePort['uploader']>>, expiresInMs = 3_600_000) {
    let issued = 0
    const record: RemoteTake = { id: 'rt1', clientId: 't1', scriptId: 's1', title: 'x', kind: 'audio', mime: 'audio/webm', durationMs: 1000, sizeBytes: 4, recordedAt: '2026-01-01T00:00:00Z', starred: false, providerFileId: null, state: 'uploading' }
    const storage = {
      uploadToken: async () => ({ accessToken: `tok${++issued}`, expiresAt: new Date(Date.now() + expiresInMs).toISOString(), rootFolderId: 'root', folderId: 'f1' }),
      uploader: () => ({ start: async () => ({ url: 's' }), resume: async () => ({ fileId: 'file' }), download: async () => new Blob(), remove: async () => {}, ...drive }),
    } as unknown as StoragePort
    const remote = {
      register: async () => record,
      update: async (_id: string, p: Partial<RemoteTake>) => ({ ...record, ...p }),
    } as unknown as RemoteTakesPort
    const takes = createMemoryTakesRepo()
    return { takes, storage, remote, issued: () => issued }
  }

  async function runOne(env: ReturnType<typeof setup>) {
    await env.takes.put({ id: 't1', scriptId: 's1', scriptTitle: 'A', number: 1, kind: 'audio', mimeType: 'audio/webm', durationMs: 1000, sizeBytes: 4, starred: false, createdAt: '2026-01-01T00:00:00Z', blob: new Blob(['abcd']) })
    const q = createUploadQueue({ store: memoryQueueStore(), takes: env.takes, storage: env.storage, remote: env.remote, maxNetworkTries: 1 })
    const done = new Promise<string>(r => q.onProgress(p => (p.state === 'done' || p.state === 'failed') && r(p.state === 'failed' ? `failed:${p.error}` : 'done')))
    await q.start('u1')
    await q.enqueue('t1')
    return done
  }

  it('refreshes the token once after a 401 and then succeeds', async () => {
    let n = 0
    const env = setup({ resume: async () => (++n === 1 ? Promise.reject(new DriveTokenError()) : { fileId: 'file' }) })
    expect(await runOne(env)).toBe('done')
    expect(env.issued()).toBe(2)
  })

  it('reports storage_not_linked after a second 401', async () => {
    const env = setup({ resume: async () => Promise.reject(new DriveTokenError()) })
    expect(await runOne(env)).toBe('failed:storage_not_linked')
  })

  it('asks for a fresh token when the cached one ends within 2 minutes', async () => {
    const env = setup({}, TOKEN_MARGIN_MS - 1000)
    expect(await runOne(env)).toBe('done')
    expect(env.issued()).toBe(1)
    // A second take reuses nothing: the first token is already inside the margin.
    await env.takes.put({ id: 't2', scriptId: 's1', scriptTitle: 'A', number: 2, kind: 'audio', mimeType: 'audio/webm', durationMs: 1000, sizeBytes: 4, starred: false, createdAt: '2026-01-01T00:00:00Z', blob: new Blob(['abcd']) })
    const q = createUploadQueue({ store: memoryQueueStore(), takes: env.takes, storage: env.storage, remote: env.remote })
    const done = new Promise<void>(r => q.onProgress(p => p.state === 'done' && r()))
    await q.start('u1')
    await q.enqueue('t2')
    await done
    expect(env.issued()).toBe(2)
  })
})
