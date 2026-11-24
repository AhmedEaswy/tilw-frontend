import { beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'

const noSleep = () => Promise.resolve()

function setup() {
  return createMockServices(memoryKV(), { origin: 'http://test', sleep: noSleep })
}

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : 'thrown'
  }
}

describe('auth', () => {
  let m: ReturnType<typeof setup>
  beforeEach(() => (m = setup()))

  it('signs in the seeded user and reports the session', async () => {
    expect(await m.services.auth.me()).toBeNull()
    const u = await m.services.auth.signIn({ email: ' Layan@Example.com ', password: SEED_PASSWORD })
    expect(u.email).toBe('layan@example.com')
    expect(u).not.toHaveProperty('password')
    expect((await m.services.auth.me())?.id).toBe(u.id)
  })

  it('does not reveal whether an email exists', async () => {
    expect(await code(m.services.auth.signIn({ email: 'nobody@example.com', password: 'x' }))).toBe('invalid_credentials')
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: 'wrong' }))).toBe('invalid_credentials')
    expect(await code(m.services.auth.requestPasswordReset({ email: 'nobody@example.com' }))).toBe('ok')
    expect(m.db.s.outbox).toHaveLength(0)
  })

  it('completes a password reset round-trip through the outbox', async () => {
    await m.services.auth.requestPasswordReset({ email: 'layan@example.com' })
    const link = m.db.s.outbox[0]!.link!
    const token = new URL(link).searchParams.get('token')!
    expect(await m.services.auth.checkResetToken(token)).toEqual({ email: 'layan@example.com' })
    expect(await code(m.services.auth.resetPassword({ token, password: 'short' }))).toBe('validation')
    const u = await m.services.auth.resetPassword({ token, password: 'new-password-1' })
    expect(u.email).toBe('layan@example.com')
    expect(await code(m.services.auth.resetPassword({ token, password: 'again-123456' }))).toBe('token_invalid')
    await m.services.auth.signOut()
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: 'new-password-1' }))).toBe('ok')
  })

  it('reports expired tokens when the knob is on', async () => {
    m.db.setKnobs({ expireTokens: true })
    expect(await code(m.services.auth.checkInvite('demo-invite'))).toBe('token_expired')
  })

  it('accepts an invitation once and starts with an empty library', async () => {
    const u = await m.services.auth.acceptInvite({ token: 'demo-invite', name: ' سارة ', password: 'password-1' })
    expect(u).toMatchObject({ email: 'invited@example.com', name: 'سارة' })
    expect(await m.services.scripts.list()).toEqual([])
    expect(await code(m.services.auth.checkInvite('demo-invite'))).toBe('token_invalid')
  })
})

describe('scripts', () => {
  let m: ReturnType<typeof setup>
  beforeEach(async () => {
    m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  })

  it('requires a session', async () => {
    await m.services.auth.signOut()
    expect(await code(m.services.scripts.list())).toBe('unauthenticated')
  })

  it('lists summaries without bodies', async () => {
    const list = await m.services.scripts.list()
    expect(list.map(s => s.title)).toEqual(['افتتاحية الحلقة', 'وراء الكواليس', 'رسالة إلى المستمع'])
    expect(list[0]).not.toHaveProperty('body')
    expect(list[0]!.excerpt).toBe('كل حكاية تبدأ بسؤال صغير.')
    expect(list[0]!.paragraphCount).toBe(3)
  })

  it('bumps the version on save and rejects stale versions with the server copy', async () => {
    const s = await m.services.scripts.get('s_opening')
    const saved = await m.services.scripts.update(s.id, { body: 'نص جديد' }, s.version)
    expect(saved.version).toBe(s.version + 1)
    try {
      await m.services.scripts.update(s.id, { body: 'قديم' }, s.version)
      expect.unreachable()
    } catch (e) {
      expect(isPortError(e, 'conflict')).toBe(true)
      expect((e as { current: { body: string } }).current.body).toBe('نص جديد')
    }
  })

  it('simulates an edit from another device when forced', async () => {
    const s = await m.services.scripts.get('s_opening')
    m.db.setKnobs({ forceConflictOnNextSave: true })
    expect(await code(m.services.scripts.update(s.id, { body: 'x' }, s.version))).toBe('conflict')
    expect(m.db.knobs.forceConflictOnNextSave).toBe(false)
  })

  it('creates, duplicates and removes', async () => {
    const created = await m.services.scripts.create({ title: '  نص جديد ' })
    expect(created.title).toBe('نص جديد')
    const copy = await m.services.scripts.duplicate(created.id)
    expect(copy.id).not.toBe(created.id)
    await m.services.scripts.remove(created.id)
    expect(await code(m.services.scripts.get(created.id))).toBe('not_found')
    expect(await code(m.services.scripts.create({ title: '   ' }))).toBe('validation')
  })

  it('searches titles and bodies, ignoring diacritics', async () => {
    expect(await m.services.scripts.search('الكواليس')).toEqual(['s_backstage'])
    expect(await m.services.scripts.search('المستمع')).toEqual(['s_letter'])
    // body text, typed without the teh marbuta
    expect(await m.services.scripts.search('الحلقه')).toContain('s_opening')
    expect(await m.services.scripts.search('   ')).toEqual([])
  })

  it('pin and archive do not change the edited date', async () => {
    const s = await m.services.scripts.get('s_letter')
    const saved = await m.services.scripts.update(s.id, { pinned: true, archivedAt: new Date().toISOString() }, s.version)
    expect(saved.updatedAt).toBe(s.updatedAt)
    expect(saved.pinned).toBe(true)
  })

  it('returns copies, not live references', async () => {
    const a = await m.services.scripts.get('s_opening')
    a.title = 'mutated'
    expect((await m.services.scripts.get('s_opening')).title).toBe('افتتاحية الحلقة')
  })
})

