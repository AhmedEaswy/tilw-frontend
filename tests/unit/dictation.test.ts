/** Feature 005, gaps G-A5: dictation with the browser's own speech recognition. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createRecognizer, dictationLang, joinSpeech, recognitionProblem, recognitionSupported, type RecognitionLike } from '~/services/ai/recognition'
import { createMockRecognition, MOCK_PHRASES } from '~/services/mock/recognition'
import { createSpeech, liveUrl } from '~/services/ai/speech'
import { placeSpoken } from '~/utils/dictation'

/** A controllable fake of the browser's SpeechRecognition. */
class Fake implements RecognitionLike {
  static all: Fake[] = []
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onstart: RecognitionLike['onstart'] = null
  onend: RecognitionLike['onend'] = null
  onerror: RecognitionLike['onerror'] = null
  onresult: RecognitionLike['onresult'] = null
  started = false
  aborted = false
  results: { isFinal: boolean; 0: { transcript: string } }[] = []
  constructor() {
    Fake.all.push(this)
  }
  start() {
    this.started = true
    this.onstart?.()
  }
  stop() {
    this.onend?.()
  }
  abort() {
    this.aborted = true
  }
  say(text: string, isFinal: boolean) {
    const i = this.results.findIndex(r => !r.isFinal)
    const r = { isFinal, 0: { transcript: text } }
    if (i >= 0) this.results[i] = r
    else this.results.push(r)
    const at = this.results.indexOf(r)
    this.onresult?.({ resultIndex: at, results: [...this.results] })
  }
  fail(error: string) {
    this.onerror?.({ error })
    this.onend?.()
  }
}

beforeEach(() => {
  Fake.all = []
})

describe('recognition helpers', () => {
  it('detects the API under either name', () => {
    expect(recognitionSupported({})).toBe(false)
    expect(recognitionSupported({ webkitSpeechRecognition: Fake })).toBe(true)
    expect(recognitionSupported({ SpeechRecognition: Fake })).toBe(true)
  })
  it('joins speech with one space', () => {
    expect(joinSpeech('مرحبا ', ' بكم')).toBe('مرحبا بكم')
    expect(joinSpeech('', ' x')).toBe('x')
  })
  it('maps errors to what we tell the person', () => {
    expect(recognitionProblem('no-speech', false)).toBeNull()
    expect(recognitionProblem('aborted', true)).toBeNull()
    expect(recognitionProblem('not-allowed', false)).toBe('denied')
    expect(recognitionProblem('service-not-allowed', false)).toBe('denied')
    expect(recognitionProblem('audio-capture', false)).toBe('missing')
    expect(recognitionProblem('network', true)).toBe('offline')
    expect(recognitionProblem('network', false)).toBe('unavailable')
    expect(recognitionProblem('language-not-supported', false)).toBe('unavailable')
  })
  it('picks the language from the script direction and the saved choice', () => {
    expect(dictationLang('rtl', null)).toBe('ar-EG')
    expect(dictationLang('rtl', 'ar-SA')).toBe('ar-SA')
    expect(dictationLang('rtl', 'en-US')).toBe('ar-EG')
    expect(dictationLang('ltr', 'ar-SA')).toBe('en-US')
    expect(dictationLang('rtl', 'xx')).toBe('ar-EG')
  })
})

