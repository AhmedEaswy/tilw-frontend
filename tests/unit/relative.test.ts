import { describe, expect, it } from 'vitest'
import { relativeTime } from '~/utils/relative'

const now = Date.parse('2026-11-22T12:00:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()
const DAY = 86_400_000

describe('relativeTime', () => {
  it('speaks in days, hours and minutes, in English', () => {
    expect(relativeTime(ago(3 * DAY), 'en', now)).toBe('3 days ago')
    expect(relativeTime(ago(DAY), 'en', now)).toBe('yesterday')
    expect(relativeTime(ago(5 * 3_600_000), 'en', now)).toBe('5 hours ago')
    expect(relativeTime(ago(10 * 60_000), 'en', now)).toBe('10 minutes ago')
  })

  it('looks ahead too (an invitation that expires)', () => {
    expect(relativeTime(new Date(now + 4 * DAY).toISOString(), 'en', now)).toBe('in 4 days')
  })

  it('uses Latin digits in Arabic, as the designs do', () => {
    const text = relativeTime(ago(3 * DAY), 'ar', now)
    expect(text).toMatch(/3/)
    expect(text).not.toMatch(/[٠-٩]/)
  })
})
