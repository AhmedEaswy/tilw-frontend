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
  stepWithPauses,
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

  it('maps progress to the top of the block being read, stepping from block to block', () => {
    // tl words: [10, 20, 30] — here the three blocks sit at 0, 100 and 300.
    const layout = { tops: [0, 100, 300], heights: [80, 160, 240], lineH: 40 }
    expect(progressToY(tl, layout, 0)).toBe(0)
    expect(progressToY(tl, layout, 9.9)).toBe(0) // holds for the whole block
    expect(progressToY(tl, layout, 10)).toBe(100) // one move to the next block
    expect(progressToY(tl, layout, 29.9)).toBe(100)
    expect(progressToY(tl, layout, 30)).toBe(300)
    expect(progressToY(tl, layout, 60)).toBe(300)
    expect(progressToY(tl, { tops: [0], heights: [1], lineH: 1 }, 5)).toBe(0) // layout not measured yet
  })

  it('lands on a pause mark instead of passing it, then carries on after the hold', () => {
    const pauses = [{ at: 10, sec: 2 }]
    // 9 words in, 1 s at 120 wpm is 2 words: the step stops on the mark at word 10.
    const a = stepWithPauses(tl, 9, 1000, 120, pauses)
    expect(a).toEqual({ progress: 10, hold: pauses[0] })
    // Starting on the mark does not hold again.
    const b = stepWithPauses(tl, 10, 1000, 120, pauses)
    expect(b.hold).toBeNull()
    expect(b.progress).toBeCloseTo(12, 5)
    // A pause at the very end of the script is ignored.
    expect(stepWithPauses(tl, 59, 60_000, 220, [{ at: 60, sec: 3 }]).hold).toBeNull()
    expect(stepWithPauses(tl, 5, 100, 120).hold).toBeNull()
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
