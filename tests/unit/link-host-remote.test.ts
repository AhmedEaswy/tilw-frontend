/**
 * Feature 004, US1 (T020, T021) and US2 (T030): the studio side (services/link/host.ts) and the phone side (services/link/remote.ts)
 * talking through the two-tab mock, as the studio page and /remote do.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createLinkHost, linkStatus, type LinkPlayer } from '~/services/link/host'
import { createLinkRemote, memoryPairingStore } from '~/services/link/remote'
import type { LinkCommand, StudioState } from '~/services/types'

const noSleep = () => Promise.resolve()
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

/** A reading page as the store sees it: a paragraph index and the page's own controls. */
function fakePlayer(scriptId: string, total = 3) {
  const p = { paragraph: 0, playing: false, wpm: 120, applied: [] as LinkCommand[] }
  const player: LinkPlayer = {
    scriptId,
    apply(cmd) {
      p.applied.push(cmd)
      if (cmd.type === 'next') {
        if (p.paragraph >= total - 1) return { result: 'refused', reason: 'at_end' }
        p.paragraph++
      }
      if (cmd.type === 'play') p.playing = true
      if (cmd.type === 'faster') p.wpm += 10
      if (cmd.type === 'recordStart') return { result: 'refused', reason: 'not_recording_mode' }
      return { result: 'applied' }
    },
    snapshot(): Omit<StudioState, 'seq'> {
      return {
        scriptTitle: 'افتتاحية', paragraph: p.paragraph, paragraphCount: total, playing: p.playing, mode: 'constant',
        wpm: p.wpm, fontSize: 'M', recording: { state: 'unavailable' }, preview: { current: `فقرة ${p.paragraph + 1}`, next: null },
      }
    },
  }
  return { p, player }
}

async function setup() {
  const kv = memoryKV()
  const net = memoryNetwork()
  const studioTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  await studioTab.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  const phoneTab = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const scriptId = (await studioTab.services.scripts.list())[0]!.id
  const host = createLinkHost({ ...studioTab.services, coalesceMs: 0 })
  const store = memoryPairingStore()
  const remote = createLinkRemote({ relay: phoneTab.services.relay, realtime: phoneTab.services.realtime, store, ackTimeoutMs: 200 })
  return { studioTab, phoneTab, scriptId, host, remote, store }
}

