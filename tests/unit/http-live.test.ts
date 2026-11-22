/**
 * Runs the HTTP adapter against a real Laravel backend (skipped unless TILW_API_URL is set).
 *
 *   TILW_API_URL=http://localhost:8000 TILW_ADMIN_EMAIL=admin@tilw.com TILW_ADMIN_PASSWORD=... npm run test:live
 *
 * The backend must be running with a seeded admin (php artisan migrate --seed). It leaves no data behind except
 * waitlist rows. Node has no cookie jar, so a minimal one wraps fetch; browsers do this themselves.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { isPortError } from '~/services/types'

const url = process.env.TILW_API_URL
const email = process.env.TILW_ADMIN_EMAIL ?? 'admin@tilw.app'
const password = process.env.TILW_ADMIN_PASSWORD ?? ''

function jarFetch() {
  const jar = new Map<string, string>()
  const f = (async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (jar.size) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
    const res = await fetch(input, { ...init, headers, redirect: 'manual' })
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const i = pair!.indexOf('=')
      const name = pair!.slice(0, i).trim()
      const value = pair!.slice(i + 1).trim()
      if (/expires=Thu, 01 Jan 1970/i.test(line) || value === 'deleted') jar.delete(name)
      else jar.set(name, value)
    }
    return res
  }) as unknown as typeof fetch
  return { f, cookie: (n: string) => jar.get(n) ?? null }
}

function client() {
  const { f, cookie } = jarFetch()
  const origin = 'http://localhost:3000'
  return createHttpServices({ baseUrl: url!, fetch: f, readCookie: cookie, headers: { Origin: origin, Referer: origin + '/' } }).services
}

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}

describe.skipIf(!url || !password)('HTTP adapter against the real backend', () => {
  const s = url && password ? client() : (null as never)
  const created: string[] = []

  afterAll(async () => {
    for (const id of created) await s.scripts.remove(id).catch(() => {})
    await s.auth.signOut().catch(() => {})
  })

  it('is signed out, then signs in without revealing which part was wrong', async () => {
    expect(await s.auth.me()).toBeNull()
    expect(await code(s.auth.signIn({ email, password: 'definitely-wrong' }))).toBe('invalid_credentials')
    expect(await code(s.auth.signIn({ email: 'nobody-' + Date.now() + '@tilw.test', password: 'definitely-wrong' }))).toBe('invalid_credentials')

    const user = await s.auth.signIn({ email, password })
    expect(user.email).toBe(email)
    expect(user.isAdmin).toBe(true)
    expect((await s.auth.me())?.id).toBe(user.id)
  })

  it('creates, edits, conflicts, searches, saves position, duplicates and deletes a script', async () => {
    const a = await s.scripts.create({ title: 'الحلقة الأولى', body: 'نص التجربة\n\nالفقرة الثانية' })
    created.push(a.id)
    expect(a.version).toBe(1)

    const b = await s.scripts.update(a.id, { title: 'الحلقة الثانية' }, a.version)
    expect(b.version).toBe(2)

    const err = await s.scripts.update(a.id, { title: 'stale' }, a.version).catch(e => e)
    expect(isPortError(err, 'conflict')).toBe(true)
    expect((err.current as { title: string }).title).toBe('الحلقة الثانية')

    const c = await s.scripts.update(a.id, { marks: [{ id: 'm1', type: 'emphasis', start: 0, end: 4 }] }, b.version)
    expect(c.marks).toHaveLength(1)
    expect(await code(s.scripts.update(a.id, { marks: [{ id: 'x', type: 'emphasis', start: 0, end: 9999 }] }, c.version))).toBe('validation')

    expect(await s.scripts.search('الحلقه')).toContain(a.id)
    expect((await s.scripts.list()).find(x => x.id === a.id)).toMatchObject({ paragraphCount: 2 })

    await s.scripts.savePosition(a.id, { paragraph: 1, offset: 4 })
    const fresh = await s.scripts.get(a.id)
    expect(fresh.lastPosition).toEqual({ paragraph: 1, offset: 4 })
    expect(fresh.version).toBe(c.version)

    const d = await s.scripts.duplicate(a.id)
    created.push(d.id)
    expect(d.id).not.toBe(a.id)
    await s.scripts.remove(d.id)
    expect(await code(s.scripts.get(d.id))).toBe('not_found')
  })

  it('updates preferences and reading settings, then restores them', async () => {
    const before = await s.auth.me()
    const reading = { mode: 'manual', wpm: 150, fontSize: 'XL', mirror: true, lineWidth: 'wide', countdownSec: 10 } as const

    expect((await s.account.updatePrefs({ theme: 'dark' })).theme).toBe('dark')
    expect((await s.account.updateReading(reading)).reading).toEqual(reading)
    expect(await code(s.account.updatePrefs({ locale: 'fr' as never }))).toBe('validation')

    await s.account.updatePrefs({ theme: before!.theme, locale: before!.locale, name: before!.name })
    await s.account.updateReading(before!.reading)
  })

  it('exports the account as a JSON file and refuses a wrong password', async () => {
    expect(await code(s.account.exportData({ password: 'wrong-password-123' }))).toBe('invalid_credentials')
    const blob = await s.account.exportData({ password })
    const data = JSON.parse(await blob.text())
    expect(data.version).toBe(1)
    expect(data.user.email).toBe(email)
  })

  it('joins the waitlist (twice, same answer) and rejects a malformed email', async () => {
    const e = `adapter-${Date.now()}@tilw.test`
    await s.waitlist.join({ email: e })
    await s.waitlist.join({ email: e.toUpperCase() })
    const err = await s.waitlist.join({ email: 'nope' }).catch(x => x)
    expect(isPortError(err, 'validation')).toBe(true)
    expect(err.fields).toHaveProperty('email')
  })

  it('answers unknown tokens with token_invalid and a reset request always succeeds', async () => {
    expect(await code(s.auth.checkResetToken('nope'))).toBe('token_invalid')
    expect(await code(s.auth.checkInvite('nope'))).toBe('token_invalid')
    expect(await code(s.auth.requestPasswordReset({ email: 'ghost-' + Date.now() + '@tilw.test' }))).toBe('ok')
  })

  it('runs the admin cycle: waitlist, invite, resend, withdraw, invite again', async () => {
    const e = `admin-cycle-${Date.now()}@tilw.test`
    await s.waitlist.join({ email: e })
    const entry = (await s.admin.waitlist()).find(w => w.email === e)
    expect(entry).toMatchObject({ invited: false })

    const inv = await s.admin.invite({ email: e })
    expect(inv).toMatchObject({ email: e, state: 'pending' })
    expect((await s.admin.waitlist()).find(w => w.email === e)?.invited).toBe(true)
    expect(await code(s.admin.invite({ email: e }))).toBe('conflict')

    expect((await s.admin.resend(inv.id)).state).toBe('pending')
    await s.admin.withdraw(inv.id)
    expect((await s.admin.invitations()).find(i => i.id === inv.id)?.state).toBe('withdrawn')
    expect(await code(s.admin.withdraw(inv.id))).toBe('conflict')

    const again = await s.admin.invite({ email: e })
    expect(again.state).toBe('pending')
    await s.admin.withdraw(again.id)
  })

  it('signs out, after which the library is not available', async () => {
    await s.auth.signOut()
    expect(await s.auth.me()).toBeNull()
    expect(await code(s.scripts.list())).toBe('unauthenticated')
    expect(await code(s.admin.waitlist())).toBe('unauthenticated')
  })
})
