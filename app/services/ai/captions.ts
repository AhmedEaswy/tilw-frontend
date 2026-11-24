/**
 * Feature 005 (US5): caption cues built in the browser from the speech provider's word timings, following backend
 * device-flows §2. The service never sees the text, so it can't build them. Pure, unit-tested.
 *
 * 1. Walk the words; start a new cue when the next word would need more than 2 lines of 42 characters, make the
 *    cue longer than 7 s, cross a gap of more than 1 s, or cross an utterance boundary.
 * 2. A cue lasts at least 1 s, extended up to the next cue's start (or the audio's end), never overlapping.
 * 3. Lines are balanced at the space nearest the middle that keeps both ≤ 42; a longer single word stands alone.
 * 4. SRT and VTT. Arabic text is kept as is (no reshaping, no RLM marks).
 */
import type { CaptionCue, SpeechWord } from '../types'

export const CAPTION_RULES = { maxChars: 42, maxLines: 2, maxSeconds: 7, minSeconds: 1, maxGap: 1 } as const

/** One or two balanced lines, or null when the text needs more than two lines. A text without spaces is one line. */
export function wrapCaption(text: string, maxChars: number = CAPTION_RULES.maxChars): string[] | null {
  if (text.length <= maxChars || !text.includes(' ')) return [text]
  const mid = text.length / 2
  let best = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue
    if (i > maxChars || text.length - i - 1 > maxChars) continue
    if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i
  }
  return best < 0 ? null : [text.slice(0, best), text.slice(best + 1)]
}

export function buildCues(words: SpeechWord[], opts: { utteranceBreaks?: number[]; audioEnd?: number | null } = {}): CaptionCue[] {
  const R = CAPTION_RULES
  const breaks = new Set(opts.utteranceBreaks ?? [])
  const raw: { texts: string[]; start: number; end: number }[] = []
  let cur: { texts: string[]; start: number; end: number } | null = null
  words.forEach((w, i) => {
    if (cur) {
      const text = [...cur.texts, w.word].join(' ')
      const lines = wrapCaption(text)
      const fits = !!lines && lines.length <= R.maxLines && lines.every(l => l.length <= R.maxChars)
      if (breaks.has(i) || w.start - cur.end > R.maxGap || w.end - cur.start > R.maxSeconds || !fits) {
        raw.push(cur)
        cur = null
      }
    }
    if (!cur) cur = { texts: [w.word], start: w.start, end: w.end }
    else {
      cur.texts.push(w.word)
      cur.end = w.end
    }
  })
  if (cur) raw.push(cur)

  return raw.map((c, i) => {
    let end = c.end
    if (end - c.start < R.minSeconds) {
      const next = raw[i + 1]
      const limit = next ? next.start : (opts.audioEnd ?? c.start + R.minSeconds)
      end = Math.max(end, Math.min(c.start + R.minSeconds, limit))
    }
    const text = c.texts.join(' ')
    return { start: c.start, end, lines: wrapCaption(text) ?? [text] }
  })
}

function stamp(seconds: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const r = ms % 1000
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`
}

export function toSrt(cues: CaptionCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.lines.join('\n')}\n`).join('\n')
}

export function toVtt(cues: CaptionCue[]): string {
  return `WEBVTT\n\n${cues.map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.lines.join('\n')}\n`).join('\n')}`
}