describe('studio side (host)', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => { t.host.reset(); t.remote.dispose() })

  it('opens a link waiting with a code, and is connected once the phone joins, sending its full state', async () => {
    const { player } = fakePlayer(t.scriptId)
    t.host.setPlayer(player)
    await t.host.open(t.scriptId)
    expect(linkStatus(t.host.state)).toBe('waiting')
    expect(t.host.state.code?.code).toMatch(/^\d{6}$/)

    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    expect(linkStatus(t.host.state)).toBe('connected')
    expect(t.host.state.link?.remote?.kind).toBe('browser')
    expect(t.remote.state.phase).toBe('connected')
    expect(t.remote.state.studioPresent).toBe(true)
    expect(t.remote.state.state).toMatchObject({ paragraph: 0, paragraphCount: 3, scriptTitle: 'افتتاحية' })
  })

  it('applies commands through the player and answers them; the phone shows each result', async () => {
    const { p, player } = fakePlayer(t.scriptId)
    t.host.setPlayer(player)
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()

    await t.remote.send('next')
    await flush()
    expect(p.paragraph).toBe(1)
    expect(t.remote.state.lastResult).toEqual({ type: 'next', outcome: 'applied' })
    expect(t.remote.state.state?.paragraph).toBe(1)

    await t.remote.send('next')
    await t.remote.send('next')
    await flush()
    expect(t.remote.state.lastResult).toEqual({ type: 'next', outcome: 'refused', reason: 'at_end' })
    await t.remote.send('recordStart')
    await flush()
    expect(t.remote.state.lastResult).toMatchObject({ outcome: 'refused', reason: 'not_recording_mode' })
  })

  it('refuses commands with unsupported when no page reads this script', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.remote.send('play')
    await flush()
    expect(t.remote.state.lastResult).toEqual({ type: 'play', outcome: 'refused', reason: 'unsupported' })
    const other = fakePlayer('another-script')
    t.host.setPlayer(other.player)
    await t.remote.send('play')
    await flush()
    expect(other.p.applied).toHaveLength(0)
    expect(t.remote.state.lastResult?.reason).toBe('unsupported')
  })

  it('coalesces state sends and keeps seq increasing', async () => {
    const { player } = fakePlayer(t.scriptId)
    const host = createLinkHost({ ...t.studioTab.services, coalesceMs: 40 })
    host.setPlayer(player)
    await host.open(t.scriptId)
    await t.remote.pairWithCode(host.state.code!.code)
    await flush()
    const seqs: number[] = []
    t.remote.subscribe(s => s.state && seqs.at(-1) !== s.state.seq && seqs.push(s.state.seq))
    for (let i = 0; i < 5; i++) host.changed()
    await new Promise(r => setTimeout(r, 120))
    await flush()
    // The burst of five changes went out as one state.
    expect(seqs.length).toBeLessThanOrEqual(3)
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
    host.reset()
  })

  it('shows locked when the plan refuses, and unavailable without a realtime server', async () => {
    const me = (await t.studioTab.services.auth.me())!
    t.studioTab.db.write(s => ((s.overrides[me.id] ??= {})['phone_link.allowed'] = false))
    await t.host.open(t.scriptId)
    expect(linkStatus(t.host.state)).toBe('locked')

    const noServer = createLinkHost({ ...t.studioTab.services, realtime: { settings: () => null, connect: () => { throw new Error('no') } } })
    await noServer.open(t.scriptId)
    expect(linkStatus(noServer.state)).toBe('unavailable')
  })

  it('ending from the studio tells the phone, which forgets its pairing', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    expect(t.store.value).not.toBeNull()
    await t.host.end()
    await flush()
    expect(linkStatus(t.host.state)).toBe('ended')
    expect(t.remote.state).toMatchObject({ phase: 'ended', ended: 'owner' })
    expect(t.store.value).toBeNull()
  })

  it('keeps the fresh code when Connect phone is pressed while the page is still resuming', async () => {
    // The page asks for an open link on load; the person presses Connect phone before the answer comes back.
    const resuming = t.host.resume(t.scriptId)
    await t.host.open(t.scriptId)
    await resuming
    expect(t.host.state.code?.code).toMatch(/^\d{6}$/)
    expect(linkStatus(t.host.state)).toBe('waiting')
  })

  it('resumes an open link after a studio reload without a new code', async () => {
    const { player } = fakePlayer(t.scriptId)
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    t.host.reset() // the tab reloads: nothing in memory
    const again = createLinkHost({ ...t.studioTab.services, coalesceMs: 0 })
    again.setPlayer(player)
    await again.resume(t.scriptId)
    await flush()
    expect(again.state.code).toBeNull()
    expect(linkStatus(again.state)).toBe('connected')
    again.reset()
  })
})

describe('phone side (remote)', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => { t.host.reset(); t.remote.dispose() })

  it('pairs from the QR secret and stores the pairing', async () => {
    await t.host.open(t.scriptId)
    await t.remote.start(t.host.state.code!.url.split('#')[1])
    expect(t.remote.state.phase).toBe('connected')
    expect(t.store.value?.credential).toMatch(/^rl_/)
  })

  it('shows one message for a wrong code, then too many tries', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode('111111')
    expect(t.remote.state).toMatchObject({ phase: 'start', pairError: 'invalid' })
    for (let i = 0; i < 5; i++) await t.remote.pairWithCode('111111')
    expect(t.remote.state.pairError).toBe('tooMany')
  })

  it('marks a command not delivered when the studio is gone, and ignores a late answer', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    t.host.reset() // studio tab closed: it leaves presence
    await flush()
    await t.remote.send('next')
    await flush()
    expect(t.remote.state.lastResult).toEqual({ type: 'next', outcome: 'notDelivered' })
    expect(t.remote.state.studioPresent).toBe(false)
  })

  it('times out after 5 s (here 200 ms) without an answer', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    // A studio that receives commands but never answers.
    const silent = { ...t.studioTab.services.relay, ack: () => Promise.resolve() }
    t.host.reset()
    const mute = createLinkHost({ ...t.studioTab.services, relay: silent, coalesceMs: 0 })
    await mute.resume(t.scriptId)
    await flush()
    await t.remote.send('play')
    expect(t.remote.state.lastResult?.outcome).toBe('sending')
    await new Promise(r => setTimeout(r, 260))
    expect(t.remote.state.lastResult).toEqual({ type: 'play', outcome: 'notDelivered' })
    mute.reset()
  })

  it('drops a state that is not newer than the one shown', async () => {
    const { player } = fakePlayer(t.scriptId)
    t.host.setPlayer(player)
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    const shown = t.remote.state.state!.seq
    // An old state arriving late through the hub.
    t.phoneTab.hub.publish(t.store.value!.channels.own, { name: 'state', data: { ...player.snapshot(), seq: shown - 1, paragraph: 2 } as StudioState })
    expect(t.remote.state.state!.seq).toBe(shown)
    expect(t.remote.state.state!.paragraph).toBe(0)
  })

  it('reconnects with a recent stored pairing, and forgets an old one', async () => {
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    t.remote.dispose()
    const again = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store: t.store })
    await again.start(null)
    expect(again.state.phase).toBe('connected')
    again.dispose()

    t.store.value!.lastSeenAt = Date.now() - 11 * 60_000
    const stale = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store: t.store })
    await stale.start(null)
    // US2: a pairing kept more than 10 minutes is forgotten and the phone says the link ended (L6 `284:414`).
    expect(stale.state).toMatchObject({ phase: 'ended', ended: 'idle' })
    expect(t.store.value).toBeNull()
  })
})

