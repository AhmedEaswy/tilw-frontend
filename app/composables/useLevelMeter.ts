/**
 * Live microphone level for the meter and the audio sound check (US6, T070). Reads the stream's audio
 * through an AnalyserNode on requestAnimationFrame; nothing is recorded or sent anywhere.
 * `history` keeps the last levels for the waveform in the audio frames (6:51).
 */
import type { Ref } from 'vue'

export function useLevelMeter(stream: Ref<MediaStream | null>, opts: { historySize?: number } = {}) {
  const level = ref(0)
  const history = ref<number[]>(Array.from({ length: opts.historySize ?? 48 }, () => 0))

  let ctx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let raf = 0
  let lastPush = 0

  function teardown() {
    cancelAnimationFrame(raf)
    source?.disconnect()
    source = null
    void ctx?.close().catch(() => {})
    ctx = null
    level.value = 0
  }

  function setup(s: MediaStream | null) {
    teardown()
    if (!s || !s.getAudioTracks().length || typeof AudioContext === 'undefined') return
    ctx = new AudioContext()
    source = ctx.createMediaStreamSource(s)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    const tick = (now: number) => {
      analyser.getByteTimeDomainData(buf)
      const v = levelFromSamples(buf)
      // Fast attack, slow release so the meter is readable.
      level.value = v > level.value ? v : level.value * 0.85 + v * 0.15
      if (now - lastPush > 70) {
        lastPush = now
        history.value = [...history.value.slice(1), level.value]
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  watch(stream, setup, { immediate: true })
  onBeforeUnmount(teardown)

  return { level, history }
}
