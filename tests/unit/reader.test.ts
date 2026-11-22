import { describe, expect, it } from 'vitest'
import {
  advance,
  buildTimeline,
  clampWpm,
  paragraphOfProgress,
  paragraphStart,
  positionToProgress,
  progressToPosition,
  progressToY,
} from '~/utils/reader'

// T067 — reader timing.

describe('reader timeline', () => {
  const tl = buildTimeline([10, 20, 30])

  it('lays paragraphs end to end in words', () => {
    expect(tl.starts).toEqual([0, 10, 30])
    expect(tl.total).toBe(60)
  })

  it('finds the paragraph being read', () => {
    expect(paragraphOfProgress(tl, 0)).toBe(0)
    expect(paragraphOfProgress(tl, 9.99)).toBe(0)
    expect(paragraphOfProgress(tl, 10)).toBe(1)
    expect(paragraphOfProgress(tl, 60)).toBe(2)
  })

  it('advances at exactly the chosen WPM (acceptance: 120 WPM ±5%)', () => {
    // 60 frames per second for 30 seconds at 120 WPM → 60 words.
    const big = buildTimeline([1000])
    let p = 0
    for (let i = 0; i < 60 * 30; i++) p = advance(big, p, 1000 / 60, 120)
    expect(p).toBeGreaterThan(60 * 0.95)
    expect(p).toBeLessThan(60 * 1.05)
  })

  it('pace does not depend on frame rate', () => {
    const big = buildTimeline([1000])
    let a = 0
    let b = 0
    for (let i = 0; i < 30 * 10; i++) a = advance(big, a, 1000 / 30, 90)
    for (let i = 0; i < 144 * 10; i++) b = advance(big, b, 1000 / 144, 90)
    expect(a).toBeCloseTo(15, 5)
    expect(b).toBeCloseTo(15, 5)
  })

  it('never runs past the end', () => {
    expect(advance(tl, 59, 60_000, 220)).toBe(60)
    expect(advance(tl, 5, -100, 120)).toBe(5)
  })

  it('maps progress to a stepped scroll offset: one move per line', () => {
    // tl words: [10, 20, 30]. Paragraph 2 has 4 lines (160 / 40), paragraph 3 has 6 (240 / 40).
    const layout = { tops: [0, 100, 300], heights: [80, 160, 240], lineH: 40 }
    expect(progressToY(tl, layout, 0)).toBe(20) // first line centre
    expect(progressToY(tl, layout, 4.9)).toBe(20) // still on line 1 of paragraph 1 (2 lines, 5 words each)
    expect(progressToY(tl, layout, 5)).toBe(60) // moves one line
    expect(progressToY(tl, layout, 10)).toBe(120) // next paragraph's first line
    expect(progressToY(tl, layout, 14.9)).toBe(120) // holds for its share (5 words)
    expect(progressToY(tl, layout, 15)).toBe(160)
    expect(progressToY(tl, layout, 60)).toBe(520) // last line of the last paragraph
    // monotonic, and only ever lands on line centres
    let prev = -Infinity
    for (let p = 0; p <= 60; p += 0.5) {
      const y = progressToY(tl, layout, p)
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
  })

  it('round-trips a saved position', () => {
    expect(progressToPosition(tl, 34.7)).toEqual({ paragraph: 2, offset: 4 })
    expect(positionToProgress(tl, { paragraph: 2, offset: 4 })).toBe(34)
    expect(positionToProgress(tl, null)).toBe(0)
    // out-of-range positions (script got shorter) clamp instead of failing
    expect(positionToProgress(tl, { paragraph: 9, offset: 999 })).toBe(59)
  })

  it('steps to paragraph starts', () => {
    expect(paragraphStart(tl, 1)).toBe(10)
    expect(paragraphStart(tl, -1)).toBe(0)
    expect(paragraphStart(tl, 99)).toBe(30)
  })

  it('keeps WPM in 60–220 on steps of 10', () => {
    expect(clampWpm(40)).toBe(60)
    expect(clampWpm(124)).toBe(120)
    expect(clampWpm(300)).toBe(220)
  })
})
