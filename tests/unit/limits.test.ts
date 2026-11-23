import { beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError, PortError } from '~/services/types'
import { describeLimit, usageRatio, WARN_AT } from '~/utils/limits'

// US1 (T011): plan limits on scripts, read-only ranking, and the limit-dialog copy.

const noSleep = () => Promise.resolve()
async function err(p: Promise<unknown>) {
  try {
    await p
    return null
  } catch (e) {
    return e
  }
}

describe('script limits in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { sleep: noSleep })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })

  it('refuses create, duplicate and unarchive at scripts.max_active with value and usage', async () => {
    m.knobs.setPlanLimit('free', 'scripts.max_active', 3)
    const e = await err(m.services.scripts.create({ title: 'رابع' }))
    expect(isPortError(e, 'limit_reached')).toBe(true)
    expect((e as PortError).limit).toEqual({ key: 'scripts.max_active', value: 3, usage: 3 })
    expect(isPortError(await err(m.services.scripts.duplicate('s_letter')), 'limit_reached')).toBe(true)

    const s = await m.services.scripts.get('s_letter')
    const archived = await m.services.scripts.update('s_letter', { archivedAt: new Date().toISOString() }, s.version)
    expect((await m.services.scripts.create({ title: 'رابع' })).title).toBe('رابع')
    const back = await err(m.services.scripts.update('s_letter', { archivedAt: null }, archived.version))
    expect(isPortError(back, 'limit_reached')).toBe(true)
  })

  it('refuses a save over scripts.max_words, reporting the text length', async () => {
    m.knobs.setPlanLimit('free', 'scripts.max_words', 5)
    const s = await m.services.scripts.get('s_letter')
    const e = await err(m.services.scripts.update(s.id, { body: 'واحد اثنان ثلاثة أربعة خمسة ستة' }, s.version))
    expect((e as PortError).limit).toEqual({ key: 'scripts.max_words', value: 5, usage: 6 })
  })

  it('ranks by last edit: scripts past the limit are read-only, and refuse edits but not archive', async () => {
    m.knobs.setPlanLimit('free', 'scripts.max_active', 1)
    const list = await m.services.scripts.list()
    // Seed order by updatedAt: opening (2 h) is newest, then backstage, then letter.
    expect(list.filter(s => s.readOnly).map(s => s.id).sort()).toEqual(['s_backstage', 's_letter'])
    expect(list.find(s => s.id === 's_backstage')?.readOnlyReason).toBe('scripts.max_active')
    const ro = await m.services.scripts.get('s_backstage')
    expect(ro.readOnly).toBe(true)
    expect(isPortError(await err(m.services.scripts.update(ro.id, { body: 'x' }, ro.version)), 'limit_reached')).toBe(true)
    expect(isPortError(await err(m.services.scripts.update(ro.id, { title: 'y' }, ro.version)), 'limit_reached')).toBe(true)
    // Pin and archive stay allowed.
    const pinned = await m.services.scripts.update(ro.id, { pinned: true }, ro.version)
    await m.services.scripts.update(ro.id, { archivedAt: new Date().toISOString() }, pinned.version)
    // Unlimited (Pro): nothing is read-only.
    m.knobs.setPlan(userId, 'pro')
    expect((await m.services.scripts.list()).some(s => s.readOnly)).toBe(false)
  })
})

describe('limit dialog copy (useLimitError)', () => {
  it('maps known keys to their action and unknown keys to the generic message with Upgrade', () => {
    expect(describeLimit({ key: 'scripts.max_active', value: 20, usage: 20 })).toMatchObject({ action: 'archive', upgrade: true, params: { value: 20, usage: 20 } })
    expect(describeLimit({ key: 'scripts.max_words', value: 50000, usage: 50001 }).action).toBe('shorten')
    expect(describeLimit({ key: 'takes.max_minutes', value: 10, usage: 12 }).action).toBe('none')
    expect(describeLimit({ key: 'storage.auto_sync', value: false, usage: null }).title).toBe('limits.dialog.autoSyncTitle')
    const unknown = describeLimit({ key: 'teleport.max_jumps', value: 1, usage: 1 })
    expect(unknown).toMatchObject({ title: 'limits.dialog.genericTitle', text: 'limits.dialog.genericText', upgrade: true })
    expect(describeLimit(undefined).title).toBe('limits.dialog.genericTitle')
  })

  it('turns meters to the warning colour at 80 % and ignores unlimited values', () => {
    expect(usageRatio(20, 16)).toBe(0.8)
    expect(usageRatio(20, 16)! >= WARN_AT).toBe(true)
    expect(usageRatio(20, 15)! >= WARN_AT).toBe(false)
    expect(usageRatio(null, 15)).toBeNull()
    expect(usageRatio(true, 1)).toBeNull()
  })
})
