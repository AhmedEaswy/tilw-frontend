/**
 * Feature 005: SpeechPort over fetch (backend device-flows §1). The audio goes from the browser straight to the
 * provider with the permission's URL and headers, never through Tilw. The query string is used as given: it carries
 * the language, model, privacy opt-out and the permission's tag.
 *
 * `upload.provider === 'fake'` (backend AI_FAKE, and the in-browser mock): nothing is uploaded; the answer comes from
 * `fakeSpeech()` (research R2).
 */
import type { LiveSpeech, LiveSpeechOptions, SpeechPort } from '../ports'
import { PortError, type SpeechLanguage, type SpeechPurpose, type SpeechResult, type SpeechUpload, type SpeechWord } from '../types'
import { joinSpeech } from './recognition'
import { parseDeepgram } from './deepgram'

export type FakeSpeechMode = 'ok' | 'failed' | 'empty' | 'overrun'

const FAKE_AR = 'كل حكاية تبدأ بسؤال صغير. قبل أن أفتح الكاميرا، كتبت على الورق سؤالاً واحداً. ماذا أريد أن يبقى معكم بعد هذه الحلقة؟'
const FAKE_EN = 'Every story starts with a small question. Before I turned the camera on, I wrote one question on paper. What do I want you to keep after this episode?'

/** A stand-in answer: text in the asked language (Arabic for auto), words spread over the length. */
export function fakeSpeech(seconds: number, opts: { language?: SpeechLanguage; purpose?: SpeechPurpose; mode?: FakeSpeechMode } = {}): SpeechResult {
  const mode = opts.mode ?? 'ok'
  const real = mode === 'overrun' ? seconds * 3 : seconds
  if (mode === 'failed') return { requestId: 'fake-failed', transcript: '', language: null, duration: null, words: [], utteranceBreaks: [] }
  if (mode === 'empty') return { requestId: `fake-${real}`, transcript: '', language: null, duration: real, words: [], utteranceBreaks: [] }
  const base = opts.language === 'en' ? FAKE_EN : FAKE_AR
  const tokens = base.split(/\s+/)
  // About 2.2 words a second, one sentence per utterance, with a 1.5 s pause between them.
  const words: SpeechWord[] = []
  const utteranceBreaks: number[] = []
  let t = 0.3
  let i = 0
  while (t + 0.4 < real && words.length < 4000) {
    const w = tokens[i % tokens.length]!
    words.push({ word: w, start: +t.toFixed(2), end: +(t + 0.36).toFixed(2) })
    t += 0.45
    if (/[.؟?!]$/.test(w)) {
      t += 1.5
      if (t + 0.4 < real) utteranceBreaks.push(words.length)
    }
    i++
  }
  const transcript = seconds <= 30 ? base : `${base}\n\n${base}`
  return { requestId: `fake-${real}`, transcript, language: opts.language === 'en' ? 'en' : 'ar', duration: real, words, utteranceBreaks }
}

/**
 * The permission's listen URL as a live (WebSocket) one, for dictation. The model, language, privacy opt-out and tag
 * stay as given; the options Deepgram only has for finished files are dropped, and live (interim) results are asked for.
 */
export function liveUrl(url: string): string {
  const u = new URL(url)
  u.protocol = 'wss:'
  for (const k of ['paragraphs', 'detect_language', 'utterances']) u.searchParams.delete(k)
  u.searchParams.set('interim_results', 'true')
  return u.toString()
}

/** How long `finish()` waits for the provider's last words before giving up on them. */
const FINISH_MS = 4000

/** Stand-in live dictation: two more words for every piece of audio sent. */
export function fakeLive(o: LiveSpeechOptions): LiveSpeech {
  const words = fakeSpeech(30, { language: o.language }).transcript.split(/\s+/)
  let n = 0
  let done = false
  return {
    send() {
      if (done || n >= words.length) return
      const live = words.slice(n, n + 2).join(' ')
      const final = words.slice(0, n).join(' ')
      n += 2
      o.onText(final, live)
    },
    async finish(seconds) {
      done = true
      o.onText(words.slice(0, n).join(' '), '')
      return `fake-${seconds}`
    },
    abort() {
      done = true
    },
  }
}

