/**
 * Feature 005: costs and audio checks made before any call (spec FR-009). Pure, unit-tested.
 * Costs follow backend 004: 1 credit per started 1,000 words, 1 per started minute.
 */
import { AI_RULES } from '../types'

export const creditsForWords = (words: number): number => Math.max(1, Math.ceil(words / AI_RULES.wordsPerCredit))
export const creditsForSeconds = (seconds: number): number => Math.max(1, Math.ceil(seconds / AI_RULES.secondsPerCredit))

const VIDEO_OK = ['video/webm', 'video/mp4', 'video/quicktime']

/** `audio/*`, or a video container the speech provider reads (a take). Parameters (`;codecs=`) are ignored. */
export function isAllowedAudioType(mime: string): boolean {
  const base = mime.split(';')[0]!.trim().toLowerCase()
  return base.startsWith('audio/') || VIDEO_OK.includes(base)
}

export type AudioProblem =
  | { reason: 'type' }
  | { reason: 'size'; maxMb: number }
  | { reason: 'length'; maxMinutes: number }
  | { reason: 'unknown_length' }
  | { reason: 'empty' }

/** Why this audio can't be transcribed, or null when it can. `seconds` null = the length couldn't be read. */
export function checkAudio(file: { type: string; size: number }, seconds: number | null, maxMinutes: number = AI_RULES.audioMaxMinutes): AudioProblem | null {
  if (!isAllowedAudioType(file.type || '')) return { reason: 'type' }
  if (file.size <= 0) return { reason: 'empty' }
  if (file.size > AI_RULES.audioMaxBytes) return { reason: 'size', maxMb: Math.round(AI_RULES.audioMaxBytes / 1024 / 1024) }
  if (seconds === null || !Number.isFinite(seconds)) return { reason: 'unknown_length' }
  if (seconds <= 0) return { reason: 'empty' }
  if (seconds > maxMinutes * 60) return { reason: 'length', maxMinutes }
  return null
}

/** Device length rounded up to whole seconds, as the contract asks (device-flows §1). */
export const declaredSeconds = (seconds: number): number => Math.max(1, Math.ceil(seconds - 1e-6))

/** `m:ss` (or `h:mm:ss`) for a length in seconds. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
