import { describe, expect, it } from 'vitest'
import { countWords, detectDirection, estimateMinutes, isEmail, splitParagraphs, titleFromFileName } from '~/utils/text'
import { formatDuration } from '~/utils/mime'

describe('text utils', () => {
  it('splits paragraphs on blank lines and normalises line endings', () => {
    expect(splitParagraphs('أ\r\n\r\nب\n\n\n ج \n')).toEqual(['أ', 'ب', 'ج'])
    expect(splitParagraphs('   ')).toEqual([])
  })

  it('counts Arabic and English words', () => {
    expect(countWords('كل حكاية تبدأ بسؤال صغير.')).toBe(5)
    expect(countWords("Your words, your pace — it's 2026")).toBe(6)
    expect(countWords('')).toBe(0)
  })

  it('estimates whole minutes, at least 1 for non-empty text', () => {
    expect(estimateMinutes(0, 120)).toBe(0)
    expect(estimateMinutes(30, 120)).toBe(1)
    expect(estimateMinutes(360, 120)).toBe(3)
  })

  it('detects direction from the first strong character', () => {
    expect(detectDirection('  123 كل حكاية')).toBe('rtl')
    expect(detectDirection('Hello مرحبا')).toBe('ltr')
  })

  it('derives a title from a file name', () => {
    expect(titleFromFileName('episode_04-opening.txt')).toBe('episode 04 opening')
  })

  it('validates emails', () => {
    expect(isEmail('name@example.com')).toBe(true)
    expect(isEmail('name@example')).toBe(false)
  })

  it('formats durations as mm:ss', () => {
    expect(formatDuration(42_000)).toBe('00:42')
    expect(formatDuration(136_000)).toBe('02:16')
  })
})

describe('foldForSearch', () => {
  it('ignores diacritics, hamza forms, teh marbuta and case', async () => {
    const { foldForSearch } = await import('~/utils/text')
    expect(foldForSearch('افتتاحيّة الحلقة')).toBe(foldForSearch('افتتاحيه الحلقه'))
    expect(foldForSearch('أوّل')).toBe('اول')
    expect(foldForSearch('Episode ONE')).toBe('episode one')
  })
})
