/**
 * Reader engine (US5, T060): plays a script at a constant WPM on requestAnimationFrame, or steps one
 * paragraph at a time in manual mode. Exposes `progress` (words read) and the current paragraph; the
 * surface maps progress to a scroll offset with `progressToY`. Optional countdown before playing.
 */
import type { Ref } from 'vue'
import type { ReadingSettings } from '~/services/types'

export interface ReaderEngineOptions {
  /** Word count per paragraph. */
  words: Ref<number[]>
  settings: Ref<ReadingSettings>
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

  const paragraph = computed(() => paragraphOfProgress(timeline.value, progress.value))
  const total = computed(() => timeline.value.words.length)

  let raf = 0
  let last = 0
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  function frame(now: number) {
    if (!playing.value) return
    const dt = last ? Math.min(now - last, 250) : 0 // a background tab must not jump far ahead
    last = now
    progress.value = advance(timeline.value, progress.value, dt, opts.settings.value.wpm)
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

  /** Start playing (constant mode). Runs the countdown first when one is set. */
  function play() {
    if (opts.settings.value.mode !== 'constant' || playing.value || countdown.value) return
    if (ended.value || progress.value >= timeline.value.total) restart()
    const sec = opts.settings.value.countdownSec
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
    playing.value = false
    cancelAnimationFrame(raf)
    clearCountdown()
  }

  function toggle() {
    if (playing.value || countdown.value) stop()
    else play()
  }

  function goTo(i: number) {
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
    ended.value = false
    progress.value = 0
  }
  function seek(p: number) {
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

  onBeforeUnmount(stop)

  return { timeline, progress, playing, countdown, ended, paragraph, total, play, stop, toggle, next, prev, rewind, restart, goTo, seek }
}

export type ReaderEngine = ReturnType<typeof useReaderEngine>
