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

export function splitPhrases(text: string, pauses: PauseAt[] = []): Phrase[] {
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
    const t = text.slice(a, b).trim()
    if (!t) continue
    const sec = pauses.find(p => p.offset > a - 1 && p.offset <= b && text.slice(p.offset, b).trim() === '')?.sec
    out.push({ text: t, words: Math.max(1, countWords(t)), ...(sec ? { pause: sec } : {}) })
  }
  return out
}
