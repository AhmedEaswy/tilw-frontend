import { describe, expect, it } from 'vitest'
import { flatOptions, fromIsoDate, groupOptions, presetRange, stepEnabled, toIsoDate, typeAhead, type UiOption } from '~/utils/uiControls'

const opts: UiOption[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana', disabled: true },
  { value: 'c', label: 'Blueberry' },
  { value: 'd', label: 'Cherry' },
  { value: 'e', label: 'Bread' },
]

describe('form-control helpers', () => {
  it('groups options in first-appearance order, ungrouped first, with flat indexes', () => {
    const g = groupOptions([
      { value: 1, label: 'x', group: 'G2' },
      { value: 2, label: 'y' },
      { value: 3, label: 'z', group: 'G1' },
      { value: 4, label: 'w', group: 'G2' },
    ])
    expect(g.map(x => x.label)).toEqual(['', 'G2', 'G1'])
    expect(g.flatMap(x => x.options.map(o => [o.option.value, o.index]))).toEqual([[2, 0], [1, 1], [4, 2], [3, 3]])
    expect(flatOptions([{ value: 1, label: 'x', group: 'G' }, { value: 2, label: 'y' }]).map(o => o.value)).toEqual([2, 1])
  })

  it('steps over disabled options and clamps at the ends', () => {
    expect(stepEnabled(opts, 0, 1)).toBe(2)
    expect(stepEnabled(opts, 2, -1)).toBe(0)
    expect(stepEnabled(opts, 4, 1)).toBe(4)
    expect(stepEnabled(opts, 0, -1)).toBe(0)
    expect(stepEnabled(opts, 0, 10)).toBe(4)
    expect(stepEnabled(opts, -1, 1)).toBe(0)
  })

  it('type-ahead matches prefixes, skips disabled and cycles on a repeated letter', () => {
    expect(typeAhead(opts, 'b', 0)).toBe(2) // Banana is disabled
    expect(typeAhead(opts, 'bb', 2)).toBe(4)
    expect(typeAhead(opts, 'bbb', 4)).toBe(2)
    expect(typeAhead(opts, 'br', 2)).toBe(4)
    expect(typeAhead(opts, 'ch', 0)).toBe(3)
    expect(typeAhead(opts, 'zz', 0)).toBe(-1)
  })

  it('converts ISO days in local time and rejects bad ones', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(fromIsoDate('2026-02-28')?.getDate()).toBe(28)
    expect(fromIsoDate('2026-02-30')).toBeNull()
    expect(fromIsoDate('26-1-1')).toBeNull()
  })

  it('builds clamped presets ending today', () => {
    const today = new Date(2026, 10, 25)
    expect(presetRange('last7', today)).toEqual({ from: '2026-11-19', to: '2026-11-25' })
    expect(presetRange('last30', today)).toEqual({ from: '2026-10-27', to: '2026-11-25' })
    expect(presetRange('last90', today)).toEqual({ from: '2026-08-28', to: '2026-11-25' })
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-11-01', to: '2026-11-25' })
    expect(presetRange('last30', today, '2026-11-10')).toEqual({ from: '2026-11-10', to: '2026-11-25' })
    expect(presetRange('last7', today, null, '2026-11-01')).toBeNull()
  })
})
