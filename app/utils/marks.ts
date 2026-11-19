/**
 * Delivery marks (emphasis / pause / note) are character ranges in the script body.
 * When the body is edited, `shiftMarks` moves them so they keep pointing at the same words.
 */
import type { DeliveryMark } from '~/services/types'

export interface TextEdit {
  /** Start of the changed region (same in old and new text). */
  at: number
  /** Length of the old text that was replaced. */
  removed: number
  /** Length of the new text inserted at `at`. */
  inserted: number
}

/** Smallest single edit that turns `before` into `after` (common prefix and suffix). */
export function diffEdit(before: string, after: string): TextEdit | null {
  if (before === after) return null
  const max = Math.min(before.length, after.length)
  let p = 0
  while (p < max && before[p] === after[p]) p++
  let s = 0
  while (s < max - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++
  return { at: p, removed: before.length - p - s, inserted: after.length - p - s }
}

export function shiftMarks(marks: DeliveryMark[], edit: TextEdit | null): DeliveryMark[] {
  if (!edit) return marks
  const { at, removed, inserted } = edit
  const oldEnd = at + removed
  const delta = inserted - removed
  const moveStart = (x: number) => (x <= at ? x : x >= oldEnd ? x + delta : at + inserted)
  const moveEnd = (x: number) => (x <= at ? x : x >= oldEnd ? x + delta : at + inserted)

  const out: DeliveryMark[] = []
  for (const m of marks) {
    if (m.type === 'pause') {
      // A pause inside deleted text disappears; otherwise it moves with the text after it.
      if (m.start > at && m.start < oldEnd) continue
      const pos = moveStart(m.start)
      out.push({ ...m, start: pos, end: pos })
      continue
    }
    const start = moveStart(m.start)
    const end = moveEnd(m.end)
    if (end > start) out.push({ ...m, start, end })
  }
  return out
}

/** Clamp marks to a body length and drop broken ones (used when loading or after undo). */
export function cleanMarks(marks: DeliveryMark[], length: number): DeliveryMark[] {
  return marks
    .map(m => ({ ...m, start: Math.max(0, Math.min(m.start, length)), end: Math.max(0, Math.min(m.end, length)) }))
    .filter(m => (m.type === 'pause' ? true : m.end > m.start))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Paragraph ranges [start, end) in the body, matching splitParagraphs(). */
export function paragraphRanges(body: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g
  for (const m of body.matchAll(re)) {
    if (m[0].trim()) out.push({ start: m.index!, end: m.index! + m[0].length })
  }
  return out
}

/** Index of the paragraph that contains (or comes right before) a caret position. */
export function paragraphAt(body: string, caret: number): number {
  const ranges = paragraphRanges(body)
  let idx = 0
  ranges.forEach((r, i) => {
    if (caret >= r.start) idx = i
  })
  return idx
}

/** All case-insensitive matches of `q` in `text` as [start, end) ranges. */
export function findAll(text: string, q: string): { start: number; end: number }[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const hay = text.toLowerCase()
  const out: { start: number; end: number }[] = []
  let i = hay.indexOf(needle)
  while (i >= 0 && out.length < 500) {
    out.push({ start: i, end: i + needle.length })
    i = hay.indexOf(needle, i + needle.length)
  }
  return out
}
