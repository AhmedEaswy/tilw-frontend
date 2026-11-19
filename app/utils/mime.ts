/** Pick the best MediaRecorder container the browser supports (Safari → mp4, others → webm). */
export function pickRecorderMime(kind: 'audio' | 'video'): string {
  const candidates =
    kind === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a', 'audio/mp4']
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return mime.startsWith('audio') ? 'm4a' : 'mp4'
  return 'webm'
}

/** "WebM" / "MP4" label shown in take review (6:46, 6:58). */
export function containerLabel(mime: string): string {
  return mime.includes('mp4') ? 'MP4' : 'WebM'
}

/** 42_000 → "00:42", 136_000 → "02:16". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
