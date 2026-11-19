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
    await m.services.account.deleteAccount({ password: SEED_PASSWORD })
    expect(await m.services.auth.me()).toBeNull()
    expect(await code(m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD }))).toBe('invalid_credentials')
  })

  it('fails calls with a network error when offline', async () => {
    const m = setup()
    m.db.setKnobs({ offline: true })
    expect(await code(m.services.auth.me())).toBe('network')
  })
})