function deepgramLive(upload: SpeechUpload, o: LiveSpeechOptions, Socket: typeof WebSocket): LiveSpeech {
  const token = (upload.headers.Authorization ?? '').replace(/^Bearer\s+/i, '')
  const ws = new Socket(liveUrl(upload.url), ['bearer', token])
  const waiting: Blob[] = []
  let final = ''
  let live = ''
  let requestId = ''
  let closing = false
  let closed = false
  let resolveClosed: () => void = () => {}
  const whenClosed = new Promise<void>(r => (resolveClosed = r))

  ws.onopen = () => {
    waiting.splice(0).forEach(c => ws.send(c))
    if (closing) ws.send(JSON.stringify({ type: 'CloseStream' }))
  }
  ws.onmessage = (e) => {
    let m: { type?: string; request_id?: string; is_final?: boolean; metadata?: { request_id?: string }; channel?: { alternatives?: { transcript?: string }[] } }
    try {
      m = JSON.parse(String(e.data))
    } catch {
      return
    }
    requestId = m.metadata?.request_id || m.request_id || requestId
    if (m.type !== 'Results') return
    const said = m.channel?.alternatives?.[0]?.transcript ?? ''
    if (m.is_final) {
      final = joinSpeech(final, said)
      live = ''
    } else live = said
    o.onText(final, live)
  }
  ws.onclose = () => {
    closed = true
    resolveClosed()
    if (!closing) o.onDrop?.()
  }

  return {
    send(chunk) {
      if (closing || closed) return
      if (ws.readyState === 1) ws.send(chunk)
      else if (ws.readyState === 0) waiting.push(chunk)
    },
    async finish() {
      if (!closed) {
        closing = true
        // Still connecting: `onopen` sends what was recorded, then closes the stream.
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'CloseStream' }))
        await Promise.race([whenClosed, new Promise<void>(r => setTimeout(r, FINISH_MS))])
        if (!closed) ws.close()
      }
      // Words the provider never marked final still count as said.
      if (live) {
        final = joinSpeech(final, live)
        live = ''
        o.onText(final, '')
      }
      return requestId
    },
    abort() {
      closing = true
      ws.close()
    },
  }
}

export function createSpeech(opts: { fetch?: typeof fetch; now?: () => number; socket?: typeof WebSocket } = {}): SpeechPort {
  const f: typeof fetch = opts.fetch ?? ((...args) => fetch(...args))
  const now = opts.now ?? Date.now
  return {
    live(upload, o) {
      if (upload.provider === 'fake') return fakeLive(o)
      if (Date.parse(upload.expiresAt) <= now()) throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'expired' })
      return deepgramLive(upload, o, opts.socket ?? WebSocket)
    },
    async send(upload, audio, o) {
      if (upload.provider === 'fake') return fakeSpeech(o.seconds, { language: o.language, purpose: o.purpose })
      if (Date.parse(upload.expiresAt) <= now()) throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'expired' })
      let res: Response
      try {
        res = await f(upload.url, {
          method: upload.method || 'POST',
          headers: { ...upload.headers, 'Content-Type': audio.type || 'application/octet-stream' },
          body: audio,
          signal: o.signal,
        })
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') throw e
        throw new PortError('network')
      }
      if (!res.ok) throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'provider_failed' })
      let json: unknown
      try {
        json = await res.json()
      } catch {
        throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'bad_answer' })
      }
      const result = parseDeepgram(json)
      // Deepgram also sends the request id as a header; use it when the body has none.
      if (!result.requestId) result.requestId = res.headers?.get?.('dg-request-id') ?? ''
      return result
    },
  }
}
