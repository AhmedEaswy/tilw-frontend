import { beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { MOCK_ADMIN_EMAIL, MOCK_ADMIN_ID } from '~/services/mock/admin'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createHttpServices } from '~/services/http'
import { isPortError } from '~/services/types'

// Feature 006: the admin port contract (specs/006-admin-console/contracts/ports.md), against the mock (behaviour,
// refusals, audit) and the HTTP adapter (routes, headers, paging shapes).

const noSleep = () => Promise.resolve()
async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}

describe('admin port · mock', () => {
  let m: ReturnType<typeof createMockServices>
  const api = () => m.services.admin
  const audit = async (targetId?: string) => (await api().auditLog({ targetId }, null)).items
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep })
    await m.services.auth.signIn({ email: MOCK_ADMIN_EMAIL, password: SEED_PASSWORD })
  })

  it('seeds a demo admin and people across plans and statuses', async () => {
    const me = await m.services.auth.me()
    expect(me?.isAdmin).toBe(true)
    const d = await api().dashboard(30)
    expect(d.users.total).toBeGreaterThan(30)
    expect(d.users.admins).toBe(2)
    expect(d.users.suspended).toBe(1)
    expect(d.signups.byDay.length).toBeGreaterThanOrEqual(30)
    expect(d.signups.byDay.reduce((n, x) => n + x.count, 0)).toBe(d.signups.total)
    expect(d.attention.pendingRequests).toBe(3)
    expect(d.revenue.mrrCents).toBeGreaterThan(0)
    expect(await code(api().dashboard(0))).toBe('validation')
  })

  it('pages people newest first, filters by plan and status', async () => {
    const first = await api().users({}, null, 10)
    expect(first.items).toHaveLength(10)
    expect(first.nextCursor).not.toBeNull()
    const second = await api().users({}, first.nextCursor, 10)
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id)
    const dates = first.items.map(u => u.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    const pro = await api().users({ plan: 'pro' })
    expect(pro.items.length).toBeGreaterThan(0)
    expect(pro.items.every(u => u.plan === 'pro')).toBe(true)
    const suspended = await api().users({ status: 'suspended' })
    expect(suspended.items.map(u => u.id)).toEqual(['u_seed09'])
    const admins = await api().users({ status: 'admin' })
    expect(admins.items.every(u => u.isAdmin)).toBe(true)
    expect((await api().users({ q: 'LAYAN' })).items.map(u => u.email)).toEqual(['layan@example.com'])
  })

  it('shows a person without secrets', async () => {
    const d = await api().user('u_layan')
    expect(d.email).toBe('layan@example.com')
    expect(d.limits.length).toBeGreaterThan(5)
    expect(JSON.stringify(d)).not.toMatch(/password|token/i)
    expect(await code(api().user('nobody'))).toBe('not_found')
  })

  it('suspends: signed out, refused at sign-in and on every call, one audit entry; unsuspends', async () => {
    const before = (await audit('u_layan')).length
    expect(await code(api().suspend('u_layan', ''))).toBe('validation')
    const d = await api().suspend('u_layan', 'abuse')
    expect(d.status).toBe('suspended')
    expect(d.suspension?.byEmail).toBe(MOCK_ADMIN_EMAIL)
    expect(await code(api().suspend('u_layan', 'again'))).toBe('conflict')
    const entries = await audit('u_layan')
    expect(entries.length).toBe(before + 1)
    expect(entries[0]!.action).toBe('user.suspend')
    expect(entries[0]!.adminEmail).toBe(MOCK_ADMIN_EMAIL)

    await m.services.auth.signOut()
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('account_suspended')
    await m.services.auth.signIn({ email: MOCK_ADMIN_EMAIL, password: SEED_PASSWORD })
    expect((await api().unsuspend('u_layan')).status).toBe('active')
    expect(await code(api().unsuspend('u_layan'))).toBe('conflict')
    await m.services.auth.signOut()
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('ok')
  })

  it('a signed-in person who gets suspended is refused on the next call and signed out', async () => {
    m.knobs.admin.suspend('u_admin2')
    await m.services.auth.signOut()
    expect(await code(m.services.auth.signIn({ email: 'ops@example.com', password: SEED_PASSWORD }))).toBe('account_suspended')
    m.knobs.admin.unsuspend('u_admin2')
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    m.knobs.admin.suspend('u_layan')
    expect(await code(m.services.scripts.list())).toBe('account_suspended')
    expect(await m.services.auth.me()).toBeNull()
  })

  it('refuses the admin\'s own account, an admin target, and the plan already in force', async () => {
    expect(await code(api().suspend(MOCK_ADMIN_ID, 'x'))).toBe('conflict')
    expect(await code(api().scheduleDeletion(MOCK_ADMIN_ID, 'x'))).toBe('conflict')
    expect(await code(api().sendPasswordReset(MOCK_ADMIN_ID))).toBe('conflict')
    expect(await code(api().revokeAdmin(MOCK_ADMIN_ID))).toBe('conflict')
    expect(await code(api().suspend('u_admin2', 'x'))).toBe('conflict')
    expect(await code(api().changePlan('u_layan', { planId: 'free', note: 'x' }))).toBe('conflict')
    const before = (await audit()).length
    expect((await audit()).length).toBe(before)
  })

  it('makes and removes admins; the last admin keeps the flag', async () => {
    expect((await api().revokeAdmin('u_admin2')).isAdmin).toBe(false)
    expect(await code(api().revokeAdmin('u_admin2'))).toBe('conflict')
    expect((await api().grantAdmin('u_layan')).isAdmin).toBe(true)
    expect(await code(api().grantAdmin('u_seed09'))).toBe('conflict') // suspended
  })

  it('changes the plan now and sends a reset that signs the person out', async () => {
    const d = await api().changePlan('u_layan', { planId: 'pro', period: 'yearly', note: 'paid' })
    expect(d.plan.key).toBe('pro')
    expect(d.plan.subscription?.source).toBe('admin')
    expect(await code(api().changePlan('u_layan', { planId: 'pro', period: 'yearly', note: 'paid' }))).toBe('conflict')
    expect(await code(api().changePlan('u_layan', { planId: 'free', note: '' }))).toBe('validation')
    expect((await api().changePlan('u_layan', { planId: 'free', note: 'refund' })).plan.key).toBe('free')
    const r = await api().sendPasswordReset('u_layan')
    expect(r.sentTo).toBe('layan@example.com')
    expect(m.db.s.outbox[0]!.kind).toBe('reset')
  })

  it('grants credits once per idempotency key', async () => {
    const before = (await api().user('u_layan')).credits.balance
    const a = await api().addCredits('u_layan', { kind: 'grant', amount: 50, reason: 'sorry' }, 'k-1')
    const b = await api().addCredits('u_layan', { kind: 'grant', amount: 50, reason: 'sorry' }, 'k-1')
    expect(b.id).toBe(a.id)
    expect((await api().user('u_layan')).credits.balance).toBe(before + 50)
    expect(await code(api().addCredits('u_layan', { kind: 'grant', amount: 60, reason: 'sorry' }, 'k-1'))).toBe('conflict')
    expect((await audit('u_layan')).filter(e => e.action === 'credits.grant')).toHaveLength(1)
    expect(await code(api().addCredits('u_layan', { kind: 'grant', amount: 0, reason: 'x' }))).toBe('validation')
    const ledger = await api().ledger({ userId: 'u_layan', kind: 'grant' }, null)
    expect(ledger.items[0]!.createdBy?.email).toBe(MOCK_ADMIN_EMAIL)
  })

  it('schedules a deletion that signing in does not cancel; an admin cancels it', async () => {
    const d = await api().scheduleDeletion('u_layan', 'asked by email')
    expect(d.status).toBe('deletion_scheduled')
    expect(d.deletionBy).toBe(MOCK_ADMIN_ID)
    await m.services.auth.signOut()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(m.services.auth.lastNotice()).toBeNull()
    await m.services.auth.signOut()
    await m.services.auth.signIn({ email: MOCK_ADMIN_EMAIL, password: SEED_PASSWORD })
    expect((await api().user('u_layan')).status).toBe('deletion_scheduled')
    expect((await api().cancelDeletion('u_layan')).status).toBe('active')
  })

  it('sets and removes overrides', async () => {
    const o = await api().setOverride('u_layan', 'ai.credits_monthly', { value: 800, note: 'creator' })
    expect(o.value).toBe(800)
    expect((await api().user('u_layan')).limits.find(l => l.key === 'ai.credits_monthly')).toMatchObject({ value: 800, overridden: true })
    expect(await code(api().setOverride('u_layan', 'ai.credits_monthly', { value: -1 }))).toBe('validation')
    await api().removeOverride('u_layan', 'ai.credits_monthly')
    expect(await code(api().removeOverride('u_layan', 'ai.credits_monthly'))).toBe('not_found')
  })

  it('waitlist filters and removal; invitations audited', async () => {
    const all = await api().waitlist()
    const notInvited = await api().waitlist({ invited: false })
    expect(notInvited.length).toBeLessThan(all.length)
    expect(all.some(w => w.hasAccount)).toBe(true)
    await api().removeWaitlist(notInvited[0]!.id)
    expect((await api().waitlist()).length).toBe(all.length - 1)
    const inv = await api().invite({ email: 'new@example.com' })
    expect(inv.state).toBe('pending')
    expect(await code(api().invite({ email: 'new@example.com' }))).toBe('conflict')
    await api().resend(inv.id)
    await api().withdraw(inv.id)
    const actions = (await audit()).map(e => e.action)
    expect(actions.slice(0, 4)).toEqual(['invitation.withdraw', 'invitation.resend', 'invitation.create', 'waitlist.remove'])
  })

  it('money: subscription states, requests and payments with range totals', async () => {
    const active = await api().subscriptions({ state: 'active' }, null)
    expect(active.items.every(s => s.state === 'active')).toBe(true)
    const pending = await api().requests({ state: 'pending' })
    expect(pending).toHaveLength(3)
    const before = await api().payments({}, null)
    const sub = await api().fulfilRequest(pending[0]!.id, { note: 'bank' })
    expect(sub.source).toBe('request')
    expect(await code(api().fulfilRequest(pending[0]!.id))).toBe('conflict')
    const after = await api().payments({}, null)
    expect(after.count).toBe(before.count + 1)
    expect(after.totalCents).toBe(before.totalCents + pending[0]!.priceCents)
    expect((await api().rejectRequest(pending[1]!.id, 'no')).state).toBe('rejected')
    const ended = await api().updateSubscription(sub.id, { endedReason: 'refund' })
    expect(ended.endedReason).toBe('refund')
  })

  it('plans: edit prices, Free stays active, limit values and new kinds', async () => {
    const plans = await api().plans()
    const pro = plans.find(p => p.key === 'pro')!
    expect((await api().updatePlan(pro.id, { priceMonthlyCents: 900 })).priceMonthlyCents).toBe(900)
    expect((await m.services.plans.listPlans()).find(p => p.key === 'pro')!.priceMonthlyCents).toBe(900)
    expect(await code(api().updatePlan('free', { active: false }))).toBe('validation')
    expect((await api().setPlanLimit('pro', 'takes.max_minutes', 90)).value).toBe(90)
    await api().unsetPlanLimit('pro', 'takes.max_minutes')
    expect((await api().plans()).find(p => p.key === 'pro')!.limits.find(l => l.key === 'takes.max_minutes')!.set).toBe(false)
    const def = await api().defineLimit({ key: 'ai.captions_monthly', type: 'int', labelAr: 'ترجمة', labelEn: 'Captions' })
    expect(def.default).toBeNull()
    expect(await code(api().defineLimit({ key: 'bad', type: 'int', labelAr: 'x', labelEn: 'x' }))).toBe('validation')
  })

  it('AI usage groups, failures and the ledger', async () => {
    const byDay = await api().aiUsage({}, 'day')
    expect(byDay.groups.length).toBeGreaterThanOrEqual(30)
    expect(byDay.groups.reduce((n, g) => n + g.calls, 0)).toBe(byDay.totals.calls)
    const byProvider = await api().aiUsage({}, 'provider')
    expect(byProvider.groups.map(g => g.key).sort()).toEqual(['anthropic', 'deepgram', 'openai'])
    const byUser = await api().aiUsage({}, 'user')
    expect(byUser.groups[0]!.user?.email).toBeTruthy()
    const failed = await api().aiCalls({ status: 'failed' }, null)
    expect(failed.items.length).toBeGreaterThan(0)
    expect(failed.items.every(c => c.status === 'failed' && c.failure)).toBe(true)
  })

  it('settings: sign-up mode, keys never echoed, flags in the public settings', async () => {
    expect((await m.services.settings.public()).signupMode).toBe('invite_only')
    await m.services.auth.signOut()
    expect(await code(m.services.auth.signUp({ name: 'N', email: 'n@example.com', password: 'password123', locale: 'en' }))).toBe('signup_closed')
    await m.services.auth.signIn({ email: MOCK_ADMIN_EMAIL, password: SEED_PASSWORD })
    await api().setSignupMode('open')
    const secret = 'sk-ant-secret-1234567890abcd'
    const state = await api().setAiKey('anthropic', { key: secret })
    expect(state).toMatchObject({ set: true, source: 'stored', last4: 'abcd' })
    const all = JSON.stringify([state, await api().settings(), await audit()])
    expect(all).not.toContain(secret)
    expect(await code(api().setAiKey('deepgram', { key: 'dg-key-123456' }))).toBe('validation')
    expect((await api().removeAiKey('anthropic')).source).toBe('none')
    expect(await code(api().setFlag('Bad Key', { enabled: true }))).toBe('validation')
    await api().setFlag('studio.beta', { enabled: true, description: 'Beta' })
    expect((await m.services.settings.public()).flags['studio.beta']).toBe(true)
    await api().removeFlag('studio.beta')
    expect((await m.services.settings.public()).flags['studio.beta']).toBeUndefined()

    await m.services.auth.signOut()
    expect(await code(m.services.auth.signUp({ name: 'N', email: 'layan@example.com', password: 'password123', locale: 'en' }))).toBe('validation')
    const u = await m.services.auth.signUp({ name: 'Nadia', email: 'nadia@example.com', password: 'password123', locale: 'en' })
    expect((await m.services.auth.me())?.id).toBe(u.id)
  })

  it('audit filters and the action list', async () => {
    await api().suspend('u_layan', 'x')
    await api().unsuspend('u_layan')
    const only = (await api().auditLog({ action: 'user.suspend' }, null)).items
    expect(only.every(e => e.action === 'user.suspend')).toBe(true)
    const actions = await api().auditActions()
    expect(actions.map(a => a.action)).toContain('settings.ai_key_set')
  })
})

