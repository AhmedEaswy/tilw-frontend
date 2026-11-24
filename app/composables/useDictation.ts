/**
 * Feature 005 (research R10): microphone + recorder for dictation, reusing the studio's useMediaDevices, useRecorder
 * and useLevelMeter. The microphone is asked for only when `start()` runs (on the person's Dictate action), and
 * recording stops by itself at the plan's longest audio (`ai.audio_max_minutes`).
 */
import type { FinishedTake } from './useRecorder'

export function useDictation(opts: { maxMinutes: () => number; onAutoStop?: (take: FinishedTake) => void }) {
  const devices = useMediaDevices()
  const recorder = useRecorder({ onAutoStop: t => opts.onAutoStop?.(t) })
  const { level } = useLevelMeter(devices.stream)
  const supported = computed(() => import.meta.client && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)

  async function start(): Promise<boolean> {
    const ok = await devices.start('audio')
    if (!ok || !devices.stream.value) return false
    const started = await recorder.start(devices.stream.value, 'audio', null, opts.maxMinutes() * 60_000)
    if (!started) devices.stop()
    return started
  }

  async function stop(): Promise<FinishedTake | null> {
    const take = await recorder.stop('user')
    devices.stop()
    return take
  }

  function cancel() {
    void recorder.stop('interrupted')
    devices.stop()
  }

  onBeforeUnmount(cancel)

  return { state: devices.state, recording: recorder.recording, elapsedMs: recorder.elapsedMs, level, supported, start, stop, cancel }
}
