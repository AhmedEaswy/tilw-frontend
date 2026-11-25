/**
 * Mock mode only (gaps G-A5): replaces the browser's speech recognition with a scripted one, so dictation can be
 * tried and tested without speaking. The `/__mock` knob "Speech recognition" picks how it behaves:
 * - `ok`: says a few phrases (each first as live text, then final), then the browser "ends" the session by itself
 *   once, which the app must restart quietly; afterwards it stays silent until stopped.
 * - `unsupported`: no recognition at all (as in Firefox).
 * - `denied`: the microphone is refused.
 * - `network`: the API is there but fails at once (as in Brave or Opera).
 */
import type { RecognitionLike } from '~/services/ai/recognition'

export const MOCK_RECOGNITION_KEY = 'tilw:mock:recognition'
export type MockRecognitionMode = 'ok' | 'unsupported' | 'denied' | 'network'

export const MOCK_PHRASES: Record<'ar' | 'en', string[]> = {
  ar: ['فاكتبه لنا.', 'ربما يكون سؤالك هو الحكاية التالية.', 'كل حكاية تبدأ بسؤال صغير.'],
  en: ['Write it to us.', 'Your question may be the next story.'],
}

export function mockRecognitionMode(kv: Pick<Storage, 'getItem'> | null): MockRecognitionMode {
  try {
    const v = kv?.getItem(MOCK_RECOGNITION_KEY)
    return v === 'unsupported' || v === 'denied' || v === 'network' ? v : 'ok'
  } catch {
    return 'ok'
  }
}

const STEP = 120

export function createMockRecognition(mode: () => MockRecognitionMode) {
  /** Phrases are said once per page; a restart after the browser's own end hears nothing more. */
  let said = false

  return class MockRecognition implements RecognitionLike {
    lang = 'ar-EG'
    continuous = false
    interimResults = false
    maxAlternatives = 1
    onstart: RecognitionLike['onstart'] = null
    onend: RecognitionLike['onend'] = null
    onerror: RecognitionLike['onerror'] = null
    onresult: RecognitionLike['onresult'] = null
    private timers: ReturnType<typeof setTimeout>[] = []
    private live = true

    private later(ms: number, fn: () => void) {
      this.timers.push(setTimeout(() => this.live && fn(), ms))
    }

    start() {
      const m = mode()
      if (m === 'denied' || m === 'network') {
        this.later(STEP, () => {
          this.onerror?.({ error: m === 'denied' ? 'not-allowed' : 'network' })
          this.finish()
        })
        return
      }
      this.later(STEP, () => this.onstart?.())
      if (said) return
      said = true
      const phrases = MOCK_PHRASES[this.lang.startsWith('ar') ? 'ar' : 'en']
      const results: { isFinal: boolean; 0: { transcript: string } }[] = []
      let at = STEP * 2
      phrases.forEach((p, i) => {
        const words = p.split(' ')
        const half = words.slice(0, Math.ceil(words.length / 2)).join(' ')
        this.later(at, () => this.onresult?.({ resultIndex: i, results: [...results, { isFinal: false, 0: { transcript: half } }] }))
        at += STEP
        this.later(at, () => {
          results.push({ isFinal: true, 0: { transcript: i ? ` ${p}` : p } })
          this.onresult?.({ resultIndex: i, results: [...results] })
        })
        at += STEP
      })
      // The browser ends the session by itself after the words (a pause): the app should start it again.
      this.later(at + STEP, () => this.finish())
    }

    private finish() {
      if (!this.live) return
      this.live = false
      this.timers.forEach(clearTimeout)
      setTimeout(() => this.onend?.(), 0)
    }

    stop() {
      this.finish()
    }

    abort() {
      this.live = false
      this.timers.forEach(clearTimeout)
    }
  }
}

/** Installs the scripted recognizer on `window` (or removes recognition entirely for `unsupported`). */
export function installMockRecognition(w: Window & Record<string, unknown>, kv: Pick<Storage, 'getItem'>) {
  const mode = () => mockRecognitionMode(kv)
  const Ctor = createMockRecognition(mode)
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Object.defineProperty(w, name, {
      configurable: true,
      get: () => (mode() === 'unsupported' ? undefined : Ctor),
    })
  }
}
