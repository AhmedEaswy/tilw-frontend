/**
 * Feature 004: regressions for the PR #2 review (host lookups without the sign-in redirect, seq never going back,
 * a failed open letting go of what it started, a phone recovering from a failed subscribe, the record page keeping a
 * take whose save failed).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createLinkHost, type HostTab, type LinkPlayer } from '~/services/link/host'
import { createLinkRemote, memoryPairingStore } from '~/services/link/remote'
import { applyRecordCommand } from '~/utils/linkCommands'
import { PortError, type RealtimeConnection, type RealtimePort, type StudioState } from '~/services/types'

const noSleep = () => Promise.resolve()
const flush = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

function player(scriptId: string): LinkPlayer {
  return {
    scriptId,
    apply: () => ({ result: 'applied' }),
    snapshot: (): Omit<StudioState, 'seq'> => ({
      scriptTitle: 'T', paragraph: 0, paragraphCount: 2, playing: false, mode: 'constant', wpm: 120, fontSize: 'M',
      recording: { state: 'unavailable' }, preview: { current: 'a', next: null },
    }),
  }
}

async function setup() {
  const kv = memoryKV()
  const net = memoryNetwork()
  const studioTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  await studioTab.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  const phoneTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const scriptId = (await studioTab.services.scripts.list())[0]!.id
  return { studioTab, phoneTab, scriptId }
}

describe('PR #2 review fixes', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => {})

  it("the host's own lookups go through the quiet port (no sign-in redirect mid-take)", async () => {
    const calls: string[] = []
    const base = t.studioTab.services.links
    const host = createLinkHost({
      ...t.studioTab.services,
      coalesceMs: 0,
      quietLinks: { current: (id) => { calls.push('current'); return base.current(id) }, list: () => { calls.push('list'); return base.list() } },
      links: { ...base, current: () => Promise.reject(new Error('guarded port used')), list: () => Promise.reject(new Error('guarded port used')) },
    })
    host.setPlayer(player(t.scriptId))
    await host.open(t.scriptId)
    await flush()
    t.studioTab.hub.setOffline(true) // the studio drops and comes back: it checks the link on its own
    await flush()
    t.studioTab.hub.setOffline(false)
    await flush()
    expect(calls).toContain('current')
    expect(host.state.phase).toBe('open')
    host.reset()
  })

  it('a reset and reopened studio still numbers its states above what the phone showed', async () => {
    const host = createLinkHost({ ...t.studioTab.services, coalesceMs: 0 })
    host.setPlayer(player(t.scriptId))
    const store = memoryPairingStore()
    const remote = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store })
    await host.open(t.scriptId)
    await remote.pairWithCode(host.state.code!.code)
    await flush()
    const before = remote.state.state!.seq
    host.reset()
    await flush()
    await host.resume(t.scriptId)
    await flush()
    expect(remote.state.state!.seq).toBeGreaterThan(before)
    host.reset(); remote.dispose()
  })

  it('a failed open lets go of the tab lock and the connection', async () => {
    let released = 0
    const tab: HostTab = { acquire: async () => true, release: () => { released++ }, onReleaseRequested: () => () => {}, takeOver: async () => true }
    const broken: RealtimePort = {
      settings: () => ({ key: 'k', host: 'h', port: 1, scheme: 'http' }),
      connect: (): RealtimeConnection => ({
        state: 'connecting', onState: () => () => {}, close: () => {},
        subscribe: () => Promise.reject(new PortError('network')), presence: () => Promise.reject(new PortError('network')),
      }),
    }
    const host = createLinkHost({ ...t.studioTab.services, realtime: broken, tab })
    await host.open(t.scriptId)
    expect(host.state.phase).toBe('error')
    expect(released).toBe(1)
  })

  it('a phone whose subscribe failed reconnects on wake()', async () => {
    const host = createLinkHost({ ...t.studioTab.services, coalesceMs: 0 })
    host.setPlayer(player(t.scriptId))
    await host.open(t.scriptId)
    let fail = true
    const real = t.phoneTab.services.realtime
    const flaky: RealtimePort = {
      settings: () => real.settings(),
      connect: (auth, settings) => {
        const c = real.connect(auth, settings)
        if (!fail) return c
        return { ...c, get state() { return c.state }, subscribe: () => Promise.reject(new PortError('network')) }
      },
    }
    const remote = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: flaky, store: memoryPairingStore() })
    await remote.pairWithCode(host.state.code!.code)
    expect(remote.state.connection).toBe('unavailable')
    fail = false
    await remote.wake()
    await flush()
    expect(remote.state).toMatchObject({ phase: 'connected', connection: 'connected', studioPresent: true })
    host.reset(); remote.dispose()
  })

  it('Record from the phone is refused while a take that failed to save waits for its download', () => {
    const calls: string[] = []
    const answer = applyRecordCommand({ id: 'c', type: 'recordStart' }, {
      phase: 'setup', devicesOn: true, saving: true /* unsaved take pending */, ready: true,
      start: () => calls.push('start'), stop: () => {}, cancelCountdown: () => {},
    })
    expect(answer).toEqual({ result: 'refused', reason: 'saving' })
    expect(calls).toEqual([])
  })
})
