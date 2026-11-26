import { describe, expect, it, vi } from 'vitest'
import { checkAudio, clockLabel, creditsForSeconds, creditsForWords, declaredSeconds, isAllowedAudioType } from '~/services/ai/audio'
import { parseDeepgram, tidyTranscript } from '~/services/ai/deepgram'
import { canPay, describeAiError } from '~/services/ai/errors'
import { createSpeech, fakeSpeech } from '~/services/ai/speech'
import { toPortError } from '~/services/http/client'
import { runTranscription, UploadFailed } from '~/services/ai/transcribe'
import { fakeFormat, sameWords } from '~/services/mock/ai'
import type { AiPort, SpeechPort } from '~/services/ports'
import { PortError } from '~/services/types'

// Feature 005 (T012): the framework-free AI logic.

describe('costs and audio checks', () => {
  it('charges 1 credit per started 1,000 words or minute, minimum 1', () => {
    expect([0, 1, 1000, 1001, 1500].map(creditsForWords)).toEqual([1, 1, 1, 2, 2])
    expect([1, 60, 61, 125].map(creditsForSeconds)).toEqual([1, 1, 2, 3])
    expect(declaredSeconds(12.01)).toBe(13)
    expect(declaredSeconds(0.2)).toBe(1)
    expect(clockLabel(102)).toBe('1:42')
    expect(clockLabel(3725)).toBe('1:02:05')
  })

  it('refuses the wrong type, too big, too long or unreadable audio before any call', () => {
    expect(isAllowedAudioType('audio/webm;codecs=opus')).toBe(true)
    expect(isAllowedAudioType('video/mp4', 'captions')).toBe(true)
    expect(isAllowedAudioType('image/png')).toBe(false)
    expect(checkAudio({ type: 'text/plain', size: 10 }, 10)).toEqual({ reason: 'type' })
    expect(checkAudio({ type: 'audio/mpeg', size: 201 * 1024 * 1024 }, 10)).toEqual({ reason: 'size', maxMb: 200 })
    expect(checkAudio({ type: 'audio/mpeg', size: 10 }, 61 * 60)).toEqual({ reason: 'length', maxMinutes: 60 })
    expect(checkAudio({ type: 'audio/mpeg', size: 10 }, 61 * 60, 90)).toBeNull()
    expect(checkAudio({ type: 'audio/mpeg', size: 10 }, null)).toEqual({ reason: 'unknown_length' })
    expect(checkAudio({ type: 'audio/mpeg', size: 0 }, 5)).toEqual({ reason: 'empty' })
  })
})

describe('Deepgram answers', () => {
  it('reads paragraphs, falls back to the transcript, and keeps utterance boundaries', () => {
    expect(tidyTranscript('\nأ  ب\n\n\nج ')).toBe('أ ب\n\nج')
    const r = parseDeepgram({
      metadata: { request_id: 'r1', duration: 12.5 },
      results: {
        channels: [{ detected_language: 'en', alternatives: [{ transcript: 'hello there. bye' }] }],
        utterances: [
          { words: [{ word: 'hello', punctuated_word: 'Hello', start: 0.1, end: 0.4 }, { word: 'there', punctuated_word: 'there.', start: 0.5, end: 0.8 }] },
          { words: [{ word: 'bye', start: 3, end: 3.3 }] },
        ],
      },
    })
    expect(r).toEqual({
      requestId: 'r1', transcript: 'hello there. bye', language: 'en', duration: 12.5,
      words: [{ word: 'Hello', start: 0.1, end: 0.4 }, { word: 'there.', start: 0.5, end: 0.8 }, { word: 'bye', start: 3, end: 3.3 }],
      utteranceBreaks: [2],
    })
    expect(parseDeepgram({}).transcript).toBe('')
  })

  it('fakes answers for the mock and AI_FAKE', () => {
    expect(fakeSpeech(125).requestId).toBe('fake-125')
    expect(fakeSpeech(10, { mode: 'overrun' }).requestId).toBe('fake-30')
    expect(fakeSpeech(10, { mode: 'failed' }).requestId).toBe('fake-failed')
    expect(fakeSpeech(10, { mode: 'empty' }).transcript).toBe('')
    const en = fakeSpeech(20, { language: 'en' })
    expect(en.transcript).toMatch(/^Every story/)
    expect(en.words.every(w => w.end <= 20)).toBe(true)
  })
})

