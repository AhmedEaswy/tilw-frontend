/**
 * Recording helpers (US6). Pure functions so limits and meters can be unit-tested without media devices.
 */
import { extensionFor } from './mime'

/** Longest take (FR-031): 10 minutes. */
export const RECORD_LIMIT_MS = 10 * 60_000
/** Below this much free browser storage the studio warns before recording (G8). */
export const LOW_STORAGE_BYTES = 200 * 1024 * 1024
/** Stop a running take once it would use this share of the free space left at the start (G8). */
export const QUOTA_SAFETY = 0.9
/** Level meter segments in the frames (6:39, 6:44). */
export const LEVEL_SEGMENTS = 17

export type StopReason = 'user' | 'limit' | 'interrupted' | 'quota'

/** RMS of 8-bit time-domain samples (AnalyserNode.getByteTimeDomainData), mapped to 0..1 for display. */
export function levelFromSamples(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i]! - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / samples.length)
  // Speech sits around 0.05–0.3 RMS; a gentle curve keeps normal speaking in the middle of the meter.
  return Math.min(1, Math.sqrt(rms) * 1.6)
}

/**
 * Segment states for the meter: lit segments are sage, the top two lit ones are the cue colour
 * (as drawn in 6:39), the rest are off.
 */
export function levelSegments(level: number, n = LEVEL_SEGMENTS): ('lo' | 'hi' | 'off')[] {
  const lit = Math.round(Math.min(1, Math.max(0, level)) * n)
  return Array.from({ length: n }, (_, i) => (i >= lit ? 'off' : i >= lit - 2 ? 'hi' : 'lo'))
}

/** Why a running take must stop now, if it must. */
export function mustStop(elapsedMs: number, bytes: number, freeAtStart: number | null): StopReason | null {
  if (elapsedMs >= RECORD_LIMIT_MS) return 'limit'
  if (freeAtStart !== null && bytes >= freeAtStart * QUOTA_SAFETY) return 'quota'
  return null
}

/** Free space from `navigator.storage.estimate()`, or null when the browser doesn't say. */
export function freeBytes(estimate: { quota?: number; usage?: number } | null | undefined): number | null {
  if (!estimate || typeof estimate.quota !== 'number') return null
  return Math.max(0, estimate.quota - (estimate.usage ?? 0))
}

/** File name for a downloaded original: "افتتاحية الحلقة - المحاولة 2.webm". */
export function takeFileName(title: string, number: number, mime: string, word = 'take'): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'tilw'
  return `${safe} - ${word} ${number}.${extensionFor(mime)}`
}
