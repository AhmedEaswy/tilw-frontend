import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { isPortError, PortError } from '~/services/types'

interface Call { method: string; url: string; headers: Record<string, string>; body: unknown }
type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> }

/** Scripted fake fetch: replies in order (or by predicate), records every call. */
function fakeApi(replies: Array<Reply | ((c: Call) => Reply)> = []) {
  const calls: Call[] = []
  const cookies: Record<string, string> = {}
  const f = (async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      url: String(url),
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    if (call.url.endsWith('/sanctum/csrf-cookie')) {
      cookies['XSRF-TOKEN'] = encodeURIComponent('tok=' + calls.length)
      return new Response(null, { status: 204 })
    }
    const next = replies.shift()
    const r = typeof next === 'function' ? next(call) : (next ?? { status: 200, json: null })
    const body = r.text ?? (r.json === undefined ? null : JSON.stringify(r.json))
    return new Response(r.status === 204 ? null : body, { status: r.status ?? 200, headers: r.headers })
  }) as unknown as typeof fetch
  return { f, calls, cookies }
}

function setup(replies: Array<Reply | ((c: Call) => Reply)> = []) {
  const api = fakeApi(replies)
  const { services } = createHttpServices({ baseUrl: 'http://api.test/', fetch: api.f, readCookie: n => api.cookies[n] ?? null })
  return { services, ...api }
}

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}

