/**
 * Reader engine (US5, T060): plays a script at a constant WPM on requestAnimationFrame, or steps one
 * paragraph at a time in manual mode. Exposes `progress` (words read) and the current paragraph; the
 * surface maps progress to a stepped scroll offset (one move per line) with `progressToY`. Optional countdown before playing.
 */
import type { Ref } from 'vue'
import type { ReadingSettings } from '~/services/types'

export interface ReaderEngineOptions {
  /** Word count per paragraph. */
  words: Ref<number[]>
  settings: Ref<ReadingSettings>
  /** Pause marks: where to hold still, as a word position and seconds. */
  pauses?: Ref<{ at: number, sec: number }[]>
  /** Called when playback reaches the end of the script. */
  onEnd?: () => void
}

export function useReaderEngine(opts: ReaderEngineOptions) {
  const timeline = computed(() => buildTimeline(opts.words.value))
  const progress = ref(0)
  const playing = ref(false)
  /** Seconds left in the pre-roll countdown, or 0. */
  const countdown = ref(0)
  const ended = ref(false)
  /** Word position of the pause being held, or null. */
  const holdAt = ref<number | null>(null)

  const paragraph = computed(() => paragraphOfProgress(timeline.value, progress.value))
  const total = computed(() => timeline.value.words.length)

  let raf = 0
  let last = 0
  let holdUntil = 0
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  function frame(now: number) {
    if (!playing.value) return
    // Keep real time on slow or throttled devices; a hidden tab restarts the clock instead (see below).
    const dt = last ? Math.min(now - last, 1000) : 0
    last = now
    if (holdAt.value !== null) {
      if (now < holdUntil) return void (raf = requestAnimationFrame(frame))
      holdAt.value = null
    }
    // Crossing a pause mark: stop on it for its seconds, then carry on.
    const step = stepWithPauses(timeline.value, progress.value, dt, opts.settings.value.wpm, opts.pauses?.value)
    progress.value = step.progress
    if (step.hold) {
      holdAt.value = step.hold.at
      holdUntil = now + step.hold.sec * 1000
    }
    if (progress.value >= timeline.value.total) {
      stop()
      ended.value = true
      opts.onEnd?.()
      return
    }
    raf = requestAnimationFrame(frame)
  }

  function startLoop() {
    playing.value = true
    last = 0
    raf = requestAnimationFrame(frame)
  }

  function clearCountdown() {
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = undefined
    countdown.value = 0
  }

  /**
   * Start playing (constant mode). Runs the countdown first when one is set, unless `countdown: false`
   * (the recording studio runs its own countdown before the take).
   */
  function play(o: { countdown?: boolean } = {}) {
    if (opts.settings.value.mode !== 'constant' || playing.value || countdown.value) return
    if (ended.value || progress.value >= timeline.value.total) restart()
    const sec = o.countdown === false ? 0 : opts.settings.value.countdownSec
    if (!sec) return startLoop()
    countdown.value = sec
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) {
        clearCountdown()
        startLoop()
      }
    }, 1000)
  }

  function stop() {
    holdAt.value = null
    playing.value = false
    cancelAnimationFrame(raf)
    clearCountdown()
  }

  function toggle() {
    if (playing.value || countdown.value) stop()
    else play()
  }

  function goTo(i: number) {
    holdAt.value = null
    ended.value = false
    progress.value = paragraphStart(timeline.value, i)
  }
  const next = () => {
    if (paragraph.value + 1 >= total.value) {
      // Manual mode reaches the end by stepping past the last paragraph.
      stop()
      progress.value = timeline.value.total
      ended.value = true
      opts.onEnd?.()
      return
    }
    goTo(paragraph.value + 1)
  }
  const prev = () => goTo(ended.value ? total.value - 1 : paragraph.value - 1)
  /** Back to the start of the paragraph being read (or the previous one when already at its start). */
  function rewind() {
    const start = paragraphStart(timeline.value, paragraph.value)
    goTo(progress.value - start < 1 && !ended.value ? paragraph.value - 1 : paragraph.value)
  }
  function restart() {
    holdAt.value = null
    ended.value = false
    progress.value = 0
  }
  function seek(p: number) {
    holdAt.value = null
    ended.value = false
    progress.value = Math.min(Math.max(0, p), Math.max(0, timeline.value.total - 1))
  }

  // Switching to manual stops playback and snaps to the paragraph start.
  watch(() => opts.settings.value.mode, (m) => {
    if (m === 'manual') {
      stop()
      if (!ended.value) goTo(paragraph.value)
    }
  })

  // A hidden tab gets no frames: start timing again from the next visible frame so the text doesn't jump.
  function onVisibility() {
    last = 0
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return { timeline, progress, playing, countdown, ended, holdAt, paragraph, total, play, stop, toggle, next, prev, rewind, restart, goTo, seek }
}

export type ReaderEngine = ReturnType<typeof useReaderEngine>