describe('admin port · http', () => {
  interface Call { method: string; url: string; headers: Record<string, string>; body: unknown }
  function setup(replies: Array<{ status?: number; json?: unknown; headers?: Record<string, string> }>) {
    const calls: Call[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      const c = { method: init.method ?? 'GET', url: String(url).replace('http://api.test', ''), headers: { ...(init.headers as Record<string, string>) }, body: init.body ? JSON.parse(String(init.body)) : undefined }
      calls.push(c)
      if (c.url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
      const r = replies.shift() ?? { json: null }
      return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? null), { status: r.status ?? 200, headers: r.headers })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: n => (n === 'XSRF-TOKEN' ? 'tok' : null) })
    return { services, calls: () => calls.filter(c => !c.url.endsWith('csrf-cookie')) }
  }

  it('users: array body with the cursor in X-Next-Cursor; filters as query', async () => {
    const { services, calls } = setup([
      { json: [{ id: 'a' }], headers: { 'X-Next-Cursor': 'c2' } },
      { json: [{ id: 'b' }] },
    ])
    const p1 = await services.admin.users({ q: 'la', status: 'suspended' })
    expect(p1).toEqual({ items: [{ id: 'a' }], nextCursor: 'c2' })
    const p2 = await services.admin.users({}, 'c2', 20)
    expect(p2.nextCursor).toBeNull()
    expect(calls().map(c => c.url)).toEqual(['/api/admin/users?q=la&status=suspended', '/api/admin/users?cursor=c2&limit=20'])
  })

  it('maps every action to its route', async () => {
    const { services, calls } = setup(Array.from({ length: 20 }, () => ({ json: {} })))
    await services.admin.suspend('u/1', 'why')
    await services.admin.unsuspend('u1')
    await services.admin.sendPasswordReset('u1')
    await services.admin.changePlan('u1', { planId: 'p', period: 'yearly', note: 'n' })
    await services.admin.grantAdmin('u1')
    await services.admin.revokeAdmin('u1')
    await services.admin.scheduleDeletion('u1', 'r')
    await services.admin.cancelDeletion('u1')
    await services.admin.addCredits('u1', { kind: 'grant', amount: 5, reason: 'r' }, 'idem-1')
    await services.admin.setSignupMode('open')
    await services.admin.setAiKey('deepgram', { key: 'k', project: 'p' })
    await services.admin.setFlag('a.b', { enabled: true })
    await services.admin.removeWaitlist('w1')
    expect(calls().map(c => `${c.method} ${c.url}`)).toEqual([
      'POST /api/admin/users/u%2F1/suspend', 'POST /api/admin/users/u1/unsuspend', 'POST /api/admin/users/u1/password-reset',
      'PUT /api/admin/users/u1/plan', 'POST /api/admin/users/u1/admin', 'DELETE /api/admin/users/u1/admin', 'DELETE /api/admin/users/u1',
      'POST /api/admin/users/u1/restore', 'POST /api/admin/users/u1/credits', 'PATCH /api/admin/settings', 'PUT /api/admin/settings/ai-keys/deepgram',
      'PUT /api/admin/feature-flags/a.b', 'DELETE /api/admin/waitlist/w1',
    ])
    expect(calls()[0]!.body).toEqual({ reason: 'why' })
    expect(calls()[6]!.body).toEqual({ reason: 'r' })
    expect(calls()[8]!.headers['Idempotency-Key']).toBe('idem-1')
  })

  it('paged envelopes become pages; payments keep their totals; audit cursor is an integer', async () => {
    const { services, calls } = setup([
      { json: { subscriptions: [{ id: 's' }], nextCursor: 'n' } },
      { json: { payments: [{ id: 'p' }], count: 7, totalCents: 4200, currency: 'USD', nextCursor: null } },
      { json: { entries: [{ id: 9 }], nextCursor: 9 } },
      { json: { calls: [], nextCursor: null } },
    ])
    expect(await services.admin.subscriptions({ state: 'active' }, null)).toMatchObject({ items: [{ id: 's' }], nextCursor: 'n' })
    expect(await services.admin.payments({ from: '2026-11-01T00:00:00.000Z' }, null)).toMatchObject({ items: [{ id: 'p' }], count: 7, totalCents: 4200, nextCursor: null })
    expect(await services.admin.auditLog({ action: 'user.suspend' }, '12')).toEqual({ items: [{ id: 9 }], nextCursor: '9' })
    await services.admin.aiCalls({ status: 'failed' }, null)
    expect(calls().map(c => c.url)).toEqual([
      '/api/admin/subscriptions?state=active',
      '/api/admin/payments?from=2026-11-01T00%3A00%3A00.000Z',
      '/api/admin/audit-log?action=user.suspend&cursor=12',
      '/api/admin/ai/calls?status=failed',
    ])
  })

  it('public settings and sign-up; the two new error codes', async () => {
    const { services, calls } = setup([
      { json: { signupMode: 'open', flags: {} } },
      { status: 403, json: { code: 'signup_closed', message: 'x' } },
      { status: 403, json: { code: 'account_suspended', message: 'x' } },
    ])
    expect((await services.settings.public()).signupMode).toBe('open')
    expect(await code(services.auth.signUp({ name: 'n', email: 'e@x.co', password: 'password1', locale: 'ar' }))).toBe('signup_closed')
    expect(await code(services.scripts.list())).toBe('account_suspended')
    expect(calls().map(c => `${c.method} ${c.url}`)).toEqual(['GET /api/settings', 'POST /register', 'GET /api/scripts'])
  })
})