describe('requests', () => {
  it('sends cookies, JSON and the CSRF token on writes, fetching the cookie first', async () => {
    const { services, calls } = setup([{ json: { id: 'u1' } }])
    await services.auth.signIn({ email: 'a@b.co', password: 'secret-123' })

    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual(['GET http://api.test/sanctum/csrf-cookie', 'POST http://api.test/login'])
    const login = calls[1]!
    expect(login.headers['X-XSRF-TOKEN']).toBe('tok=1')
    expect(login.headers['Content-Type']).toBe('application/json')
    expect(login.body).toEqual({ email: 'a@b.co', password: 'secret-123' })
  })

  it('reuses the cookie instead of refetching it, and never sends a token on reads', async () => {
    const { services, calls } = setup([{ json: [] }, { json: { id: 's' } }, { json: { id: 's2' } }])
    await services.scripts.list()
    await services.scripts.create({ title: 'A' })
    await services.scripts.create({ title: 'B' })

    expect(calls.filter(c => c.url.endsWith('/sanctum/csrf-cookie'))).toHaveLength(1)
    expect(calls[0]!.headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('refreshes the cookie and retries once on a 419', async () => {
    const { services, calls } = setup([{ status: 419, json: { code: 'unauthenticated', message: 'CSRF token mismatch.' } }, { json: { id: 's' } }])
    const s = await services.scripts.create({ title: 'A' })

    expect(s).toEqual({ id: 's' })
    expect(calls.filter(c => c.url.endsWith('/scripts'))).toHaveLength(2)
    expect(calls.filter(c => c.url.endsWith('/sanctum/csrf-cookie'))).toHaveLength(2)
  })

  it('gives up after one retry', async () => {
    const reply = { status: 419, json: { code: 'unauthenticated', message: 'x' } }
    const { services } = setup([reply, reply])
    expect(await code(services.scripts.create({ title: 'A' }))).toBe('unauthenticated')
  })
})

describe('auth port', () => {
  it('me() is null when nobody is signed in', async () => {
    const { services } = setup([{ text: 'null' }])
    expect(await services.auth.me()).toBeNull()
  })

  it('maps tokens and invitations to the right routes', async () => {
    const { services, calls } = setup([{ json: { email: 'a@b.co' } }, { json: { id: 'u' } }, { json: { email: 'c@d.co' } }, { json: { id: 'u2' }, status: 201 }])
    expect(await services.auth.checkResetToken('t/1')).toEqual({ email: 'a@b.co' })
    await services.auth.resetPassword({ token: 't1', password: 'new-password-1' })
    await services.auth.checkInvite('inv')
    await services.auth.acceptInvite({ token: 'inv', name: 'Sara', password: 'password-1' })

    const lines = calls.filter(c => !c.url.endsWith('csrf-cookie')).map(c => `${c.method} ${c.url.replace('http://api.test', '')}`)
    expect(lines).toEqual(['GET /reset-password/t%2F1', 'POST /reset-password', 'GET /invitations/inv', 'POST /invitations/inv/accept'])
    expect(calls.at(-1)!.body).toEqual({ name: 'Sara', password: 'password-1' })
  })

  it('signOut tolerates an already-ended session', async () => {
    const { services } = setup([{ status: 401, json: { code: 'unauthenticated', message: 'Not signed in.' } }])
    expect(await code(services.auth.signOut())).toBe('ok')
  })

  it('requestPasswordReset and waitlist.join resolve on 204', async () => {
    const { services } = setup([{ status: 204 }, { status: 204 }])
    expect(await services.auth.requestPasswordReset({ email: 'a@b.co' })).toBeUndefined()
    expect(await services.waitlist.join({ email: 'a@b.co' })).toBeUndefined()
  })
})

describe('scripts port', () => {
  it('update sends If-Match with the base version and the patch as the body', async () => {
    const { services, calls } = setup([{ json: { id: 's', version: 4 } }])
    await services.scripts.update('s/1', { title: 'New' }, 3)

    const c = calls.at(-1)!
    expect(c.method).toBe('PATCH')
    expect(c.url).toBe('http://api.test/api/scripts/s%2F1')
    expect(c.headers['If-Match']).toBe('3')
    expect(c.body).toEqual({ title: 'New' })
  })

  it('a stale save rejects with conflict and carries the server copy', async () => {
    const current = { id: 's', version: 5, title: 'Server' }
    const { services } = setup([{ status: 409, json: { code: 'conflict', message: 'x', current } }])
    const err = await services.scripts.update('s', { title: 'Mine' }, 3).catch(e => e)

    expect(err).toBeInstanceOf(PortError)
    expect(err.code).toBe('conflict')
    expect(err.current).toEqual(current)
  })

  it('search url-encodes the query and returns ids', async () => {
    const { services, calls } = setup([{ json: ['a', 'b'] }])
    expect(await services.scripts.search('الحلقه & co')).toEqual(['a', 'b'])
    expect(calls[0]!.url).toBe('http://api.test/api/scripts/search?q=' + encodeURIComponent('الحلقه & co'))
  })

  it('duplicate, remove and savePosition use their routes', async () => {
    const { services, calls } = setup([{ json: { id: 'c' }, status: 201 }, { status: 204 }, { status: 204 }])
    await services.scripts.duplicate('s')
    await services.scripts.remove('s')
    await services.scripts.savePosition('s', { paragraph: 1, offset: 4 })

    const lines = calls.filter(c => !c.url.endsWith('csrf-cookie')).map(c => `${c.method} ${c.url.replace('http://api.test', '')}`)
    expect(lines).toEqual(['POST /api/scripts/s/duplicate', 'DELETE /api/scripts/s', 'PUT /api/scripts/s/position'])
    expect(calls.at(-1)!.body).toEqual({ paragraph: 1, offset: 4 })
  })
})

describe('account port', () => {
  it('uses the account routes with the documented bodies', async () => {
    const { services, calls } = setup([{ json: { id: 'u' } }, { json: { id: 'u' } }, { status: 204 }, { status: 204 }])
    await services.account.updatePrefs({ locale: 'en', theme: 'dark' })
    await services.account.updateReading({ mode: 'manual', wpm: 150, fontSize: 'XL', mirror: true, lineWidth: 'wide', countdownSec: 10 })
    await services.account.changePassword({ current: 'old-password', next: 'new-password-1' })
    await services.account.deleteAccount({ password: 'new-password-1' })

    const lines = calls.filter(c => !c.url.endsWith('csrf-cookie')).map(c => `${c.method} ${c.url.replace('http://api.test', '')}`)
    expect(lines).toEqual(['PATCH /api/user/preferences', 'PUT /api/user/reading', 'PUT /api/user/password', 'DELETE /api/user'])
    expect(calls.at(-1)!.body).toEqual({ password: 'new-password-1' })
  })

  it('exportData returns the file as a Blob', async () => {
    const { services } = setup([{ text: '{"version":1}', headers: { 'Content-Type': 'application/json' } }])
    const blob = await services.account.exportData({ password: 'x-password-1' })

    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe('{"version":1}')
  })

  it('legacy scan finds nothing against the real service', async () => {
    expect(await setup().services.legacy.scan()).toEqual([])
  })
})

describe('error mapping', () => {
  const cases: Array<[number, unknown, string, Record<string, string> | undefined]> = [
    [401, { code: 'invalid_credentials', message: 'x' }, 'invalid_credentials', undefined],
    [422, { code: 'validation', message: 'x', fields: { password: 'too short' } }, 'validation', { password: 'too short' }],
    [404, { code: 'token_invalid', message: 'x' }, 'token_invalid', undefined],
    [410, { code: 'token_expired', message: 'x' }, 'token_expired', undefined],
    [404, { code: 'not_found', message: 'x' }, 'not_found', undefined],
    [429, { code: 'rate_limited', message: 'x' }, 'rate_limited', undefined],
    [500, { code: 'unknown', message: 'x' }, 'unknown', undefined],
  ]

  it.each(cases)('status %i %j becomes %s', async (status, json, expected, fields) => {
    const { services } = setup([{ status, json }])
    const err = await services.scripts.get('s').catch(e => e)
    expect(err).toBeInstanceOf(PortError)
    expect(err.code).toBe(expected)
    expect(err.fields).toEqual(fields)
  })

  it('falls back to the status when the body is not the envelope', async () => {
    for (const [status, expected] of [[429, 'rate_limited'], [401, 'unauthenticated'], [404, 'not_found'], [502, 'unknown']] as const) {
      const { services } = setup([{ status, text: '<html>gateway</html>' }])
      expect(await code(services.scripts.get('s'))).toBe(expected)
    }
  })

  it('a request that never reaches the server is a network error', async () => {
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch, readCookie: () => 'x' })
    expect(await code(services.scripts.list())).toBe('network')
    expect(await code(services.scripts.create({ title: 'A' }))).toBe('network')
  })
})
