import type { PracticeInput, PracticeVia } from '~/services/types'

/** Runs shorter than this are not practice (a tap on Play, a quick check of the text). */
export const PRACTICE_MIN_S = 10
/** A run paused longer than this has ended; it ends at its last activity. */
export const PRACTICE_IDLE_MS = 60_000
const MAX_S = 21_600

/**
 * Feature 007: reports one finished teleprompter run (`POST /api/practice-sessions`) in the background. A failure is
 * ignored: practice tracking never blocks or interrupts the studio. Runs under 10 s are not reported.
 */
export function logPractice(input: Omit<PracticeInput, 'durationS'> & { durationMs: number }) {
  const durationS = Math.min(MAX_S, Math.round(input.durationMs / 1000))
  if (durationS < PRACTICE_MIN_S) return
  const { durationMs: _ms, ...rest } = input
  void useServices().practice.log({ ...rest, durationS }).catch(() => {})
}

/**
 * Feature 007 (rehearsal): one run starts when the reader starts playing (or the first manual step), and ends when the
 * script reaches its end, after a minute without playing or stepping, or when the page is hidden or left. Its length is
 * from the start to the last activity, so a long pause isn't counted.
 */
export function usePracticeRun(opts: {
  scriptId: () => string | null
  playing: Ref<boolean>
  ended?: Ref<boolean>
  via: () => PracticeVia
  now?: () => number
}) {
  const now = opts.now ?? Date.now
  let startedAt: number | null = null
  let lastActive = 0
  let via: PracticeVia = 'web'

  function touch() {
    const t = now()
    if (startedAt === null) {
      startedAt = t
      via = opts.via()
    }
    lastActive = t
  }
  function end() {
    if (startedAt === null) return
    const started = startedAt
    if (opts.playing.value) lastActive = now()
    startedAt = null
    logPractice({ scriptId: opts.scriptId(), startedAt: new Date(started).toISOString(), durationMs: lastActive - started, recorded: false, via })
  }

  watch(opts.playing, (p) => {
    if (p) touch()
    else if (startedAt !== null) lastActive = now()
    // A phone link that connects during a run makes the run phone-driven.
    if (p && opts.via() === 'phone') via = 'phone'
  })
  if (opts.ended) watch(opts.ended, e => e && end())
  useIntervalFn(() => {
    if (startedAt === null) return
    if (opts.playing.value) lastActive = now()
    else if (now() - lastActive > PRACTICE_IDLE_MS) end()
  }, 5000)
  useEventListener(typeof document === 'undefined' ? null : document, 'visibilitychange', () => {
    if (document.hidden) end()
  })
  onBeforeUnmount(end)

  return { touch, end }
}
