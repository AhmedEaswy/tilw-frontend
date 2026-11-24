/** Feature 004, US5 (T049): one end-reason text for every reason, with a fallback for unknown ones. */
import { describe, expect, it } from 'vitest'
import { linkEndText } from '~/utils/link'

const t = (k: string) => `T(${k})`

describe('linkEndText', () => {
  it('maps every known reason to its own text', () => {
    for (const r of ['owner', 'remote', 'idle', 'script_deleted', 'signed_out', 'device_revoked', 'email_changed', 'account_deleted', 'limit', 'replaced', 'declined', 'lapsed', 'left']) {
      expect(linkEndText(t, r)).toBe(`T(link.ended.${r})`)
    }
  })
  it('falls back for a missing or unknown reason', () => {
    expect(linkEndText(t, null)).toBe('T(link.ended.unknown)')
    expect(linkEndText(t, 'something_new')).toBe('T(link.ended.unknown)')
  })
})
