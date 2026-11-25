import { beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { DEFAULT_ADMIN_PERMISSIONS, MOCK_ADMIN_EMAIL, MOCK_ADMIN_ID } from '~/services/mock/admin'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createHttpServices } from '~/services/http'
import { DURATION_BUCKETS, isPortError, PortError } from '~/services/types'
import { levelAllows, permissionsOf } from '~/composables/useAdminPermissions'

// Feature 007 (backend specs/007-admin-insights): roles and permissions, analytics, one person's insights, admins,
// practice sessions — against the mock and the HTTP adapter.

const noSleep = () => Promise.resolve()
async function err(p: Promise<unknown>): Promise<PortError | 'ok'> {
  try {
    await p
    return 'ok'
  } catch (e) {
    if (isPortError(e)) return e
    throw e
  }
}
const code = async (p: Promise<unknown>) => {
  const e = await err(p)
  return e === 'ok' ? 'ok' : e.code
}

describe('useAdminPermissions · permissionsOf', () => {
  it('reads the role and levels from the profile', () => {
    expect(permissionsOf(null).role).toBeNull()
    expect(permissionsOf({ isAdmin: false }).permissions.users).toBe('none')
    const sup = permissionsOf({ isAdmin: true, adminRole: 'super', adminPermissions: null })
    expect(sup.role).toBe('super')
    expect(Object.values(sup.permissions).every(l => l === 'edit')).toBe(true)
    const a = permissionsOf({ isAdmin: true, adminRole: 'admin', adminPermissions: { users: 'view', money: 'edit', ai: 'none', plans: 'none', settings: 'none', audit: 'none', admins: 'none' } })
    expect(a.permissions.users).toBe('view')
    expect(a.permissions.money).toBe('edit')
    // A pre-007 profile (no permissions): the 005 behaviour, edit everywhere.
    expect(permissionsOf({ isAdmin: true }).permissions.admins).toBe('edit')
  })
  it('edit includes view', () => {
    expect(levelAllows('edit', 'view')).toBe(true)
    expect(levelAllows('view', 'view')).toBe(true)
    expect(levelAllows('view', 'edit')).toBe(false)
    expect(levelAllows('none', 'view')).toBe(false)
    expect(levelAllows(undefined, 'view')).toBe(false)
  })
})

