import { describe, expect, it } from 'vitest'
import { buildCues, CAPTION_RULES, toSrt, toVtt, wrapCaption } from '~/services/ai/captions'
import { fakeSpeech } from '~/services/ai/speech'
import type { CaptionCue, SpeechWord } from '~/services/types'

// Feature 005 (T025): captions follow backend device-flows §2 (SC-005).

const spread = (text: string, start = 0, step = 0.4): SpeechWord[] =>
  text.split(' ').map((w, i) => ({ word: w, start: +(start + i * step).toFixed(2), end: +(start + i * step + 0.3).toFixed(2) }))

function checkRules(cues: CaptionCue[]) {
  cues.forEach((c, i) => {
    expect(c.lines.length).toBeLessThanOrEqual(2)
    for (const l of c.lines) if (l.includes(' ')) expect(l.length).toBeLessThanOrEqual(CAPTION_RULES.maxChars)
    expect(c.end - c.start).toBeLessThanOrEqual(CAPTION_RULES.maxSeconds + 1e-9)
    const next = cues[i + 1]
    if (next) expect(c.end).toBeLessThanOrEqual(next.start + 1e-9)
  })
}

describe('captions', () => {
  it('balances lines at the space nearest the middle', () => {
    expect(wrapCaption('short line')).toEqual(['short line'])
    const lines = wrapCaption('one two three four five six seven eight nine ten eleven')!
    expect(lines).toHaveLength(2)
    expect(Math.abs(lines[0]!.length - lines[1]!.length)).toBeLessThan(8)
    expect(wrapCaption('x'.repeat(60))).toEqual(['x'.repeat(60)])
    expect(wrapCaption(`${'a '.repeat(50)}`.trim())).toBeNull()
  })

  it('splits on length, 7 s, gaps over 1 s and utterances, and never overlaps (English)', () => {
    const words = [
      ...spread('Every story starts with a small question that we ask ourselves before we turn the camera on and start'),
      ...spread('again', 12),
      ...spread('after the pause', 13),
    ]
    const cues = buildCues(words, { utteranceBreaks: [words.length - 3] })
    checkRules(cues)
    expect(cues.map(c => c.lines.join(' ')).join(' ')).toBe(words.map(w => w.word).join(' '))
    expect(cues.some(c => c.lines.join(' ') === 'again')).toBe(true) // the 1 s gap and the utterance break
  })

  it('keeps Arabic as is and stretches short cues to 1 s without overlapping the next', () => {
    const words: SpeechWord[] = [
      { word: 'مرحباً', start: 0, end: 0.3 },
      { word: 'بكم.', start: 2, end: 2.2 },
      { word: 'نبدأ', start: 2.5, end: 2.8 },
    ]
    const cues = buildCues(words, { audioEnd: 2.9 })
    expect(cues[0]).toEqual({ start: 0, end: 1, lines: ['مرحباً'] })
    expect(cues[1]!.lines).toEqual(['بكم. نبدأ'])
    expect(cues[1]!.end).toBeCloseTo(2.9)
    checkRules(cues)
  })

  it('gives a word longer than 42 characters its own line', () => {
    const long = 'x'.repeat(50)
    const cues = buildCues([{ word: 'a', start: 0, end: 0.3 }, { word: long, start: 0.4, end: 0.8 }, { word: 'b', start: 0.9, end: 1.2 }])
    expect(cues.map(c => c.lines)).toEqual([['a'], [long], ['b']])
  })

  it('follows the rules on a long fake transcript in both languages', () => {
    for (const language of ['ar', 'en'] as const) {
      const r = fakeSpeech(185, { language, purpose: 'captions' })
      const cues = buildCues(r.words, { utteranceBreaks: r.utteranceBreaks, audioEnd: 185 })
      expect(cues.length).toBeGreaterThan(10)
      checkRules(cues)
    }
  })

  it('writes SRT and VTT', () => {
    const cues: CaptionCue[] = [{ start: 0.5, end: 2, lines: ['Hello', 'there'] }, { start: 3661.25, end: 3663, lines: ['مرحباً'] }]
    expect(toSrt(cues)).toBe('1\n00:00:00,500 --> 00:00:02,000\nHello\nthere\n\n2\n01:01:01,250 --> 01:01:03,000\nمرحباً\n')
    expect(toVtt(cues)).toBe('WEBVTT\n\n00:00:00.500 --> 00:00:02.000\nHello\nthere\n\n01:01:01.250 --> 01:01:03.000\nمرحباً\n')
  })
})
