/**
 * Feature 005, gaps G-A5: dictation on the device. A thin wrapper over the browser's own speech recognition (Web Speech
 * API). No Tilw request, no AI service, no credits: Chrome sends the audio to Google, Safari to Apple.
 *
 * The browser ends a session by itself after a pause or about a minute; the wrapper starts it again quietly until
 * `stop()`. Final text is kept across those sessions; the live (interim) part is replaced on every result.
 */

export type RecognitionProblem = 'denied' | 'missing' | 'offline' | 'unavailable'

/** The parts of `SpeechRecognition` we use (the DOM typings don't ship it everywhere). */
export interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
}
export type RecognitionCtor = new () => RecognitionLike

export function recognitionCtor(w: unknown = typeof window === 'undefined' ? globalThis : window): RecognitionCtor | null {
  if (!w) return null
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null
}

export function recognitionSupported(w?: unknown): boolean {
  return recognitionCtor(w) !== null
}

/** Joins two pieces of recognised speech with one space (browsers differ on leading spaces). */
export function joinSpeech(a: string, b: string): string {
  const x = a.trim()
  const y = b.trim()
  return x && y ? `${x} ${y}` : x || y
}

/** Maps a `SpeechRecognitionErrorEvent.error` to what we tell the person; null = keep listening. */
export function recognitionProblem(error: string, heardAnything: boolean): RecognitionProblem | null {
  switch (error) {
    case 'no-speech':
    case 'aborted':
      return null
    case 'audio-capture':
      return 'missing'
    case 'not-allowed':
    case 'service-not-allowed':
      // Brave and Opera expose the API but refuse at once with no prompt; Safari refuses this way when Siri is off.
      // Before any text, we can't tell that from a refused microphone, so both say how to allow it.
      return 'denied'
    case 'network':
      // Brave/Opera also fail like this before any word: the API is there but nothing serves it.
      return heardAnything ? 'offline' : 'unavailable'
    case 'language-not-supported':
    case 'bad-grammar':
    default:
      return 'unavailable'
  }
}

export interface Recognizer {
  start(): void
  stop(): void
  abort(): void
  readonly text: string
}

export interface RecognizerOptions {
  lang: string
  ctor?: RecognitionCtor | null
  onListening?: () => void
  /** Final text so far and the live part still being recognised. */
  onText?: (finalText: string, liveText: string) => void
  /** Ended for good: by `stop()` (problem null) or by a problem. */
  onEnd?: (problem: RecognitionProblem | null) => void
  /** Restarts after the browser ends a session by itself; a quick loop of empty sessions gives up. */
  maxQuickRestarts?: number
}

export function createRecognizer(opts: RecognizerOptions): Recognizer {
  const Ctor = opts.ctor === undefined ? recognitionCtor() : opts.ctor
  let finalText = ''
  let live = ''
  let wanted = false
  let ended = false
  let problem: RecognitionProblem | null = null
  let quick = 0
  let startedAt = 0
  let current: RecognitionLike | null = null
  const maxQuick = opts.maxQuickRestarts ?? 5

  function finish(p: RecognitionProblem | null) {
    if (ended) return
    ended = true
    wanted = false
    // Whatever was still being recognised when it stopped counts as said.
    if (live) {
      finalText = joinSpeech(finalText, live)
      live = ''
      opts.onText?.(finalText, '')
    }
    opts.onEnd?.(p)
  }

  function session() {
    if (!Ctor) return finish('unavailable')
    const r = new Ctor()
    current = r
    r.lang = opts.lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => {
      startedAt = Date.now()
      opts.onListening?.()
    }
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!
        const said = res[0].transcript
        if (res.isFinal) finalText = joinSpeech(finalText, said)
        else interim = joinSpeech(interim, said)
      }
      live = interim
      quick = 0
      opts.onText?.(finalText, live)
    }
    r.onerror = (e) => {
      const p = recognitionProblem(e.error, !!finalText || !!live)
      if (p) {
        problem = p
        wanted = false
      }
    }
    r.onend = () => {
      if (current !== r) return
      current = null
      // Keep a live part from a session the browser cut short.
      if (live) {
        finalText = joinSpeech(finalText, live)
        live = ''
        opts.onText?.(finalText, '')
      }
      if (!wanted) return finish(problem)
      // The browser ended it by itself (pause, time limit): start again, unless it keeps ending at once.
      quick = Date.now() - startedAt < 1000 ? quick + 1 : 0
      if (quick > maxQuick) return finish('unavailable')
      try {
        session()
      } catch {
        finish('unavailable')
      }
    }
    r.start()
  }

  return {
    get text() {
      return joinSpeech(finalText, live)
    },
    start() {
      if (wanted || ended) return
      wanted = true
      try {
        session()
      } catch {
        finish('unavailable')
      }
    },
    stop() {
      if (ended) return
      wanted = false
      if (current) current.stop()
      else finish(problem)
    },
    abort() {
      if (ended) return
      wanted = false
      const r = current
      current = null
      ended = true
      r?.abort()
    },
  }
}

/** Dictation languages offered in the dialog; rtl scripts use the saved Arabic one, ltr scripts English. */
export const DICTATION_LANGS = ['ar-EG', 'ar-SA', 'ar-AE', 'ar-JO', 'en-US'] as const
export type DictationLang = (typeof DICTATION_LANGS)[number]
export const DICTATION_LANG_KEY = 'tilw:dictate:lang'

export function dictationLang(direction: 'rtl' | 'ltr' | string, saved: string | null): DictationLang {
  const known = (DICTATION_LANGS as readonly string[]).includes(saved ?? '') ? (saved as DictationLang) : null
  if (direction === 'ltr') return known && !known.startsWith('ar') ? known : 'en-US'
  return known && known.startsWith('ar') ? known : 'ar-EG'
}
