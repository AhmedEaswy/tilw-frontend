/**
 * Feature 005 (research R10): microphone + recorder for dictation, reusing the studio's useMediaDevices, useRecorder
 * and useLevelMeter. The microphone is asked for only when `start()` runs (on the person's Dictate action), and
 * recording stops by itself at the plan's longest audio (`ai.audio_max_minutes`).
 *
 * `cancel()` (closing the dialog, leaving the page) can come while `start()` still waits for the permission prompt:
 * each run has a token, and a run that was cancelled stops the tracks it got and never starts recording.
 */
import type { FinishedTake } from './useRecorder'

export function useDictation(opts: { maxMinutes: () => number; onAutoStop?: (take: FinishedTake) => void }) {
  const devices = useMediaDevices()
  const recorder = useRecorder({ onAutoStop: t => opts.onAutoStop?.(t) })
  const { level } = useLevelMeter(devices.stream)
  const supported = computed(() => import.meta.client && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
  /** Increases on every start and cancel; a start whose token is no longer current was cancelled. */
  let run = 0

  async function start(): Promise<boolean> {
    const mine = ++run
    const ok = await devices.start('audio')
    if (mine !== run) {
      devices.stop()
      return false
    }
    if (!ok || !devices.stream.value) return false
    const started = await recorder.start(devices.stream.value, 'audio', null, opts.maxMinutes() * 60_000)
    if (mine !== run) {
      if (started) void recorder.stop('interrupted')
      devices.stop()
      return false
    }
    if (!started) devices.stop()
    return started
  }

  async function stop(): Promise<FinishedTake | null> {
    run++
    const take = await recorder.stop('user')
    devices.stop()
    return take
  }

  function cancel() {
    run++
    void recorder.stop('interrupted')
    devices.stop()
  }

  onBeforeUnmount(cancel)

  return { state: devices.state, recording: recorder.recording, elapsedMs: recorder.elapsedMs, level, supported, start, stop, cancel }
}
