import { describe, expect, it } from 'vitest'
import { parseRange, rangeDays } from '~/composables/useAdminPeriod'
import { query } from '~/services/http/admin'

// Custom report periods (backend AdminPeriod): whole UTC days, from ≤ to ≤ today, at most 366 days.
describe('admin custom period', () => {
  const today = '2026-11-25'

  it('accepts a valid range and counts its days inclusively', () => {
    expect(parseRange('2026-11-01', '2026-11-03', today)).toEqual({ from: '2026-11-01', to: '2026-11-03' })
    expect(rangeDays({ from: '2026-11-01', to: '2026-11-03' })).toBe(3)
    expect(rangeDays({ from: '2026-11-25', to: '2026-11-25' })).toBe(1)
    expect(parseRange('2025-11-25', '2026-11-25', today)).not.toBeNull() // 366 days
  })

  it('refuses reversed, future, too long, half or malformed ranges', () => {
    expect(parseRange('2026-11-05', '2026-11-01', today)).toBeNull()
    expect(parseRange('2026-11-01', '2026-11-26', today)).toBeNull()
    expect(parseRange('2025-11-24', '2026-11-25', today)).toBeNull() // 367 days
    expect(parseRange('2026-11-01', undefined, today)).toBeNull()
    expect(parseRange('01-11-2026', '03-11-2026', today)).toBeNull()
    expect(parseRange(['2026-11-01'], '2026-11-03', today)).toBeNull()
  })

  it('sends days or the range to the API', () => {
    expect(query({ days: 7 })).toBe('?days=7')
    expect(query({ from: '2026-11-01', to: '2026-11-03' })).toBe('?from=2026-11-01&to=2026-11-03')
  })
})
