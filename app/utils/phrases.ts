/**
 * Reader phrases: a paragraph is shown as short blocks, one per stop. A block ends where the speaker can
 * stop: after a sentence, at a line break the author typed, or at a pause mark. Nothing breaks inside a
 * sentence, so a gap between blocks always means "stop" and wrapping inside a block never does.
 * Auto-imported by Nuxt.
 */
import { countWords } from './text'

export interface Phrase {
  text: string
  words: number
  /** Seconds to hold after this phrase (a pause mark from the editor). */
  pause?: number
  /** Emphasised stretches, as [start, end) character offsets inside `text`. */
  emph?: [number, number][]
  /** Note for the speaker (a note mark that starts in this phrase). */
  note?: string
}

/** Emphasis and notes inside a paragraph: character offsets from the start of the paragraph text. */
export interface RangeMarks {
  emphasis?: { start: number, end: number }[]
  notes?: { start: number, text: string }[]
}

/** A pause mark inside a paragraph: `offset` is a character offset from the start of the paragraph text. */
export interface PauseAt {
  offset: number
  sec: number
}

const MAX_WORDS = 14
const END = /[.!؟?…؛:]+["”»)]*\s+/g
const COMMA = /[،,]\s+/g

/** Break a long sentence at the comma nearest its middle (once, so blocks stay short but whole). */
function splitLong(text: string, from: number, out: number[]) {
  if (countWords(text) <= MAX_WORDS) return
  const mid = text.length / 2
  let best = -1
  for (const m of text.matchAll(COMMA)) {
    const at = m.index! + m[0].length
    if (at < text.length && (best < 0 || Math.abs(at - mid) < Math.abs(best - mid))) best = at
  }
  if (best > 0) out.push(from + best)
}

export function splitPhrases(text: string, pauses: PauseAt[] = [], marks: RangeMarks = {}): Phrase[] {
  const cuts = new Set<number>()
  for (const m of text.matchAll(END)) cuts.add(m.index! + m[0].length)
  for (const m of text.matchAll(/[ \t]*\n[ \t]*/g)) cuts.add(m.index! + m[0].length)
  for (const p of pauses) {
    // A pause cuts after the word it follows, skipping the space between.
    let at = p.offset
    while (at < text.length && /\s/.test(text[at]!)) at++
    if (at > 0 && at < text.length) cuts.add(at)
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const bounds = [0, ...sorted, text.length]
  const extra: number[] = []
  for (let i = 0; i + 1 < bounds.length; i++) splitLong(text.slice(bounds[i], bounds[i + 1]), bounds[i]!, extra)
  const all = [...new Set([...bounds, ...extra])].sort((a, b) => a - b)

  const out: Phrase[] = []
  for (let i = 0; i + 1 < all.length; i++) {
    const a = all[i]!
    const b = all[i + 1]!
    const raw = text.slice(a, b)
    const t = raw.trim()
    if (!t) continue
    const base = a + (raw.length - raw.trimStart().length)
    const sec = pauses.find(p => p.offset > a - 1 && p.offset <= b && text.slice(p.offset, b).trim() === '')?.sec
    const emph = (marks.emphasis ?? [])
      .map(r => [Math.max(r.start, base) - base, Math.min(r.end, base + t.length) - base] as [number, number])
      .filter(([x, y]) => y > x)
    const note = (marks.notes ?? []).filter(n => n.start >= a && n.start < b).map(n => n.text).join(' · ')
    out.push({
      text: t,
      words: Math.max(1, countWords(t)),
      ...(sec ? { pause: sec } : {}),
      ...(emph.length ? { emph } : {}),
      ...(note ? { note } : {}),
    })
  }
  return out
}

/** A phrase cut into plain and emphasised pieces, in order. */
export function emphasisPieces(text: string, ranges: [number, number][] = []): { text: string, emph: boolean }[] {
  if (!ranges.length) return [{ text, emph: false }]
  const out: { text: string, emph: boolean }[] = []
  let at = 0
  for (const [x, y] of [...ranges].sort((p, q) => p[0] - q[0])) {
    if (x > at) out.push({ text: text.slice(at, x), emph: false })
    if (y > Math.max(x, at)) out.push({ text: text.slice(Math.max(x, at), y), emph: true })
    at = Math.max(at, y)
  }
  if (at < text.length) out.push({ text: text.slice(at), emph: false })
  return out
}