describe('createRecognizer', () => {
  it('listens continuously with live results in the chosen language', () => {
    const r = createRecognizer({ lang: 'ar-EG', ctor: Fake })
    r.start()
    const f = Fake.all[0]!
    expect([f.lang, f.continuous, f.interimResults, f.started]).toEqual(['ar-EG', true, true, true])
  })

  it('keeps final text and the live part apart, in order', () => {
    const seen: [string, string][] = []
    const r = createRecognizer({ lang: 'ar-EG', ctor: Fake, onText: (a, b) => seen.push([a, b]) })
    r.start()
    const f = Fake.all[0]!
    f.say('فاكتبه', false)
    f.say('فاكتبه لنا.', true)
    f.say('ربما', false)
    expect(seen.at(-1)).toEqual(['فاكتبه لنا.', 'ربما'])
    expect(r.text).toBe('فاكتبه لنا. ربما')
  })

  it('restarts quietly when the browser ends a session, keeping the text, until stop()', () => {
    const onEnd = vi.fn()
    const r = createRecognizer({ lang: 'ar-EG', ctor: Fake, onEnd })
    r.start()
    Fake.all[0]!.say('أولاً', true)
    Fake.all[0]!.onend?.() // the browser's own end (pause or time limit)
    expect(Fake.all).toHaveLength(2)
    expect(onEnd).not.toHaveBeenCalled()
    Fake.all[1]!.say('ثانياً', true)
    r.stop()
    expect(onEnd).toHaveBeenCalledWith(null)
    expect(r.text).toBe('أولاً ثانياً')
    expect(Fake.all).toHaveLength(2)
  })

  it('counts a live part cut off by the end as said', () => {
    const r = createRecognizer({ lang: 'ar-EG', ctor: Fake })
    r.start()
    Fake.all[0]!.say('كلمة', false)
    r.stop()
    expect(r.text).toBe('كلمة')
  })

  it('gives up on a loop of sessions that end at once', () => {
    const onEnd = vi.fn()
    createRecognizer({ lang: 'ar-EG', ctor: Fake, onEnd, maxQuickRestarts: 2 }).start()
    for (let i = 0; i < 3; i++) Fake.all.at(-1)!.onend?.()
    expect(onEnd).toHaveBeenCalledWith('unavailable')
  })

  it('ends with the problem: denied, missing, Brave-style unavailable, offline after words', () => {
    for (const [error, said, want] of [['not-allowed', false, 'denied'], ['audio-capture', false, 'missing'], ['network', false, 'unavailable'], ['network', true, 'offline']] as const) {
      Fake.all = []
      const onEnd = vi.fn()
      createRecognizer({ lang: 'ar-EG', ctor: Fake, onEnd }).start()
      if (said) Fake.all[0]!.say('نص', true)
      Fake.all[0]!.fail(error)
      expect(onEnd).toHaveBeenCalledWith(want)
      expect(Fake.all).toHaveLength(1)
    }
  })

  it('keeps listening through no-speech', () => {
    const onEnd = vi.fn()
    createRecognizer({ lang: 'ar-EG', ctor: Fake, onEnd }).start()
    Fake.all[0]!.fail('no-speech')
    expect(onEnd).not.toHaveBeenCalled()
    expect(Fake.all).toHaveLength(2)
  })

  it('is unavailable without the API', () => {
    const onEnd = vi.fn()
    createRecognizer({ lang: 'ar-EG', ctor: null, onEnd }).start()
    expect(onEnd).toHaveBeenCalledWith('unavailable')
  })

  it('abort ends silently and ignores late events', () => {
    const onEnd = vi.fn()
    const onText = vi.fn()
    const r = createRecognizer({ lang: 'ar-EG', ctor: Fake, onEnd, onText })
    r.start()
    r.abort()
    expect(Fake.all[0]!.aborted).toBe(true)
    Fake.all[0]!.onend?.()
    expect(onEnd).not.toHaveBeenCalled()
    expect(Fake.all).toHaveLength(1)
  })
})