describe('the transcription run', () => {
  const permission = (expiresAt = '2999-01-01T00:00:00Z') => ({
    id: 'tr1', purpose: 'text' as const, language: 'auto' as const, seconds: 30, credits: 1, state: 'issued' as const, durationSeconds: null,
    tokenExpiresAt: expiresAt, refundableAt: expiresAt, createdAt: '', balance: 19,
    upload: { provider: 'deepgram' as const, method: 'POST' as const, url: 'https://dg.test', headers: {}, expiresAt },
  })
  const ai = (p = permission()) => ({
    startTranscription: vi.fn(async () => p),
    complete: vi.fn(async () => ({ ...p, state: 'used' as const })),
    fail: vi.fn(async () => p),
  }) as unknown as AiPort & Record<'startTranscription' | 'complete' | 'fail', ReturnType<typeof vi.fn>>
  const blob = new Blob(['abc'], { type: 'audio/webm' })

  it('goes permission → sending → settling → done and reports the request id', async () => {
    const a = ai()
    const steps: string[] = []
    const speech: SpeechPort = { live: vi.fn(), send: vi.fn(async () => fakeSpeech(30)) }
    const run = await runTranscription({ ai: a, speech, blob, seconds: 30, language: 'auto', purpose: 'text', onStep: s => steps.push(s) })
    expect(steps).toEqual(['permission', 'sending', 'settling', 'done'])
    expect(a.startTranscription).toHaveBeenCalledWith({ seconds: 30, bytes: 3, mimeType: 'audio/webm', language: 'auto', purpose: 'text' })
    expect(a.complete).toHaveBeenCalledWith('tr1', 'fake-30')
    expect(run.transcription.state).toBe('used')
  })

  it('reports an upload failure with fail and never completes', async () => {
    const a = ai()
    const speech: SpeechPort = { live: vi.fn(), send: vi.fn(async () => { throw new PortError('network') }) }
    const e = await runTranscription({ ai: a, speech, blob, seconds: 30, language: 'auto', purpose: 'text' }).catch(x => x)
    expect(e).toBeInstanceOf(UploadFailed)
    expect(a.fail).toHaveBeenCalledWith('tr1', 'network')
    expect(a.complete).not.toHaveBeenCalled()
  })

  it('never uploads after the permission expired', async () => {
    const a = ai(permission('2000-01-01T00:00:00Z'))
    const speech: SpeechPort = { live: vi.fn(), send: vi.fn() }
    await runTranscription({ ai: a, speech, blob, seconds: 30, language: 'auto', purpose: 'text' }).catch(() => {})
    expect(speech.send).not.toHaveBeenCalled()
    expect(a.fail).toHaveBeenCalledWith('tr1', 'expired')
  })
})

describe('error copy', () => {
  const lim = (key: string, info?: object) => new PortError('limit_reached', undefined, undefined, { key, value: 20, usage: null }, info)
  it('names each refusal', () => {
    expect(describeAiError(lim('ai.credits_monthly', { balance: 1, cost: 2 }))).toEqual({ kind: 'credits', params: { balance: 1, cost: 2 } })
    expect(describeAiError(lim('ai.credits_monthly', { balance: -4, cost: 2 })).kind).toBe('negative')
    expect(describeAiError(lim('byok.allowed')).kind).toBe('byok')
    expect(describeAiError(lim('scripts.max_active')).kind).toBe('read_only')
    expect(describeAiError(new PortError('own_key_refused')).kind).toBe('key_refused')
    expect(describeAiError(new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'changed_words' })).kind).toBe('changed_words')
    expect(describeAiError(new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'timeout', retryAfter: 30 }))).toEqual({ kind: 'unavailable', params: { wait: 30 } })
    expect(describeAiError(new PortError('not_found')).kind).toBe('gone')
    expect(describeAiError(new PortError('conflict')).kind).toBe('conflict')
    expect(describeAiError(new Error('x')).kind).toBe('other')
    expect(canPay(-4, 1)).toBe(false)
    expect(canPay(2, 2)).toBe(true)
    expect(canPay(null, 1)).toBe(false)
  })
})

describe('the mock formatter', () => {
  it('keeps every word in order and adds pauses, emphasis and a note', () => {
    const body = 'كل حكاية تبدأ بسؤال صغير. قبل أن أفتح الكاميرا، كتبت سؤالاً واحداً. ماذا أريد أن يبقى معكم؟\n\nسؤال واحد يكفي.'
    const out = fakeFormat(body)
    expect(sameWords(out.body, body)).toBe(true)
    expect(out.body.split('\n\n')).toHaveLength(2)
    for (const m of out.marks) {
      expect(m.start).toBeGreaterThanOrEqual(0)
      expect(m.end).toBeLessThanOrEqual(out.body.length)
    }
    expect(out.marks.map(m => m.type).sort()).toEqual(expect.arrayContaining(['note', 'pause', 'emphasis']))
    const note = out.marks.find(m => m.type === 'note')!
    expect(out.body.slice(note.start, note.end)).toBe('كل حكاية تبدأ بسؤال صغير.')
  })
})

