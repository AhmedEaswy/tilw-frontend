import { describe, expect, it } from 'vitest'
import { splitPhrases } from '../../app/utils/phrases'

describe('splitPhrases', () => {
  it('breaks after a sentence and keeps a sentence whole', () => {
    const p = splitPhrases('ماذا أريد أن يبقى معكم؟ لم أبحث عن جواب كامل، بل عن جملة. تمام.')
    expect(p.map(x => x.text)).toEqual(['ماذا أريد أن يبقى معكم؟', 'لم أبحث عن جواب كامل، بل عن جملة.', 'تمام.'])
  })

  it('breaks at a line the author typed', () => {
    expect(splitPhrases('one two\nthree four').map(x => x.text)).toEqual(['one two', 'three four'])
  })

  it('puts a pause mark on the phrase it follows', () => {
    const p = splitPhrases('Hello there my friend and welcome', [{ offset: 11, sec: 2 }])
    expect(p.map(x => x.text)).toEqual(['Hello there', 'my friend and welcome'])
    expect(p[0]!.pause).toBe(2)
    expect(p[1]!.pause).toBeUndefined()
  })

  it('splits a very long sentence once, at the comma nearest its middle', () => {
    const t = 'one two three four five six seven, eight nine ten eleven twelve thirteen fourteen fifteen sixteen'
    expect(splitPhrases(t).map(x => x.text)).toEqual(['one two three four five six seven,', 'eight nine ten eleven twelve thirteen fourteen fifteen sixteen'])
  })

  it('counts words per phrase', () => {
    expect(splitPhrases('a b c. d e.').map(x => x.words)).toEqual([3, 2])
  })
})
