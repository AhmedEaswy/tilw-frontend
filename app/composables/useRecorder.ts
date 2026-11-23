/**
 * MediaRecorder wrapper (US6, T070). Picks the best container the browser supports, collects chunks in
 * memory, and stops on its own at the plan's take length (release 2; 10 minutes when unknown), when browser storage would run out, or when the stream's
 * tracks end (device unplugged). `stop()` resolves with the finished file in every case, so a partial take
 * is still saved (G8).
 */
import type { MediaKind } from './useMediaDevices'

export interface FinishedTake {
  blob: Blob
  mimeType: string
  durationMs: number
  reason: StopReason
}

export function useRecorder(opts: { onAutoStop?: (take: FinishedTake) => void } = {}) {
  const recording = ref(false)
  const elapsedMs = ref(0)
  const bytes = ref(0)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let freeAtStart: number | null = null
  let limitMs = RECORD_LIMIT_MS
  let timer: ReturnType<typeof setInterval> | undefined
  /** Callers waiting for the file, and the reason the first one gave. */
  let waiters: ((t: FinishedTake) => void)[] = []
  let stopReason: StopReason | null = null
  let mime = ''

  /** Start recording `stream`. Resolves false when the browser can't record this kind. */
  async function start(stream: MediaStream, kind: MediaKind, free: number | null, maxMs = RECORD_LIMIT_MS) {
    if (recording.value) return true
    mime = pickRecorderMime(kind)
    if (typeof MediaRecorder === 'undefined') return false
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      return false
    }
    mime = recorder.mimeType || mime || (kind === 'video' ? 'video/webm' : 'audio/webm')
    chunks = []
    bytes.value = 0
    elapsedMs.value = 0
    freeAtStart = free
    limitMs = maxMs

    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data)
        bytes.value += e.data.size
      }
    }
    recorder.onstop = () => finish()
    stream.getTracks().forEach(t => t.addEventListener('ended', onTrackEnded))

    recorder.start(1000)
    startedAt = performance.now()
    recording.value = true
    timer = setInterval(() => {
      elapsedMs.value = performance.now() - startedAt
      const why = mustStop(elapsedMs.value, bytes.value, freeAtStart, limitMs)
      if (why) void autoStop(why)
    }, 250)
    return true
  }

  function onTrackEnded() {
    if (recording.value) void autoStop('interrupted')
  }

  async function autoStop(reason: StopReason) {
    const take = await stop(reason)
    if (take) opts.onAutoStop?.(take)
  }

  function finish() {
    if (timer) clearInterval(timer)
    timer = undefined
    recorder?.stream.getTracks().forEach(t => t.removeEventListener('ended', onTrackEnded))
    const durationMs = Math.min(limitMs, performance.now() - startedAt)
    elapsedMs.value = durationMs
    recording.value = false
    const take: FinishedTake = { blob: new Blob(chunks, { type: mime }), mimeType: mime, durationMs, reason: stopReason ?? 'interrupted' }
    chunks = []
    recorder = null
    const done = waiters
    waiters = []
    stopReason = null
    // The browser can stop the recorder by itself (device gone): nobody asked, so hand the file over here.
    if (done.length) done.forEach(r => r(take))
    else opts.onAutoStop?.(take)
  }

  /** Stop and return the finished file. Returns null when nothing was recording. */
  function stop(reason: StopReason = 'user'): Promise<FinishedTake | null> {
    if (!recorder || !recording.value) return Promise.resolve(null)
    return new Promise((resolve) => {
      waiters.push(resolve)
      if (stopReason) return // already stopping; resolve with the same file
      stopReason = reason
      try {
        recorder!.requestData()
        recorder!.stop()
      } catch {
        finish()
      }
    })
  }

  onBeforeUnmount(() => {
    if (recording.value) void stop('interrupted')
  })

  return { recording, elapsedMs, bytes, start, stop }
}
