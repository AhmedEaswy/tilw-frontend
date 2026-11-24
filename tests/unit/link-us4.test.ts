/**
 * Feature 004, US4 (T039, T040): a second phone, previews, swapping roles with the Tilw app (the studio becomes the
 * remote), ending, and one hosting tab.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createLinkHost, linkStatus, type HostTab, type LinkPlayer } from '~/services/link/host'
import { createLinkRemote, memoryPairingStore } from '~/services/link/remote'
import type { LinkCommand, StudioState } from '~/services/types'

const noSleep = () => Promise.resolve()
const flush = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

function fakePlayer(scriptId: string) {
  const applied: LinkCommand[] = []
  const player: LinkPlayer = {
    scriptId,
    apply: (cmd) => { applied.push(cmd); return { result: 'applied' } },
    snapshot: (): Omit<StudioState, 'seq'> => ({
      scriptTitle: 'افتتاحية', paragraph: 0, paragraphCount: 3, playing: false, mode: 'constant', wpm: 120, fontSize: 'M',
      recording: { state: 'unavailable' }, preview: { current: 'نص الفقرة', next: 'التالية' },
    }),
  }
  return { player, applied }
}

async function setup() {
  const kv = memoryKV()
  const net = memoryNetwork()
  const studioTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  await studioTab.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  const phoneTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const appTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const scriptId = (await studioTab.services.scripts.list())[0]!.id
  const host = createLinkHost({ ...studioTab.services, coalesceMs: 0 })
  const page = fakePlayer(scriptId)
  host.setPlayer(page.player)
  await host.open(scriptId)
  return { studioTab, phoneTab, appTab, net, scriptId, host, page }
}

const phone = (t: Awaited<ReturnType<typeof setup>>) =>
  createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store: memoryPairingStore() })

describe('US4: manage the link from the studio (T039)', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => t.host.reset())

  it('a second phone waits for the studio; accepting replaces the first, declining tells the second', async () => {
    const first = phone(t)
    await first.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.host.newCode()
    const second = phone(t)
    await second.pairWithCode(t.host.state.code!.code)
    await flush()
    expect(second.state.phase).toBe('waitingAccept')
    expect(t.host.state.pendingRemote?.status).toBe('pending')

    await t.host.acceptRemote()
    await flush()
    expect(first.state).toMatchObject({ phase: 'ended', ended: 'replaced' })
    expect(second.state).toMatchObject({ phase: 'connected' })

    await t.host.newCode()
    const third = phone(t)
    await third.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.host.declineRemote()
    await flush()
    expect(third.state).toMatchObject({ phase: 'ended', ended: 'declined' })
    first.dispose(); second.dispose(); third.dispose()
  })

  it('previews off: the phone keeps only the title and position', async () => {
    const p = phone(t)
    await p.pairWithCode(t.host.state.code!.code)
    await flush()
    expect(p.state.state?.preview?.current).toBe('نص الفقرة')
    await t.host.setPreviews(false)
    await flush()
    expect(p.state.previews).toBe(false)
    expect(p.state.state?.preview).toBeUndefined()
    expect(p.state.state?.scriptTitle).toBe('افتتاحية')
    p.dispose()
  })

  it('swaps roles with the Tilw app: the studio becomes the remote and drives the app', async () => {
    const app = await t.appTab.knobs.pairMockApp(t.host.state.code!.code)
    await flush()
    expect(t.host.state.link?.remote?.kind).toBe('app')

    await t.host.requestRoles('remote') // the mock app says yes
    await flush()
    expect(t.host.state.link?.player).toBe('remote')
    expect(app.state.player).toBe('remote')
    expect(t.host.state.appState).toMatchObject({ scriptTitle: 'Tilw app (mock)', paragraph: 0 })

    await t.host.send('next')
    await flush()
    expect(app.state.paragraph).toBe(1)
    expect(t.host.state.appState?.paragraph).toBe(1)
    expect(t.host.state.lastResult).toEqual({ type: 'next', outcome: 'applied' })
    expect(t.page.applied).toEqual([]) // the studio page never moved

    await t.host.requestRoles('host')
    await flush()
    expect(t.host.state.link?.player).toBe('host')
    expect(t.host.state.appState).toBeNull()
    app.stop()
  })

  it("the app's own role request reaches the studio, which can answer it", async () => {
    const app = await t.appTab.knobs.pairMockApp(t.host.state.code!.code)
    await flush()
    await app.askToRead()
    await flush()
    expect(t.host.state.roleRequest).toMatchObject({ player: 'remote' })
    await t.host.answerRoles(true)
    await flush()
    expect(t.host.state.link?.player).toBe('remote')
    app.stop()
  })

  it('a browser phone can never be asked to read', async () => {
    const p = phone(t)
    await p.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.host.requestRoles('remote')
    expect(t.host.state.error).toBeTruthy()
    expect(t.host.state.link?.player).toBe('host')
    p.dispose()
  })

  it('ending from the studio ends it on both sides', async () => {
    const p = phone(t)
    await p.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.host.end()
    await flush()
    expect(linkStatus(t.host.state)).toBe('ended')
    expect(p.state).toMatchObject({ phase: 'ended', ended: 'owner' })
    p.dispose()
  })
})

/** Two studio tabs sharing one lock, as the Web Locks API gives them. */
function lockPair() {
  let holder: number | null = null
  const releaseCbs = new Map<number, Set<() => void>>()
  const tab = (n: number): HostTab => ({
    async acquire() { if (holder === null || holder === n) { holder = n; return true } return false },
    release() { if (holder === n) holder = null },
    onReleaseRequested(cb) {
      const set = releaseCbs.get(n) ?? new Set()
      releaseCbs.set(n, set); set.add(cb)
      return () => { set.delete(cb) }
    },
    async takeOver() {
      if (holder !== null && holder !== n) releaseCbs.get(holder)?.forEach(cb => cb())
      if (holder === null) { holder = n; return true }
      return false
    },
  })
  return { a: tab(1), b: tab(2), holder: () => holder }
}

describe('US4: one hosting tab (T040)', () => {
  it('a second tab sees the link held elsewhere; Move here hands it over and only that tab applies commands', async () => {
    const kv = memoryKV()
    const net = memoryNetwork()
    const tabA = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
    await tabA.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const tabB = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
    const phoneTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
    const scriptId = (await tabA.services.scripts.list())[0]!.id
    const locks = lockPair()
    const hostA = createLinkHost({ ...tabA.services, tab: locks.a, coalesceMs: 0 })
    const hostB = createLinkHost({ ...tabB.services, tab: locks.b, coalesceMs: 0 })
    const pageA = fakePlayer(scriptId)
    const pageB = fakePlayer(scriptId)
    hostA.setPlayer(pageA.player)
    hostB.setPlayer(pageB.player)

    await hostA.open(scriptId)
    const remote = createLinkRemote({ relay: phoneTab.services.relay, realtime: phoneTab.services.realtime, store: memoryPairingStore() })
    await remote.pairWithCode(hostA.state.code!.code)
    await flush()

    await hostB.open(scriptId)
    expect(hostB.state.phase).toBe('otherTab')

    await hostB.moveHere(scriptId)
    await flush()
    expect(locks.holder()).toBe(2)
    expect(hostA.state.phase).toBe('otherTab')
    expect(hostB.state.phase).toBe('open')

    await remote.send('next')
    await flush()
    expect(pageB.applied.map(c => c.type)).toEqual(['next'])
    expect(pageA.applied).toEqual([])
    hostA.reset(); hostB.reset(); remote.dispose()
  })
})