describe('admin insights · mock', () => {
  let m: ReturnType<typeof createMockServices>
  const api = () => m.services.admin
  const signIn = (email: string) => m.services.auth.signIn({ email, password: SEED_PASSWORD })
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep })
    await signIn(MOCK_ADMIN_EMAIL)
  })

  it('the demo admin is the super admin; the profile carries role and permissions', async () => {
    const me = await m.services.auth.me()
    expect(me?.adminRole).toBe('super')
    expect(me?.adminPermissions?.admins).toBe('edit')
    const d = await api().user(MOCK_ADMIN_ID)
    expect(d.adminRole).toBe('super')
    const rows = await api().users({ status: 'admin' })
    expect(rows.items.find(r => r.id === 'u_admin2')?.adminRole).toBe('admin')
    expect((await api().users({ q: 'layan' })).items[0]!.adminRole).toBeNull()
  })

  it('a limited admin gets 403 forbidden with the section and level; any admin reads the dashboard', async () => {
    await m.services.auth.signOut()
    await signIn('ops@example.com')
    const me = await m.services.auth.me()
    expect(me?.adminRole).toBe('admin')
    expect(me?.adminPermissions?.settings).toBe('none')
    expect(await code(api().dashboard(30))).toBe('ok')
    expect(await code(api().users({}))).toBe('ok')
    const s = await err(api().settings())
    expect(s !== 'ok' && s.code).toBe('forbidden')
    expect(s !== 'ok' && s.info).toEqual({ section: 'settings', need: 'view' })
    // money: view → reads pass, writes refused
    expect(await code(api().subscriptions({}))).toBe('ok')
    const w = await err(api().changePlan('u_layan', { planId: 'pro', period: 'monthly', note: 'x' }))
    expect(w !== 'ok' && w.info).toEqual({ section: 'money', need: 'edit' })
    expect(await code(api().admins())).toBe('forbidden')
    expect(await code(api().grantAdmin('u_layan'))).toBe('forbidden')
    // and the super admin can't be touched through the user routes either
    expect(await code(api().suspend(MOCK_ADMIN_ID, 'x'))).toBe('super_admin_locked')
  })

  it('non-admins still get not_found, signed out unauthenticated', async () => {
    await m.services.auth.signOut()
    expect(await code(api().analytics(30))).toBe('unauthenticated')
    await signIn('layan@example.com')
    expect(await code(api().analytics(30))).toBe('not_found')
    expect(await code(api().admins())).toBe('not_found')
  })

  it('analytics: buckets add up, every day present, AI rows per provider × paidWith × unit', async () => {
    const a = await api().analytics(90)
    expect(a.period.days).toBe(90)
    expect(a.takes.byDay.length).toBeGreaterThanOrEqual(90)
    const sum = DURATION_BUCKETS.reduce((n, b) => n + a.takes.durationBuckets[b], 0)
    expect(sum).toBe(a.takes.count)
    for (const b of DURATION_BUCKETS) expect(a.takes.durationBuckets[b]).toBeGreaterThan(0)
    expect(a.takes.byKind.audio + a.takes.byKind.video).toBe(a.takes.count)
    expect(a.takes.byDay.reduce((n, x) => n + x.count, 0)).toBe(a.takes.count)
    expect(a.practice.sessions).toBeGreaterThan(0)
    expect(a.practice.byDay.reduce((n, x) => n + x.count, 0)).toBe(a.practice.sessions)
    expect(a.practice.byVia.web + a.practice.byVia.app + a.practice.byVia.phone).toBe(a.practice.sessions)
    expect(a.practice.recordedShare).toBeGreaterThan(0)
    expect(a.practice.recordedShare).toBeLessThan(1)
    expect(a.phoneLinks.byHostKind.web + a.phoneLinks.byHostKind.app).toBe(a.phoneLinks.started)
    expect(a.ownKeys.byProvider.anthropic).toBeGreaterThan(0)
    expect(a.ownKeys.byProvider.openai).toBeGreaterThan(0)
    expect(a.drives.byProvider.google_drive).toBe(a.drives.linked)
    const keys = a.aiUsage.map(r => `${r.provider}|${r.paidWith}|${r.unit}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(a.aiUsage.some(r => r.paidWith === 'own_key')).toBe(true)
    expect(a.aiUsage.filter(r => r.paidWith === 'own_key').every(r => r.credits === 0)).toBe(true)
    expect(await code(api().analytics(0))).toBe('validation')
    expect(await code(api().analytics(366))).toBe('validation')
    const d = await api().dashboard(90)
    expect(d.headlines).toEqual({ takes: a.takes.count, minutes: a.takes.totalMinutes, scripts: a.scripts.createdInPeriod, practiceSessions: a.practice.sessions, phoneLinks: a.phoneLinks.started, ownKeyUsers: a.ownKeys.users })
  })

  it('empty dashboard knob: zeros and null averages', async () => {
    m.knobs.admin.setKnobs({ emptyDashboard: true })
    const a = await api().analytics(7)
    expect(a.takes.count).toBe(0)
    expect(a.practice.avgDurationS).toBeNull()
    expect(a.practice.recordedShare).toBeNull()
    expect(a.phoneLinks.avgDurationS).toBeNull()
    expect(a.aiUsage).toEqual([])
  })

  it('one person: takes, scripts, links (paged), connections and preferences, without secrets or media', async () => {
    const id = 'u_seed00'
    const takes = await api().userTakes(id, null, 2)
    expect(takes.items).toHaveLength(2)
    expect(takes.nextCursor).not.toBeNull()
    const rest = await api().userTakes(id, takes.nextCursor, 100)
    const all = [...takes.items, ...rest.items]
    expect(all.map(x => x.recordedAt)).toEqual([...all.map(x => x.recordedAt)].sort().reverse())
    expect(JSON.stringify(all)).not.toMatch(/providerFileId|drive_/)
    const scripts = await api().userScripts(id)
    expect(scripts.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(scripts.items)).not.toMatch(/"body"|"marks"|lastPosition/)
    expect(scripts.items[0]!.wordCount).toBeGreaterThan(0)
    const links = await api().userLinks(id)
    expect(links.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(links.items)).not.toMatch(/credential|secret/)
    const c = await api().userConnections(id)
    expect(c.storage[0]?.provider).toBe('google_drive')
    expect(c.aiKeys).toEqual([])
    const k = await api().userConnections('u_seed02')
    expect(k.aiKeys[0]?.last4).toHaveLength(4)
    expect(JSON.stringify(k)).not.toMatch(/secret|token/i)
    const p = await api().userPreferences(id)
    expect(p.reading.wpm).toBeGreaterThan(0)
    expect(await code(api().userTakes('nobody'))).toBe('not_found')
  })

  it('admins: list (super first), add with permissions, replace, remove; every change audited once', async () => {
    const list = await api().admins()
    expect(list.sections).toEqual(['users', 'money', 'ai', 'plans', 'settings', 'audit', 'admins'])
    expect(list.admins[0]!.adminRole).toBe('super')
    const auditCount = async () => (await api().auditLog({ targetId: 'u_layan' }, null)).items.length
    const row = await api().addAdmin({ email: 'LAYAN@example.com', permissions: { users: 'view' } })
    expect(row.adminPermissions).toEqual({ users: 'view', money: 'none', ai: 'none', plans: 'none', settings: 'none', audit: 'none', admins: 'none' })
    expect(await auditCount()).toBe(1)
    expect(await code(api().addAdmin({ userId: 'u_layan', permissions: {} }))).toBe('conflict')
    expect(await code(api().addAdmin({ userId: 'u_seed09', permissions: {} }))).toBe('conflict') // suspended
    expect(await code(api().addAdmin({ email: 'nobody@example.com', permissions: {} }))).toBe('validation')
    const bad = await err(api().updateAdmin('u_layan', { users: 'owner' as never }))
    expect(bad !== 'ok' && bad.fields).toEqual({ 'permissions.users': 'invalid' })
    const up = await api().updateAdmin('u_layan', { users: 'edit', audit: 'view' })
    expect(up.adminPermissions.users).toBe('edit')
    expect(up.adminPermissions.audit).toBe('view')
    await api().updateAdmin('u_layan', { users: 'edit', audit: 'view' }) // identical: no entry
    expect(await auditCount()).toBe(2)
    expect((await api().auditLog({ targetId: 'u_layan' }, null)).items[0]!.action).toBe('user.admin_permissions')
    await api().removeAdmin('u_layan')
    expect(await auditCount()).toBe(3)
    expect(await code(api().removeAdmin('u_layan'))).toBe('not_found')
    expect(await code(api().updateAdmin(MOCK_ADMIN_ID, {}))).toBe('super_admin_locked')
    expect(await code(api().removeAdmin(MOCK_ADMIN_ID))).toBe('super_admin_locked')
  })

  it('a grant without permissions gets the defaults; an admin can\'t change themself', async () => {
    const d = await api().grantAdmin('u_layan')
    expect(d.adminPermissions).toEqual(DEFAULT_ADMIN_PERMISSIONS)
    m.knobs.admin.setRole('u_layan', 'admin', { admins: 'edit', users: 'view' })
    await m.services.auth.signOut()
    await signIn('layan@example.com')
    expect(await code(api().admins())).toBe('ok')
    expect(await code(api().updateAdmin('u_layan', {}))).toBe('conflict')
    expect(await code(api().removeAdmin('u_layan'))).toBe('conflict')
    expect(await code(api().updateAdmin('u_admin2', { users: 'view' }))).toBe('ok')
  })

  it('the super admin can\'t delete their own account', async () => {
    expect(await code(m.services.account.deleteAccount({ password: SEED_PASSWORD }))).toBe('super_admin_locked')
  })

  it('practice: logs a run, checks the script and the fields', async () => {
    await m.services.auth.signOut()
    expect(await code(m.services.practice.log({ startedAt: new Date().toISOString(), durationS: 30, recorded: false, via: 'web' }))).toBe('unauthenticated')
    await signIn('layan@example.com')
    const scripts = await m.services.scripts.list()
    const s = await m.services.practice.log({ scriptId: scripts[0]!.id, startedAt: new Date(Date.now() - 60_000).toISOString(), durationS: 42, recorded: true, via: 'web' })
    expect(s).toMatchObject({ scriptId: scripts[0]!.id, durationS: 42, recorded: true, via: 'web' })
    expect(await code(m.services.practice.log({ scriptId: 's_ins0_0', startedAt: new Date().toISOString(), durationS: 30, recorded: false, via: 'web' }))).toBe('not_found')
    expect(await code(m.services.practice.log({ startedAt: new Date().toISOString(), durationS: 0, recorded: false, via: 'web' }))).toBe('validation')
    expect(await code(m.services.practice.log({ startedAt: new Date().toISOString(), durationS: 21_601, recorded: false, via: 'web' }))).toBe('validation')
    expect(await code(m.services.practice.log({ startedAt: new Date(Date.now() + 10 * 60_000).toISOString(), durationS: 30, recorded: false, via: 'web' }))).toBe('validation')
    await m.services.auth.signOut()
    await signIn(MOCK_ADMIN_EMAIL)
    const counts = (await api().userScripts('u_layan')).items.find(x => x.id === scripts[0]!.id)
    expect(counts?.practiceSessions).toBe(1)
  })
})

describe('admin insights · http', () => {
  interface Call { method: string; url: string; body: unknown }
  function setup(replies: Array<{ status?: number; json?: unknown }>) {
    const calls: Call[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      const c = { method: init.method ?? 'GET', url: String(url).replace('http://api.test', ''), body: init.body ? JSON.parse(String(init.body)) : undefined }
      calls.push(c)
      if (c.url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
      const r = replies.shift() ?? { json: null }
      return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? null), { status: r.status ?? 200 })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: n => (n === 'XSRF-TOKEN' ? 'tok' : null) })
    return { services, calls: () => calls.filter(c => !c.url.endsWith('csrf-cookie')) }
  }

  it('maps the 007 routes and envelopes', async () => {
    const { services, calls } = setup([
      { json: { period: { days: 7 } } },
      { json: { takes: [{ id: 't1' }], nextCursor: 'c2' } },
      { json: { scripts: [], nextCursor: null } },
      { json: { links: [{ id: 'L1' }], nextCursor: null } },
      { json: { storage: [], aiKeys: [], devices: [], webSessions: 0 } },
      { json: { locale: 'ar' } },
      { json: { admins: [], sections: [] } },
      { status: 201, json: { id: 'u1' } },
      { json: { id: 'u1' } },
      { status: 204 },
      { status: 201, json: { id: 'ps1' } },
    ])
    const a = services.admin
    await a.analytics(7)
    expect(await a.userTakes('u 1', 'abc', 20)).toEqual({ items: [{ id: 't1' }], nextCursor: 'c2' })
    expect((await a.userScripts('u1')).items).toEqual([])
    expect((await a.userLinks('u1')).items[0]).toEqual({ id: 'L1' })
    await a.userConnections('u1')
    await a.userPreferences('u1')
    await a.admins()
    await a.addAdmin({ email: 'x@example.com', permissions: { users: 'view' } })
    await a.updateAdmin('u1', { money: 'edit' })
    await a.removeAdmin('u1')
    await services.practice.log({ scriptId: null, startedAt: '2026-11-25T10:00:00.000Z', durationS: 12, recorded: false, via: 'web' })
    expect(calls().map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/admin/analytics?days=7',
      'GET /api/admin/users/u%201/takes?cursor=abc&limit=20',
      'GET /api/admin/users/u1/scripts',
      'GET /api/admin/users/u1/links',
      'GET /api/admin/users/u1/connections',
      'GET /api/admin/users/u1/preferences',
      'GET /api/admin/admins',
      'POST /api/admin/admins',
      'PATCH /api/admin/admins/u1',
      'DELETE /api/admin/admins/u1',
      'POST /api/practice-sessions',
    ])
    expect(calls()[7]!.body).toEqual({ email: 'x@example.com', permissions: { users: 'view' } })
    expect(calls()[8]!.body).toEqual({ permissions: { money: 'edit' } })
    expect(calls()[10]!.body).toMatchObject({ durationS: 12, via: 'web' })
  })

  it('maps forbidden (with section and need) and super_admin_locked', async () => {
    const { services } = setup([
      { status: 403, json: { code: 'forbidden', message: 'x', section: 'money', need: 'edit' } },
      { status: 409, json: { code: 'super_admin_locked', message: 'x' } },
    ])
    const f = await err(services.admin.payments({}, null))
    expect(f !== 'ok' && f.code).toBe('forbidden')
    expect(f !== 'ok' && f.info).toMatchObject({ section: 'money', need: 'edit' })
    expect(await code(services.admin.removeAdmin('u1'))).toBe('super_admin_locked')
  })
})
