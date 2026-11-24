import { describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { actionAvailability, actionKey, confirmsEmail, dayToIso, money, readQuery, toQuery } from '~/utils/admin'
import type { AdminUserDetail, Page } from '~/services/types'

// Feature 006: pure helpers and the paged list.

vi.stubGlobal('ref', ref)

const person = (p: Partial<AdminUserDetail>) => ({ id: 'u1', isAdmin: false, status: 'active' as const, suspension: null, deletionDueAt: null, ...p })

describe('actionAvailability', () => {
  it('own account: suspend, reset, delete and stop-admin are disabled with "self"', () => {
    const a = actionAvailability(person({ id: 'me', isAdmin: true }), 'me')
    expect(a.suspend).toEqual({ shown: true, enabled: false, why: 'self' })
    expect(a.reset.why).toBe('self')
    expect(a.scheduleDeletion.why).toBe('self')
    expect(a.revokeAdmin).toEqual({ shown: true, enabled: false, why: 'self' })
    expect(a.makeAdmin.shown).toBe(false)
    expect(a.changePlan.enabled).toBe(true)
  })
  it('another admin: remove the flag first', () => {
    const a = actionAvailability(person({ isAdmin: true }), 'me')
    expect(a.suspend.why).toBe('isAdmin')
    expect(a.scheduleDeletion.why).toBe('isAdmin')
    expect(a.revokeAdmin.enabled).toBe(true)
  })
  it('suspended or leaving: unsuspend / cancel shown, not admin-able', () => {
    const s = actionAvailability(person({ status: 'suspended', suspension: { at: 'x', reason: 'r', byId: null, byEmail: null } }), 'me')
    expect(s.suspend.shown).toBe(false)
    expect(s.unsuspend.shown).toBe(true)
    expect(s.makeAdmin).toEqual({ shown: true, enabled: false, why: 'notActive' })
    const d = actionAvailability(person({ status: 'deletion_scheduled', deletionDueAt: 'x' }), 'me')
    expect(d.scheduleDeletion.shown).toBe(false)
    expect(d.cancelDeletion.shown).toBe(true)
  })
})

describe('helpers', () => {
  it('typed confirmation ignores case and spaces only', () => {
    expect(confirmsEmail('  Omar.H@Example.com ', 'omar.h@example.com')).toBe(true)
    expect(confirmsEmail('omar.h@example.co', 'omar.h@example.com')).toBe(false)
  })
  it('money in dollars with Latin digits', () => {
    expect(money(118400)).toBe('$1,184')
    expect(money(41250)).toBe('$412.50')
    expect(money(-800)).toBe('−$8')
  })
  it('date inputs to UTC bounds (end is exclusive)', () => {
    expect(dayToIso('2026-11-01')).toBe('2026-11-01T00:00:00.000Z')
    expect(dayToIso('2026-11-24', true)).toBe('2026-11-25T00:00:00.000Z')
    expect(dayToIso('nope')).toBeUndefined()
  })
  it('address filters keep only known keys and values', () => {
    expect(readQuery({ status: 'suspended', x: '1', plan: ['pro'] }, ['status', 'plan'] as const, { status: ['active', 'suspended'] })).toEqual({ status: 'suspended', plan: 'pro' })
    expect(readQuery({ status: 'weird' }, ['status'] as const, { status: ['active'] })).toEqual({})
    expect(toQuery({ a: 'x', b: undefined, c: '', d: 0 })).toEqual({ a: 'x', d: '0' })
  })
  it('audit action names become i18n keys', () => {
    expect(actionKey('settings.ai_key_set')).toBe('settings_ai_key_set')
  })
})

describe('usePagedList', async () => {
  const { usePagedList } = await import('~/composables/usePagedList')
  const page = <T>(items: T[], next: string | null): Page<T> => ({ items, nextCursor: next })

  it('loads more until the last page, then stops', async () => {
    const fetch = vi.fn(async (c: string | null) => (c ? page([3, 4], null) : page([1, 2], 'c2')))
    const l = usePagedList(fetch)
    await l.reload()
    expect(l.items.value).toEqual([1, 2])
    expect(l.done.value).toBe(false)
    await l.more()
    expect(l.items.value).toEqual([1, 2, 3, 4])
    expect(l.done.value).toBe(true)
    await l.more()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('drops an answer that arrives after a newer reload (fast filter changes)', async () => {
    let release!: (v: Page<string>) => void
    const slow = new Promise<Page<string>>(r => (release = r))
    const answers: Promise<Page<string>>[] = [slow, Promise.resolve(page(['new'], null))]
    const l = usePagedList(() => answers.shift()!)
    const first = l.reload()
    await l.reload()
    release(page(['old'], null))
    await first
    expect((l.items as Ref<string[]>).value).toEqual(['new'])
  })

  it('keeps the error for Retry and clears it on success', async () => {
    let fail = true
    const l = usePagedList(async () => {
      if (fail) throw new Error('down')
      return page(['x'], null)
    })
    await l.reload()
    expect(l.error.value).toBeTruthy()
    fail = false
    await l.reload()
    expect(l.error.value).toBeNull()
    expect(l.loaded.value).toBe(true)
  })
})

describe('usePagedList onPage (review: payments totals)', async () => {
  const { usePagedList } = await import('~/composables/usePagedList')
  it('runs only for the answer that is kept, so totals never belong to an older filter', async () => {
    let release!: (v: Page<number> & { total: number }) => void
    const slow = new Promise<Page<number> & { total: number }>(r => (release = r))
    const answers = [slow, Promise.resolve({ items: [2], nextCursor: null, total: 2 })]
    const seen: number[] = []
    const l = usePagedList(() => answers.shift()!, (p, first) => first && seen.push(p.total))
    const old = l.reload()
    await l.reload()
    release({ items: [1], nextCursor: null, total: 1 })
    await old
    expect(seen).toEqual([2])
  })
})

describe('admin strings (review: split out of the studio locales)', async () => {
  const fs = await import('node:fs')
  const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'))
  const keys = (o: unknown, pre = ''): string[] => (o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, `${pre}${k}.`)) : [pre.slice(0, -1)])
  it('live in i18n/admin only, with the same keys in Arabic and English', () => {
    for (const l of ['ar', 'en']) expect(read(`i18n/locales/${l}.json`).admin).toBeUndefined()
    expect(keys(read('i18n/admin/ar.json')).sort()).toEqual(keys(read('i18n/admin/en.json')).sort())
  })
  it('are merged into both languages', async () => {
    vi.doMock('~~/i18n/admin/ar.json', () => ({ default: read('i18n/admin/ar.json') }))
    vi.doMock('~~/i18n/admin/en.json', () => ({ default: read('i18n/admin/en.json') }))
    const { loadAdminMessages } = await import('~/utils/adminMessages')
    const merged: Record<string, Record<string, unknown>> = {}
    await loadAdminMessages({ mergeLocaleMessage: (l, m) => (merged[l] = m) })
    expect(Object.keys(merged).sort()).toEqual(['ar', 'en'])
    expect((merged.ar!.admin as { title: string }).title).toBe('لوحة الإدارة')
  })
})