describe('US2: a dropped signal (T030)', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => { t.host.reset(); t.remote.dispose() })

  async function paired() {
    const fake = fakePlayer(t.scriptId)
    t.host.setPlayer(fake.player)
    await t.host.open(t.scriptId)
    await t.remote.pairWithCode(t.host.state.code!.code)
    await flush()
    return fake
  }

  it('shows the phone offline in the studio, then connected again with the full state re-sent', async () => {
    const { p } = await paired()
    expect(linkStatus(t.host.state)).toBe('connected')
    t.phoneTab.hub.setOffline(true)
    await flush()
    expect(linkStatus(t.host.state)).toBe('partnerOffline')
    expect(t.remote.state.connection).toBe('unavailable')

    p.paragraph = 2 // the studio moved on while the phone was away
    t.phoneTab.hub.setOffline(false)
    await flush(12)
    expect(linkStatus(t.host.state)).toBe('connected')
    expect(t.remote.state.state?.paragraph).toBe(2)
  })

  it("disables the phone's controls while its own connection is unavailable", async () => {
    await paired()
    t.phoneTab.hub.setOffline(true)
    await flush()
    const live = t.remote.state.studioPresent && t.remote.state.connection === 'connected'
    expect(live).toBe(false)
    await t.remote.send('next')
    await flush()
    expect(t.remote.state.lastResult?.outcome).toBe('notDelivered')
  })

  it('wake(): reconnects a dropped phone, and ends one unused for 10 minutes', async () => {
    await paired()
    t.phoneTab.hub.setOffline(true)
    await flush()
    t.phoneTab.hub.setOffline(false)
    await t.remote.wake()
    await flush(12)
    expect(t.remote.state).toMatchObject({ phase: 'connected', connection: 'connected', studioPresent: true })

    t.store.value!.lastSeenAt = Date.now() - 11 * 60_000
    const later = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store: t.store, now: () => Date.now() + 11 * 60_000 })
    await later.start(null)
    expect(later.state).toMatchObject({ phase: 'ended', ended: 'idle' })
    later.dispose()
  })

  it('a reload whose credential the service refuses (401) forgets the pairing and shows the link ended', async () => {
    await paired()
    t.remote.dispose()
    await t.host.end() // ended while the phone was closed: its event never arrived
    await flush()
    const reopened = createLinkRemote({ relay: t.phoneTab.services.relay, realtime: t.phoneTab.services.realtime, store: t.store })
    await reopened.start(null)
    expect(reopened.state).toMatchObject({ phase: 'ended', ended: 'unknown' })
    expect(t.store.value).toBeNull()
    reopened.dispose()
  })

  it('the phone takes the states of a reloaded studio, whose numbering starts over', async () => {
    const { p } = await paired()
    p.paragraph = 2
    t.host.changed()
    await flush()
    expect(t.remote.state.state?.paragraph).toBe(2)
    t.host.reset() // the studio tab reloads
    await flush()
    const again = createLinkHost({ ...t.studioTab.services, coalesceMs: 0 })
    const fresh = fakePlayer(t.scriptId) // a reloaded page starts at the first paragraph
    again.setPlayer(fresh.player)
    await again.resume(t.scriptId)
    await flush(12)
    expect(t.remote.state.state?.paragraph).toBe(0)
    again.reset()
  })

  it('a studio back online learns the link ended meanwhile, and why', async () => {
    await paired()
    const id = t.host.state.link!.id
    t.studioTab.hub.setOffline(true)
    await flush()
    t.studioTab.knobs.endLink(id, 'idle') // ended while the studio was offline: its event never arrived
    t.studioTab.hub.setOffline(false)
    await flush(12)
    expect(t.host.state).toMatchObject({ phase: 'ended', endReason: 'idle' })
  })
})
