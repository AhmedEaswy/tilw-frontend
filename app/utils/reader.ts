/**
 * Reader timing (US5, T060). Pure functions so the WPM maths can be unit-tested without a browser.
 *
 * Reading progress is measured in words: 0 … total. Constant mode advances it at `wpm / 60` words per
 * second, so the pace is exact whatever the font size or line width. The surface turns progress into a
 * scroll offset by interpolating across the measured paragraph boxes.
 */
import type { ReadingPosition, ReadingSettings } from '~/services/types'

export interface Timeline {
  /** Word index where each paragraph starts. */
  starts: number[]
  /** Word count of each paragraph (≥ 1). */
  words: number[]
  total: number
}

export interface ReaderLayout {
  /** Top of each paragraph box inside the scrolling column, in px. */
  tops: number[]
  heights: number[]
  /** Height of one rendered line, in px. */
  lineH: number
}

export const WPM_MIN = 60
export const WPM_MAX = 220
export const WPM_STEP = 10

/** Font size steps (current-line px on desktop, Figma 6:28 shows 48 for the default). */
export const FONT_PX: Record<ReadingSettings['fontSize'], number> = { S: 40, M: 48, L: 56, XL: 64 }
export const FONT_STEPS = ['S', 'M', 'L', 'XL'] as const
/** Line width steps (Figma 6:30 shows 640 for the default). */
export const LINE_PX: Record<ReadingSettings['lineWidth'], number> = { narrow: 520, medium: 640, wide: 760 }
export const LINE_STEPS = ['narrow', 'medium', 'wide'] as const

export const clampWpm = (v: number) => Math.min(WPM_MAX, Math.max(WPM_MIN, Math.round(v / WPM_STEP) * WPM_STEP))

export function buildTimeline(paragraphWords: number[]): Timeline {
  const words = paragraphWords.map(w => Math.max(1, w))
  const starts: number[] = []
  let total = 0
  for (const w of words) {
    starts.push(total)
    total += w
  }
  return { starts, words, total }
}

/** Index of the paragraph being read at `progress`. The end of the script counts as the last paragraph. */
export function paragraphOfProgress(tl: Timeline, progress: number): number {
  if (!tl.words.length) return 0
  let i = 0
  while (i + 1 < tl.starts.length && progress >= tl.starts[i + 1]!) i++
  return i
}

/** Advance progress by `dtMs` of reading at `wpm`. Never passes the end. */
export function advance(tl: Timeline, progress: number, dtMs: number, wpm: number): number {
  return Math.min(tl.total, progress + (Math.max(0, dtMs) / 60_000) * wpm)
}

/**
 * Scroll offset (px from the top of the column) of the reading line for a progress value.
 * The text moves in steps, not continuously: each rendered line gets an equal share of its paragraph's
 * words, the view holds on a line for that long, then moves once to the next line (or paragraph).
 */
export function progressToY(tl: Timeline, layout: ReaderLayout, progress: number): number {
  const n = tl.words.length
  if (!n || layout.tops.length !== n) return 0
  const i = paragraphOfProgress(tl, progress)
  const half = layout.lineH / 2
  const lines = layout.lineH > 0 ? Math.max(1, Math.round(layout.heights[i]! / layout.lineH)) : 1
  const frac = Math.min(1, Math.max(0, (progress - tl.starts[i]!) / tl.words[i]!))
  const line = Math.min(lines - 1, Math.floor(frac * lines))
  return layout.tops[i]! + line * layout.lineH + half
}

/** Saved position ↔ progress. `offset` is the word offset inside the paragraph. */
export function positionToProgress(tl: Timeline, pos: ReadingPosition | null | undefined): number {
  if (!pos || !tl.words.length) return 0
  const i = Math.min(Math.max(0, pos.paragraph), tl.words.length - 1)
  const off = Math.min(Math.max(0, pos.offset), tl.words[i]! - 1)
  return tl.starts[i]! + off
}

export function progressToPosition(tl: Timeline, progress: number): ReadingPosition {
  const i = paragraphOfProgress(tl, progress)
  return { paragraph: i, offset: Math.max(0, Math.floor(progress - (tl.starts[i] ?? 0))) }
}

/** Progress at the start of paragraph `i` (clamped). */
export function paragraphStart(tl: Timeline, i: number): number {
  if (!tl.words.length) return 0
  return tl.starts[Math.min(Math.max(0, i), tl.words.length - 1)]!
}
