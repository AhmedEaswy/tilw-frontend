import { describe, expect, it } from 'vitest'
import type { DeliveryMark } from '~/services/types'
import { cleanMarks, diffEdit, findAll, paragraphAt, paragraphRanges, shiftMarks } from '~/utils/marks'

const em = (start: number, end: number): DeliveryMark => ({ id: `e${start}`, type: 'emphasis', start, end })
const pause = (at: number): DeliveryMark => ({ id: `p${at}`, type: 'pause', start: at, end: at, pauseSec: 2 })

describe('diffEdit', () => {
  it('finds a single insertion, deletion and replacement', () => {
    expect(diffEdit('abcd', 'abXcd')).toEqual({ at: 2, removed: 0, inserted: 1 })
    expect(diffEdit('abcd', 'ad')).toEqual({ at: 1, removed: 2, inserted: 0 })
    expect(diffEdit('abcd', 'aXYd')).toEqual({ at: 1, removed: 2, inserted: 2 })
    expect(diffEdit('same', 'same')).toBeNull()
  })
})

describe('shiftMarks', () => {
  //            0123456789
  const text = 'كل حكاية تبدأ'
  it('moves marks after an insertion before them', () => {
    const e = diffEdit(text, `X${text}`)
    expect(shiftMarks([em(3, 8)], e)).toEqual([em(4, 9)].map(m => ({ ...m, id: 'e3' })))
  })
  it('grows emphasis when typing inside it, not when typing right after it', () => {
    expect(shiftMarks([em(3, 8)], { at: 5, removed: 0, inserted: 2 })[0]).toMatchObject({ start: 3, end: 10 })
    expect(shiftMarks([em(3, 8)], { at: 8, removed: 0, inserted: 2 })[0]).toMatchObject({ start: 3, end: 8 })
  })
  it('drops emphasis whose text was deleted and clips partial overlaps', () => {
    expect(shiftMarks([em(3, 8)], { at: 2, removed: 7, inserted: 0 })).toEqual([])
    expect(shiftMarks([em(3, 8)], { at: 6, removed: 4, inserted: 0 })[0]).toMatchObject({ start: 3, end: 6 })
  })
  it('keeps pauses with the following text and removes pauses inside deleted text', () => {
    expect(shiftMarks([pause(9)], { at: 0, removed: 0, inserted: 3 })[0]).toMatchObject({ start: 12, end: 12 })
    expect(shiftMarks([pause(9)], { at: 5, removed: 6, inserted: 0 })).toEqual([])
    expect(shiftMarks([pause(9)], { at: 9, removed: 0, inserted: 1 })[0]).toMatchObject({ start: 9 })
  })
})

describe('paragraphs and search', () => {
  const body = 'أول فقرة\n\nالثانية\nسطر ثان\n\n\nالثالثة'
  it('returns paragraph ranges matching blank-line splits', () => {
    const r = paragraphRanges(body)
    expect(r.map(x => body.slice(x.start, x.end))).toEqual(['أول فقرة', 'الثانية\nسطر ثان', 'الثالثة'])
    expect(paragraphAt(body, 0)).toBe(0)
    expect(paragraphAt(body, body.indexOf('سطر'))).toBe(1)
    expect(paragraphAt(body, body.length)).toBe(2)
  })
  it('finds all matches case-insensitively', () => {
    expect(findAll('Tilw tilw TILW', 'tilw')).toHaveLength(3)
    expect(findAll('abc', '  ')).toEqual([])
  })
  it('cleans marks to the body length', () => {
    expect(cleanMarks([em(2, 50), em(40, 60), pause(99)], 10)).toEqual([em(2, 10), { ...pause(99), start: 10, end: 10 }])
  })
})