describe('useDictation', () => {
  beforeEach(() => {
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('onMounted', (fn: () => void) => fn())
    vi.stubGlobal('onBeforeUnmount', () => {})
    vi.stubGlobal('webkitSpeechRecognition', Fake)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('goes starting → listening → done with the text, and a language change keeps the text', async () => {
    const { useDictation } = await import('~/composables/useDictation')
    const d = useDictation()
    expect(d.supported.value).toBe(true)
    d.start('ar-EG')
    expect(d.state.value).toBe('listening')
    Fake.all[0]!.say('مرحبا', true)
    d.setLang('ar-SA')
    expect(Fake.all[0]!.aborted).toBe(true)
    expect(Fake.all[1]!.lang).toBe('ar-SA')
    Fake.all[1]!.say('بكم', false)
    expect(d.text.value).toBe('مرحبا بكم')
    d.stop()
    expect(d.state.value).toBe('done')
    expect(d.text.value).toBe('مرحبا بكم')
  })

  it('cancel while waiting on the microphone prompt ignores what comes after', async () => {
    class Slow extends Fake {
      override start() {
        this.started = true
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', Slow)
    const { useDictation } = await import('~/composables/useDictation')
    const d = useDictation()
    d.start('ar-EG')
    expect(d.state.value).toBe('starting')
    d.cancel()
    expect(d.state.value).toBe('idle')
    Fake.all[0]!.onstart?.()
    Fake.all[0]!.say('متأخر', true)
    expect(d.state.value).toBe('idle')
    expect(d.text.value).toBe('')
  })

  it('shows the problem state', async () => {
    const { useDictation } = await import('~/composables/useDictation')
    const d = useDictation()
    d.start('ar-EG')
    Fake.all[0]!.fail('not-allowed')
    expect(d.state.value).toBe('denied')
  })
})

describe('mock recognizer', () => {
  it('says the Arabic phrases, ends once by itself, and the app restarts it', async () => {
    vi.useFakeTimers()
    const Ctor = createMockRecognition(() => 'ok')
    const onEnd = vi.fn()
    const r = createRecognizer({ lang: 'ar-EG', ctor: Ctor, onEnd })
    r.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(r.text).toBe(MOCK_PHRASES.ar.join(' '))
    expect(onEnd).not.toHaveBeenCalled()
    r.stop()
    await vi.advanceTimersByTimeAsync(10)
    expect(onEnd).toHaveBeenCalledWith(null)
    vi.useRealTimers()
  })
})

describe('placing dictated words', () => {
  it('goes at the cursor with a space where one is needed', () => {
    expect(placeSpoken('one three', { start: 3, end: 3 }, ' two ')).toMatchObject({ body: 'one two three', caret: 7 })
    expect(placeSpoken('', { start: 0, end: 0 }, 'two').body).toBe('two')
  })
  it('replaces the selection, but only once there are words', () => {
    expect(placeSpoken('a bad day', { start: 2, end: 5 }, 'good').body).toBe('a good day')
    expect(placeSpoken('a bad day', { start: 2, end: 5 }, '').body).toBe('a bad day')
  })
  it('keeps the place inside a body that got shorter', () => {
    expect(placeSpoken('ab', { start: 9, end: 12 }, 'cd').body).toBe('ab cd')
  })
})

describe('live dictation with the provider', () => {
  const upload = {
    provider: 'deepgram' as const,
    method: 'POST' as const,
    url: 'https://api.deepgram.com/v1/listen?model=nova-3&language=ar&paragraphs=true&mip_opt_out=true&tag=t1',
    headers: { Authorization: 'Bearer abc' },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }

  it('keeps the tag, language and opt-out and asks for live results', () => {
    const u = new URL(liveUrl(upload.url))
    expect(u.protocol).toBe('wss:')
    expect(Object.fromEntries(u.searchParams)).toEqual({ model: 'nova-3', language: 'ar', mip_opt_out: 'true', tag: 't1', interim_results: 'true' })
  })

  it('sends audio once open, reports words and returns the request id', async () => {
    let ws!: Socket
    class Socket {
      readyState = 0
      sent: unknown[] = []
      onopen: (() => void) | null = null
      onmessage: ((e: { data: string }) => void) | null = null
      onclose: (() => void) | null = null
      constructor(public url: string, public protocols: string[]) {
        ws = this
      }
      send(x: unknown) {
        this.sent.push(x)
      }
      close() {
        this.readyState = 3
        this.onclose?.()
      }
    }
    const seen: [string, string][] = []
    const drop = vi.fn()
    const live = createSpeech({ socket: Socket as unknown as typeof WebSocket }).live(upload, { language: 'ar', onText: (f, l) => seen.push([f, l]), onDrop: drop })
    expect(ws.protocols).toEqual(['bearer', 'abc'])
    const chunk = new Blob(['x'])
    live.send(chunk)
    expect(ws.sent).toEqual([])
    ws.readyState = 1
    ws.onopen!()
    expect(ws.sent).toEqual([chunk])
    const say = (transcript: string, is_final: boolean) => ws.onmessage!({ data: JSON.stringify({ type: 'Results', is_final, metadata: { request_id: 'r1' }, channel: { alternatives: [{ transcript }] } }) })
    say('one', false)
    say('one two', true)
    say('three', false)
    const done = live.finish(3)
    expect(ws.sent.at(-1)).toBe('{"type":"CloseStream"}')
    ws.close()
    expect(await done).toBe('r1')
    expect(seen.at(-1)).toEqual(['one two three', ''])
    expect(drop).not.toHaveBeenCalled()
  })
})
