/**
 * Feature 005: SpeechPort over fetch (backend device-flows §1). The audio goes from the browser straight to the
 * provider with the permission's URL and headers, never through Tilw. The query string is used as given: it carries
 * the language, model, privacy opt-out and the permission's tag.
 *
 * `upload.provider === 'fake'` (backend AI_FAKE, and the in-browser mock): nothing is uploaded; the answer comes from
 * `fakeSpeech()` (research R2).
 */
import type { SpeechPort } from '../ports'
import { PortError, type SpeechLanguage, type SpeechPurpose, type SpeechResult, type SpeechWord } from '../types'
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

export function createSpeech(opts: { fetch?: typeof fetch; now?: () => number } = {}): SpeechPort {
  const f: typeof fetch = opts.fetch ?? ((...args) => fetch(...args))
  const now = opts.now ?? Date.now
  return {
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
      return parseDeepgram(json)
    },
  }
}