// ---------- review fixes (PR #5) ----------

describe('review fixes', () => {
  it('allows video only for captions, as the backend does', () => {
    expect(isAllowedAudioType('video/webm')).toBe(false)
    expect(isAllowedAudioType('video/webm;codecs=vp9', 'captions')).toBe(true)
    expect(checkAudio({ type: 'video/mp4', size: 10 }, 5)).toEqual({ reason: 'type' })
    expect(checkAudio({ type: 'video/mp4', size: 10 }, 5, 60, 'captions')).toBeNull()
    expect(checkAudio({ type: 'video/mp4', size: 201 * 1024 * 1024 }, 5, 60, 'captions')).toEqual({ reason: 'size', maxMb: 200 })
  })

  const perm = {
    id: 'tr1', purpose: 'text' as const, language: 'auto' as const, seconds: 30, credits: 1, state: 'issued' as const, durationSeconds: null,
    tokenExpiresAt: '2999-01-01T00:00:00Z', refundableAt: '2999-01-01T00:00:00Z', createdAt: '', balance: 19,
    upload: { provider: 'fake' as const, method: 'POST' as const, url: 'https://x.test', headers: {}, expiresAt: '2999-01-01T00:00:00Z' },
  }
  const blob = new Blob(['abc'], { type: 'audio/webm' })
  const speech: SpeechPort = { live: vi.fn(), send: async () => fakeSpeech(30) }
  function aiWith(complete: ReturnType<typeof vi.fn>) {
    return { startTranscription: vi.fn(async () => perm), complete, fail: vi.fn(async () => perm) } as unknown as AiPort
  }
  const run = (ai: AiPort, sp: SpeechPort = speech) => runTranscription({ ai, speech: sp, blob, seconds: 30, language: 'auto', purpose: 'text', retryMs: [1, 1, 1], sleep: async () => {} })

  it('retries complete on network, 503 and not_this_permission, then settles', async () => {
    const complete = vi.fn()
      .mockRejectedValueOnce(new PortError('network'))
      .mockRejectedValueOnce(new PortError('ai_unavailable'))
      .mockRejectedValueOnce(new PortError('validation', { requestId: 'not_this_permission' }))
      .mockResolvedValueOnce({ ...perm, state: 'used' })
    const r = await run(aiWith(complete))
    expect(complete).toHaveBeenCalledTimes(4)
    expect(r.transcription?.state).toBe('used')
  })

  it('keeps the paid text when settling keeps failing, and stops at once on other errors', async () => {
    const always = vi.fn().mockRejectedValue(new PortError('network'))
    const r = await run(aiWith(always))
    expect(always).toHaveBeenCalledTimes(4) // one try and three retries
    expect(r.transcription).toBeNull()
    expect(r.result.transcript).toMatch(/^كل حكاية/)
    const other = vi.fn().mockRejectedValue(new PortError('not_found'))
    expect((await run(aiWith(other))).transcription).toBeNull()
    expect(other).toHaveBeenCalledTimes(1)
    const settled = vi.fn().mockRejectedValue(new PortError('conflict', undefined, { ...perm, state: 'used' }))
    expect((await run(aiWith(settled))).transcription?.state).toBe('used')
  })

  it('does not call complete without a request id', async () => {
    const complete = vi.fn()
    const r = await run(aiWith(complete), { send: async () => ({ ...fakeSpeech(30), requestId: '' }) })
    expect(complete).not.toHaveBeenCalled()
    expect(r.transcription).toBeNull()
  })

  it('falls back to the dg-request-id header when the body has no request id', async () => {
    const f = (async () => new Response(JSON.stringify({ results: { channels: [{ alternatives: [{ transcript: 'hi' }] }] } }), { status: 200, headers: { 'dg-request-id': 'req-h1' } })) as unknown as typeof fetch
    const r = await createSpeech({ fetch: f }).send({ provider: 'deepgram', method: 'POST', url: 'https://dg.test', headers: {}, expiresAt: '2999-01-01T00:00:00Z' }, blob, { seconds: 1, purpose: 'text', language: 'auto' })
    expect(r.requestId).toBe('req-h1')
  })

  it('reads a bare 503 as unknown, and ai_unavailable only when the body says so', async () => {
    expect((await toPortError(new Response('<html>', { status: 503 }))).code).toBe('unknown')
    expect((await toPortError(new Response(JSON.stringify({ code: 'ai_unavailable', reason: 'timeout' }), { status: 503 }))).code).toBe('ai_unavailable')
  })
})
