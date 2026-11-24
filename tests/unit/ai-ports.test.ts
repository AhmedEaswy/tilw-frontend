import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { memoryBlobStore } from '~/services/mock/drive'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { runTranscription } from '~/services/ai/transcribe'
import { isPortError } from '~/services/types'

// Feature 005 (T011): AiPort and SpeechPort contract on both adapters (contracts/ports.md).

const noSleep = () => Promise.resolve()
async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}
const words = (s: string) => s.split(/\s+/).filter(Boolean).join(' ')

describe('AI in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep, blobs: memoryBlobStore() })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })

  it('estimates, formats with the same words, and applies as a versioned save with an ai version', async () => {
    const before = await m.services.scripts.get('s_opening')
    const est = await m.services.ai.formatEstimate('s_opening')
    expect(est).toMatchObject({ credits: 1, balance: 20, paidWith: 'credits', ownKey: null, enough: true })
    const sg = await m.services.ai.format('s_opening')
    expect(words(sg.body)).toBe(words(before.body))
    expect(sg.marks.some(x => x.type === 'pause')).toBe(true)
    expect(sg).toMatchObject({ baseVersion: before.version, credits: 1, paidWith: 'credits', balance: 19 })
    expect((await m.services.ai.suggestion('s_opening'))?.id).toBe(sg.id)
    const applied = await m.services.ai.apply('s_opening')
    expect(applied.body).toBe(sg.body)
    expect(applied.version).toBe(before.version + 1)
    const versions = await m.services.scripts.listVersions('s_opening')
    expect(versions[0]?.reason ?? versions.at(-1)?.reason).toBeDefined()
    expect(versions.some(v => v.reason === 'ai')).toBe(true)
    expect(await m.services.ai.suggestion('s_opening')).toBeNull()
  })

  it('discards without changing the script; credits stay spent', async () => {
    const before = await m.services.scripts.get('s_letter')
    await m.services.ai.format('s_letter')
    await m.services.ai.discard('s_letter')
    expect((await m.services.scripts.get('s_letter')).body).toBe(before.body)
    expect((await m.services.ai.credits()).balance).toBe(19)
    expect(await code(m.services.ai.discard('s_letter'))).toBe('not_found')
  })

  it('answers conflict with the current script when the script changed since the suggestion', async () => {
    await m.services.ai.format('s_opening')
    m.knobs.bumpScript(userId, 's_opening')
    const e = await m.services.ai.apply('s_opening').catch(x => x)
    expect(isPortError(e, 'conflict')).toBe(true)
    expect((e.current as { body: string }).body).toContain('عُدّل على جهاز آخر')
  })

  it('refunds changed words and unavailable answers, and refuses when the balance is short', async () => {
    m.knobs.ai.setKnobs({ format: 'changed_words' })
    const e = await m.services.ai.format('s_opening').catch(x => x)
    expect(isPortError(e, 'ai_unavailable')).toBe(true)
    expect(e.info.reason).toBe('changed_words')
    m.knobs.ai.setKnobs({ format: 'unavailable' })
    const u = await m.services.ai.format('s_opening').catch(x => x)
    expect(u.info).toMatchObject({ reason: 'provider_error', retryAfter: 30 })
    const c = await m.services.ai.credits()
    expect(c.balance).toBe(20)
    expect(c.entries.filter(x => x.kind === 'refund')).toHaveLength(2)
    expect(c.entries.find(x => x.kind === 'refund')?.refundOf).toBeTruthy()
    m.knobs.ai.setKnobs({ format: 'ok' })
    m.knobs.ai.setBalance(userId, 0)
    const short = await m.services.ai.format('s_opening').catch(x => x)
    expect(short.limit.key).toBe('ai.credits_monthly')
    expect(short.info).toMatchObject({ balance: 0, cost: 1 })
    expect((await m.services.ai.formatEstimate('s_opening')).enough).toBe(false)
  })

  it('keeps the own key masked, formats on it with an own_key entry, and never falls back to credits', async () => {
    expect(await code(m.services.ai.saveKey({ provider: 'anthropic', key: 'short' }))).toBe('validation')
    const k = await m.services.ai.saveKey({ provider: 'anthropic', key: 'sk-ant-1234567890-abcdefghij-1a2b' })
    expect(k).toMatchObject({ provider: 'anthropic', last4: '1a2b', checkOk: true, usable: true })
    expect(JSON.stringify(await m.services.ai.keys())).not.toContain('abcdefghij')
    expect((await m.services.ai.formatEstimate('s_opening')).paidWith).toBe('own_key')
    const sg = await m.services.ai.format('s_opening')
    expect(sg).toMatchObject({ paidWith: 'own_key', credits: 0, balance: 20 })
    expect((await m.services.ai.credits()).entries[0]).toMatchObject({ kind: 'own_key', amount: 0 })
    m.knobs.ai.setKnobs({ keyRefused: true })
    expect(await code(m.services.ai.format('s_opening'))).toBe('own_key_refused')
    expect((await m.services.ai.credits()).balance).toBe(20)
    // The person chooses credits for this call.
    expect((await m.services.ai.format('s_opening', { useCredits: true })).paidWith).toBe('credits')
    expect((await m.services.ai.checkKey()).checkOk).toBe(false)
    await m.services.ai.deleteKey()
    expect(await m.services.ai.keys()).toEqual([])
    expect(await code(m.services.ai.saveKey({ provider: 'openai', key: 'sk-proj-12345678901234567890' }))).toBe('own_key_refused')
    m.knobs.setOverride(userId, 'byok.allowed', false)
    const locked = await m.services.ai.saveKey({ provider: 'openai', key: 'sk-proj-12345678901234567890' }).catch(x => x)
    expect(locked.limit.key).toBe('byok.allowed')
  })

  it('issues a permission, settles on the real length, refuses untagged ids, and refunds nothing on fail', async () => {
    expect(await m.services.ai.transcriptionEstimate({ seconds: 125, bytes: 1000, mimeType: 'audio/webm' })).toEqual({ credits: 3, balance: 20, enough: true, ownKeyApplies: false })
    expect(await code(m.services.ai.transcriptionEstimate({ seconds: 10, bytes: 1000, mimeType: 'text/plain' }))).toBe('validation')
    const long = await m.services.ai.startTranscription({ seconds: 61 * 60, bytes: 1000, mimeType: 'audio/webm' }).catch(x => x)
    expect(long.limit.key).toBe('ai.audio_max_minutes')
    const p = await m.services.ai.startTranscription({ seconds: 125, bytes: 1000, mimeType: 'audio/webm', language: 'ar' })
    expect(p).toMatchObject({ state: 'issued', credits: 3, balance: 17, upload: { provider: 'fake', method: 'POST' } })
    expect(await code(m.services.ai.complete(p.id, 'fake-untagged-125'))).toBe('validation')
    const done = await m.services.ai.complete(p.id, 'fake-65')
    expect(done).toMatchObject({ state: 'used', credits: 2, durationSeconds: 65 })
    expect((await m.services.ai.credits()).balance).toBe(18)
    expect(await code(m.services.ai.complete(p.id, 'fake-65'))).toBe('conflict')
    const q = await m.services.ai.startTranscription({ seconds: 30, bytes: 1000, mimeType: 'audio/webm' })
    expect((await m.services.ai.fail(q.id, 'network')).state).toBe('issued')
    expect((await m.services.ai.credits()).balance).toBe(17)
    expect(await code(m.services.ai.complete(q.id, 'fake-65'))).toBe('validation') // claimed by another permission
  })

  it('charges an overrun in full, below zero, and then refuses new charges', async () => {
    m.knobs.ai.setKnobs({ speech: 'overrun' })
    m.knobs.ai.setBalance(userId, 2)
    const run = await runTranscription({ ai: m.services.ai, speech: m.services.speech, blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }), seconds: 120, language: 'auto', purpose: 'text' })
    expect(run.transcription.credits).toBe(6)
    const c = await m.services.ai.credits()
    expect(c.balance).toBe(-4)
    expect(c.entries[0]?.kind).toBe('overrun')
    expect(await code(m.services.ai.format('s_opening'))).toBe('limit_reached')
  })

  it('refunds a failed provider record and expires unused permissions with credits kept', async () => {
    m.knobs.ai.setKnobs({ speech: 'failed' })
    const run = await runTranscription({ ai: m.services.ai, speech: m.services.speech, blob: new Blob([new Uint8Array(10)], { type: 'audio/webm' }), seconds: 60, language: 'auto', purpose: 'text' })
    expect(run.transcription.state).toBe('failed')
    expect((await m.services.ai.credits()).balance).toBe(20)
    await m.services.ai.startTranscription({ seconds: 60, bytes: 10, mimeType: 'audio/webm' })
    m.db.setKnobs({ clockOffsetMs: 11 * 60_000 })
    m.knobs.ai.settleExpired()
    expect((await m.services.ai.credits()).balance).toBe(19)
  })

  it('starts each month with the plan amount, uses grants first, and tops up on Pro', async () => {
    m.knobs.ai.grant(userId, 5)
    expect((await m.services.ai.credits())).toMatchObject({ balance: 25, granted: 5, monthlyLeft: 20, monthly: 20 })
    await m.services.ai.format('s_opening')
    expect((await m.services.ai.credits())).toMatchObject({ granted: 4, monthlyLeft: 20 })
    m.knobs.setPlan(userId, 'pro')
    expect((await m.services.ai.credits())).toMatchObject({ monthly: 500, monthlyLeft: 500 })
    m.db.setKnobs({ clockOffsetMs: 40 * 86_400_000 })
    const next = await m.services.ai.credits()
    expect(next.entries.at(-1)?.kind).toBe('monthly')
    expect(next.monthlyLeft).toBe(500)
  })
})

