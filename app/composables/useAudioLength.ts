/**
 * Feature 005 (research R3): the length of an audio Blob or File in seconds, read on the device through a detached
 * <audio> element. MediaRecorder WebM files report `Infinity` until the browser is asked to seek far ahead; that is
 * done here. Resolves null when the length can't be read (the caller refuses the file, or falls back to the
 * recorder's own clock).
 */
export function readAudioLength(blob: Blob, timeoutMs = 8000): Promise<number | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const el = document.createElement('audio')
    let done = false
    const finish = (v: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src')
      el.load()
      URL.revokeObjectURL(url)
      resolve(v !== null && Number.isFinite(v) && v > 0 ? v : null)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) finish(el.duration)
      else el.currentTime = 1e7
    }
    el.ondurationchange = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) finish(el.duration)
    }
    el.ontimeupdate = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) finish(el.duration)
    }
    el.onerror = () => finish(null)
    el.src = url
  })
}

export function useAudioLength() {
  return { readAudioLength }
}