describe('account', () => {
  it('exports JSON only with the right password and can delete the account', async () => {
    const m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(await code(m.services.account.exportData({ password: 'nope' }))).toBe('invalid_credentials')
    const blob = await m.services.account.exportData({ password: SEED_PASSWORD })
    const data = JSON.parse(await blob.text())
    expect(data.format).toBe('tilw-account-v1')
    expect(data.scripts).toHaveLength(3)
    expect(data.account).not.toHaveProperty('password')
    // Release 2: deletion is scheduled 14 days ahead and signs out; once the 14 days pass the account is gone.
    const { deletionDueAt } = await m.services.account.deleteAccount({ password: SEED_PASSWORD })
    expect(Date.parse(deletionDueAt) - Date.now()).toBeGreaterThan(13.9 * 86_400_000)
    expect(await m.services.auth.me()).toBeNull()
    m.db.setKnobs({ clockOffsetMs: 15 * 86_400_000 })
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('invalid_credentials')
  })

  it('changes the password only with the current one and a long enough new one (T095)', async () => {
    const m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(await code(m.services.account.changePassword({ current: 'nope', next: 'newpassword1' }))).toBe('invalid_credentials')
    expect(await code(m.services.account.changePassword({ current: SEED_PASSWORD, next: 'short' }))).toBe('validation')
    await m.services.account.changePassword({ current: SEED_PASSWORD, next: 'newpassword1' })
    await m.services.auth.signOut()
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('invalid_credentials')
    expect((await m.services.auth.signIn({ email: 'layan@example.com', password: 'newpassword1' })).email).toBe('layan@example.com')
  })

  it('keeps the account when the delete password is wrong', async () => {
    const m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(await code(m.services.account.deleteAccount({ password: 'nope' }))).toBe('invalid_credentials')
    expect(await m.services.auth.me()).not.toBeNull()
  })

  it('saves name, theme and locale, and rejects an empty name', async () => {
    const m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const u = await m.services.account.updatePrefs({ name: '  ليان  ', theme: 'dark', locale: 'en' })
    expect([u.name, u.theme, u.locale]).toEqual(['ليان', 'dark', 'en'])
    expect(await code(m.services.account.updatePrefs({ name: '   ' }))).toBe('validation')
  })

  it('lists legacy browser scripts only for a signed-in user', async () => {
    const m = setup()
    expect(await code(m.services.legacy.scan())).toBe('unauthenticated')
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const found = await m.services.legacy.scan()
    expect(found.map(f => f.title)).toEqual(['الافتتاحية الأولى', 'كواليس التصوير'])
  })

  it('fails calls with a network error when offline', async () => {
    const m = setup()
    m.db.setKnobs({ offline: true })
    expect(await code(m.services.auth.me())).toBe('network')
  })
})

describe('admin', () => {
  it('is not found for a signed-in non-admin, as on the real API (feature 006)', async () => {
    const m = setup()
    expect(await code(m.services.admin.waitlist())).toBe('unauthenticated')
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    expect(await code(m.services.admin.waitlist())).toBe('not_found')
    expect(await code(m.services.admin.invitations())).toBe('not_found')
    expect(await code(m.services.admin.invite({ email: 'a@b.co' }))).toBe('not_found')
    expect(await code(m.services.admin.dashboard(30))).toBe('not_found')
    expect(await code(m.services.admin.users({}))).toBe('not_found')
  })
})

// ---------- release 2: PlanPort (T009) ----------
describe('plans', () => {
  it('lists Free and Pro with USD prices and every limit kind, without signing in', async () => {
    const m = setup()
    const plans = await m.services.plans.listPlans()
    expect(plans.map(p => [p.key, p.priceMonthlyCents, p.priceYearlyCents, p.currency])).toEqual([['free', 0, 0, 'USD'], ['pro', 800, 7700, 'USD']])
    expect(plans[1]!.limits.find(l => l.key === 'takes.max_minutes')?.value).toBe(60)
  })

  it('reports Free limits with usage for the signed-in person', async () => {
    const m = setup()
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const my = await m.services.plans.myPlan()
    expect(my.plan.key).toBe('free')
    expect(my.period).toBeNull()
    const active = my.limits.find(l => l.key === 'scripts.max_active')!
    expect(active).toMatchObject({ value: 20, usage: 3, overridden: false })
    expect(my.limits.find(l => l.key === 'takes.max_minutes')).toMatchObject({ value: 10, usage: null })
  })

  it('resolves override → plan in force → Free → default', async () => {
    const m = setup()
    const u = await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const v = async (k: string) => (await m.services.plans.myPlan()).limits.find(l => l.key === k)!
    m.knobs.setPlan(u.id, 'pro')
    expect((await v('takes.max_minutes')).value).toBe(60)
    expect((await v('scripts.max_active')).value).toBeNull()
    m.knobs.setOverride(u.id, 'takes.max_minutes', 90)
    expect(await v('takes.max_minutes')).toMatchObject({ value: 90, overridden: true })
    m.knobs.setOverride(u.id, 'takes.max_minutes', undefined)
    m.knobs.setPlan(u.id, 'free')
    expect((await v('takes.max_minutes')).value).toBe(10)
    // A kind neither plan sets falls back to its default.
    m.db.write(s => s.limitDefinitions.push({ key: 'future.thing', type: 'int', default: 7, counted: false, label: { ar: 'x', en: 'x' } }))
    expect((await v('future.thing')).value).toBe(7)
  })

  it('needs a session for my plan', async () => {
    const m = setup()
    expect(await code(m.services.plans.myPlan())).toBe('unauthenticated')
  })
})