// ---------- HTTP adapter: routes, error info, and nothing but metadata to the API ----------

interface Call { method: string; url: string; body: unknown; raw: unknown; headers: Record<string, string> }
function fakeApi(handler: (c: Call) => { status?: number; json?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    const raw = init.body
    let body: unknown
    try {
      body = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      body = raw
    }
    const c: Call = { method: init.method ?? 'GET', url: String(url), body, raw, headers: { ...(init.headers as Record<string, string>) } }
    calls.push(c)
    if (c.url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
    const r = handler(c)
    return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? null), { status: r.status ?? 200, headers: r.headers })
  }) as unknown as typeof fetch
  return { f, calls }
}

describe('AI over HTTP', () => {
  const T = { id: 'tr1', purpose: 'text', language: 'auto', seconds: 90, credits: 2, state: 'issued', durationSeconds: null, tokenExpiresAt: '2999-01-01T00:00:00Z', refundableAt: '2999-01-01T00:00:00Z', createdAt: '2026-11-24T00:00:00Z' }

  it('maps the routes and reads the suggestion 404 as none', async () => {
    const { f, calls } = fakeApi((c) => {
      if (c.url.endsWith('/format') && c.method === 'GET') return { status: 404, json: { code: 'not_found', message: '' } }
      if (c.url.endsWith('/api/ai/keys')) return { json: [] }
      return { json: {} }
    })
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'x' })
    expect(await services.ai.suggestion('s 1')).toBeNull()
    await services.ai.formatEstimate('s1')
    await services.ai.format('s1', { useCredits: true })
    await services.ai.apply('s1')
    await services.ai.discard('s1')
    await services.ai.credits()
    expect(await services.ai.keys()).toEqual([])
    await services.ai.saveKey({ provider: 'openai', key: 'sk-12345678901234567890' })
    await services.ai.checkKey()
    await services.ai.deleteKey()
    await services.ai.transcriptionEstimate({ seconds: 90, bytes: 100, mimeType: 'audio/webm;codecs=opus' })
    await services.ai.complete('tr1', 'req-1')
    await services.ai.fail('tr1', 'network')
    expect(calls.filter(c => !c.url.includes('sanctum')).map(c => `${c.method} ${c.url.replace('http://api.test', '')}`)).toEqual([
      'GET /api/scripts/s%201/format',
      'GET /api/scripts/s1/format/estimate',
      'POST /api/scripts/s1/format',
      'POST /api/scripts/s1/format/apply',
      'DELETE /api/scripts/s1/format',
      'GET /api/ai/credits',
      'GET /api/ai/keys',
      'PUT /api/ai/keys/text',
      'POST /api/ai/keys/text/check',
      'DELETE /api/ai/keys/text',
      'GET /api/ai/transcriptions/estimate?seconds=90&bytes=100&mimeType=audio%2Fwebm%3Bcodecs%3Dopus',
      'POST /api/ai/transcriptions/tr1/complete',
      'POST /api/ai/transcriptions/tr1/fail',
    ])
    expect(calls.find(c => c.url.endsWith('/s1/format') && c.method === 'POST')?.body).toEqual({ useCredits: true })
  })

  it('carries balance, cost, reason and Retry-After on errors', async () => {
    const replies = [
      { status: 403, json: { code: 'limit_reached', message: '', limit: { key: 'ai.credits_monthly', value: 20, usage: null }, balance: 1, cost: 2 } },
      { status: 503, json: { code: 'ai_unavailable', message: '', reason: 'changed_words' } },
      { status: 503, json: { code: 'ai_unavailable', message: '', reason: 'timeout' }, headers: { 'Retry-After': '30' } },
      { status: 422, json: { code: 'own_key_refused', message: '' } },
    ]
    const { f } = fakeApi(() => replies.shift()!)
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'x' })
    const a = await services.ai.format('s1').catch(x => x)
    expect(a.limit.key).toBe('ai.credits_monthly')
    expect(a.info).toEqual({ balance: 1, cost: 2 })
    expect((await services.ai.format('s1').catch(x => x)).info).toEqual({ reason: 'changed_words' })
    expect((await services.ai.format('s1').catch(x => x)).info).toEqual({ reason: 'timeout', retryAfter: 30 })
    expect(await code(services.ai.format('s1'))).toBe('own_key_refused')
  })

  it('sends audio only to the provider URL and only metadata to the API (SC-002)', async () => {
    const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' })
    const answer = {
      metadata: { request_id: 'req-abc', duration: 88.2 },
      results: { channels: [{ detected_language: 'ar', alternatives: [{ transcript: 'نص', paragraphs: { transcript: '\nكل حكاية تبدأ بسؤال صغير.\n\nسؤال واحد يكفي.' } }] }] },
    }
    const { f, calls } = fakeApi((c) => {
      if (c.url.startsWith('https://api.deepgram.com')) return { json: answer }
      if (c.url.endsWith('/api/ai/transcriptions') && c.method === 'POST') {
        return { status: 201, json: { ...T, balance: 18, upload: { provider: 'deepgram', method: 'POST', url: 'https://api.deepgram.com/v1/listen?tag=tilw-tr1&model=nova-3', headers: { Authorization: 'Bearer grant' }, expiresAt: '2999-01-01T00:00:00Z' } } }
      }
      return { json: { ...T, state: 'used', durationSeconds: 88.2 } }
    })
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'x' })
    const run = await runTranscription({ ai: services.ai, speech: services.speech, blob: audio, seconds: 89, language: 'auto', purpose: 'text' })
    expect(run.result.transcript).toBe('كل حكاية تبدأ بسؤال صغير.\n\nسؤال واحد يكفي.')
    expect(run.result.language).toBe('ar')
    const upload = calls.find(c => c.url.startsWith('https://api.deepgram.com'))!
    expect(upload.url).toBe('https://api.deepgram.com/v1/listen?tag=tilw-tr1&model=nova-3')
    expect(upload.raw).toBe(audio)
    expect(upload.headers).toMatchObject({ Authorization: 'Bearer grant', 'Content-Type': 'audio/webm' })
    const toApi = calls.filter(c => c.url.startsWith('http://api.test'))
    for (const c of toApi) {
      expect(c.raw === undefined || typeof c.raw === 'string').toBe(true)
      expect(String(c.raw ?? '')).not.toContain('كل حكاية')
    }
    expect(toApi.find(c => c.url.endsWith('/api/ai/transcriptions'))?.body).toEqual({ seconds: 89, bytes: 4, mimeType: 'audio/webm', language: 'auto', purpose: 'text' })
    expect(toApi.find(c => c.url.endsWith('/complete'))?.body).toEqual({ requestId: 'req-abc' })
  })

  it('reports the failure (refunding nothing) when the provider refuses the upload', async () => {
    const { f, calls } = fakeApi((c) => {
      if (c.url.startsWith('https://api.deepgram.com')) return { status: 401, json: {} }
      if (c.url.endsWith('/api/ai/transcriptions')) return { status: 201, json: { ...T, balance: 18, upload: { provider: 'deepgram', method: 'POST', url: 'https://api.deepgram.com/v1/listen', headers: {}, expiresAt: '2999-01-01T00:00:00Z' } } }
      return { status: 202, json: T }
    })
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'x' })
    const e = await runTranscription({ ai: services.ai, speech: services.speech, blob: new Blob(['x'], { type: 'audio/webm' }), seconds: 5, language: 'en', purpose: 'text' }).catch(x => x)
    expect(e.name).toBe('UploadFailed')
    expect(calls.find(c => c.url.endsWith('/fail'))?.body).toEqual({ reason: 'provider_failed' })
    expect(calls.some(c => c.url.endsWith('/complete'))).toBe(false)
  })

  it('completes a fake (AI_FAKE) permission without uploading', async () => {
    const { f, calls } = fakeApi((c) => {
      if (c.url.endsWith('/api/ai/transcriptions')) return { status: 201, json: { ...T, balance: 18, upload: { provider: 'fake', method: 'POST', url: 'https://fake-speech.invalid/v1/listen', headers: {}, expiresAt: '2999-01-01T00:00:00Z' } } }
      return { json: { ...T, state: 'used' } }
    })
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'x' })
    await runTranscription({ ai: services.ai, speech: services.speech, blob: new Blob(['x'], { type: 'audio/webm' }), seconds: 125, language: 'auto', purpose: 'text' })
    expect(calls.some(c => c.url.includes('fake-speech.invalid'))).toBe(false)
    expect(calls.find(c => c.url.endsWith('/complete'))?.body).toEqual({ requestId: 'fake-125' })
  })
})
