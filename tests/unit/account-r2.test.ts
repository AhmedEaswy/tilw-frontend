import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'

// US6 (T053): email change, devices, 14-day deletion and the deletion-cancelled notice.

const noSleep = () => Promise.resolve()
async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}

describe('account in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })
  const linkToken = () => new URL(m.db.s.outbox.find(x => x.kind === 'email')!.link!).searchParams.get('token')!

  it('keeps an email change pending until the link is opened; sign-in uses the old email meanwhile', async () => {
    expect(await code(m.services.account.requestEmailChange({ email: 'new@example.com', password: 'wrong' }))).toBe('invalid_credentials')
    expect(await code(m.services.account.requestEmailChange({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('validation')
    const p = await m.services.account.requestEmailChange({ email: ' New@Example.com ', password: SEED_PASSWORD })
    expect(p.email).toBe('new@example.com')
    expect(await m.services.account.pendingEmailChange()).toMatchObject({ email: 'new@example.com' })
    expect((await m.services.auth.me())?.email).toBe('layan@example.com')

    const first = linkToken()
    await m.services.account.resendEmailChange()
    expect(await code(m.services.auth.confirmEmail(first))).toBe('token_invalid') // the old link stops working
    expect(await m.services.auth.confirmEmail(linkToken())).toEqual({ email: 'new@example.com' })
    expect((await m.services.auth.me())?.email).toBe('new@example.com')
    expect(await m.services.account.pendingEmailChange()).toBeNull()
  })

  it('cancels a change, and reports expired and invalid links', async () => {
    await m.services.account.requestEmailChange({ email: 'new@example.com', password: SEED_PASSWORD })
    await m.services.account.cancelEmailChange()
    expect(await m.services.account.pendingEmailChange()).toBeNull()
    expect(await code(m.services.account.resendEmailChange())).toBe('not_found')

    await m.services.account.requestEmailChange({ email: 'new@example.com', password: SEED_PASSWORD })
    m.db.setKnobs({ clockOffsetMs: 2 * 86_400_000 })
    expect(await code(m.services.auth.confirmEmail(linkToken()))).toBe('token_expired')
    expect(await code(m.services.auth.confirmEmail('nope'))).toBe('token_invalid')
  })

  it('lists this browser and phones, and signs a phone out', async () => {
    m.knobs.addPhone(userId)
    const list = await m.services.account.listDevices()
    expect(list.map(d => [d.platform, d.current])).toEqual([['web', true], ['ios', false]])
    expect(await code(m.services.account.revokeDevice('browser'))).toBe('not_found')
    await m.services.account.revokeDevice(list[1]!.id)
    expect(await m.services.account.listDevices()).toHaveLength(1)
  })

  it('schedules deletion 14 days ahead; signing in cancels it once, with a one-time notice', async () => {
    const { deletionDueAt } = await m.services.account.deleteAccount({ password: SEED_PASSWORD })
    const days = (Date.parse(deletionDueAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(13.9)
    expect(days).toBeLessThan(14.1)
    expect(await m.services.auth.me()).toBeNull()
    expect(m.services.auth.lastNotice()).toBeNull()

    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(m.services.auth.lastNotice()).toBe('deletion_cancelled')
    expect(m.services.auth.lastNotice()).toBeNull()
    await m.services.auth.signOut()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(m.services.auth.lastNotice()).toBeNull()
  })
})

describe('account over HTTP', () => {
  function setup(reply: (url: string) => { status?: number; json?: unknown }) {
    const calls: { method: string; url: string; body?: unknown }[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? 'GET', url: String(url), body: init.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204, headers: { 'X-CSRF-TOKEN': 't' } })
      const r = reply(String(url))
      return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? null), { status: r.status ?? 200 })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => null })
    return { services, calls: () => calls.filter(c => !c.url.endsWith('csrf-cookie')) }
  }

  it('reads the deletion_cancelled notice from the sign-in response and keeps the profile clean', async () => {
    const { services } = setup(() => ({ json: { id: 'u1', email: 'a@b.co', notice: 'deletion_cancelled' } }))
    const u = await services.auth.signIn({ email: 'a@b.co', password: 'x' })
    expect(u).toEqual({ id: 'u1', email: 'a@b.co' })
    expect(services.auth.lastNotice()).toBe('deletion_cancelled')
    expect(services.auth.lastNotice()).toBeNull()
  })

  it('maps the email, devices and deletion routes', async () => {
    const { services, calls } = setup(url => (url.includes('/devices/') || url.endsWith('/api/user/email') ? { status: 204 } : { json: { deletionDueAt: '2026-12-07T00:00:00Z' } }))
    await services.account.requestEmailChange({ email: 'n@b.co', password: 'p' })
    await services.account.cancelEmailChange()
    await services.account.revokeDevice('tok 1')
    expect((await services.account.deleteAccount({ password: 'p' })).deletionDueAt).toBe('2026-12-07T00:00:00Z')
    await services.auth.confirmEmail('abc')
    expect(calls().map(c => `${c.method} ${c.url}`)).toEqual([
      'POST http://api.test/api/user/email',
      'DELETE http://api.test/api/user/email',
      'DELETE http://api.test/api/user/devices/tok%201',
      'DELETE http://api.test/api/user',
      'POST http://api.test/email/confirm',
    ])
    expect(calls().at(-1)!.body).toEqual({ token: 'abc' })
  })
})
