/**
 * Feature 004, US3 (T035, SC-005): the link never stops a take. With a take running, the phone leaving, going
 * offline, being replaced or the link ending must not call the recorder's stop; only a `recordStop` command does.
 * Also covers the record page's command mapping and the recording state the phone sees (T037).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { createLinkHost, type LinkPlayer } from '~/services/link/host'
import { createLinkRemote, memoryPairingStore } from '~/services/link/remote'
import { applyRecordCommand, recordingState, type RecordContext, type StudioPhase } from '~/utils/linkCommands'
import type { StudioState } from '~/services/types'

const noSleep = () => Promise.resolve()
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

/** A recording studio as the link sees it: its own Start / Stop, spied on. */
function fakeStudio(scriptId: string) {
  const s = { phase: 'setup' as StudioPhase, devicesOn: true, saving: false, starts: 0, stops: 0, cancels: 0 }
  const ctx = (): RecordContext => ({
    phase: s.phase, devicesOn: s.devicesOn, saving: s.saving, ready: true,
    start: () => { s.starts++; s.phase = 'recording' },
    stop: () => { s.stops++; s.phase = 'setup' },
    cancelCountdown: () => { s.cancels++; s.phase = 'setup' },
  })
  const player: LinkPlayer = {
    scriptId,
    apply: cmd => applyRecordCommand(cmd, ctx()),
    snapshot: (): Omit<StudioState, 'seq'> => ({
      scriptTitle: 'افتتاحية', paragraph: 0, paragraphCount: 3, playing: s.phase === 'recording', mode: 'constant',
      wpm: 120, fontSize: 'M', preview: { current: 'فقرة', next: null },
      recording: recordingState({ phase: s.phase, devicesOn: s.devicesOn, saving: s.saving, saved: false, failed: false, startedAt: '2026-11-24T10:00:00.000Z' }),
    }),
  }
  return { s, player }
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
  const remote = createLinkRemote({ relay: phoneTab.services.relay, realtime: phoneTab.services.realtime, store, ackTimeoutMs: 500 })
  const studio = fakeStudio(scriptId)
  host.setPlayer(studio.player)
  await host.open(scriptId)
  await remote.pairWithCode(host.state.code!.code)
  await flush()
  await remote.send('recordStart')
  await flush()
  return { studioTab, phoneTab, scriptId, host, remote, store, studio, net }
}

describe('the link never stops a take (T035, SC-005)', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => (t = await setup()))
  afterEach(() => { t.host.reset(); t.remote.dispose() })

  it('Record from the phone starts the take through the studio and the phone sees it recording', () => {
    expect(t.studio.s).toMatchObject({ phase: 'recording', starts: 1 })
    expect(t.remote.state.state?.recording).toEqual({ state: 'recording', startedAt: '2026-11-24T10:00:00.000Z' })
  })

  it('the phone going offline, coming back or leaving leaves the take running', async () => {
    t.phoneTab.hub.setOffline(true)
    await flush()
    t.phoneTab.hub.setOffline(false)
    await flush()
    await t.remote.leave()
    await flush()
    expect(t.studio.s).toMatchObject({ phase: 'recording', stops: 0 })
  })

  it('the link ending, or the studio closing its connection, leaves the take running', async () => {
    await t.host.end()
    await flush()
    t.host.reset()
    await flush()
    expect(t.studio.s).toMatchObject({ phase: 'recording', stops: 0 })
  })

  it('another phone taking over leaves the take running', async () => {
    t.phoneTab.hub.publish(t.store.value!.channels.own, { name: 'remote.replaced', data: {} } as never)
    await flush()
    expect(t.remote.state.phase).toBe('ended')
    expect(t.studio.s).toMatchObject({ phase: 'recording', stops: 0 })
  })

  it('only a recordStop command stops it', async () => {
    await t.remote.send('recordStop')
    await flush()
    expect(t.studio.s).toMatchObject({ phase: 'setup', stops: 1 })
    expect(t.remote.state.lastResult).toEqual({ type: 'recordStop', outcome: 'applied' })
  })
})

describe('record commands and the recording state (T037)', () => {
  const ctx = (over: Partial<RecordContext> = {}) => {
    const calls: string[] = []
    const c: RecordContext = {
      phase: 'setup', devicesOn: true, saving: false, ready: true,
      start: () => calls.push('start'), stop: () => calls.push('stop'), cancelCountdown: () => calls.push('cancel'), ...over,
    }
    return { c, calls }
  }
  const cmd = (type: 'recordStart' | 'recordStop') => ({ id: 'c1', type })

  it('refuses Record with the studio’s reason', () => {
    expect(applyRecordCommand(cmd('recordStart'), ctx({ devicesOn: false }).c)).toEqual({ result: 'refused', reason: 'devices_off' })
    expect(applyRecordCommand(cmd('recordStart'), ctx({ phase: 'recording' }).c)).toEqual({ result: 'refused', reason: 'already_recording' })
    expect(applyRecordCommand(cmd('recordStart'), ctx({ phase: 'countdown' }).c)).toEqual({ result: 'refused', reason: 'already_recording' })
    expect(applyRecordCommand(cmd('recordStart'), ctx({ saving: true }).c)).toEqual({ result: 'refused', reason: 'saving' })
    const ok = ctx()
    expect(applyRecordCommand(cmd('recordStart'), ok.c)).toEqual({ result: 'applied' })
    expect(ok.calls).toEqual(['start'])
  })

  it('Stop ends a take, cancels a countdown, and is refused when nothing records', () => {
    expect(applyRecordCommand(cmd('recordStop'), ctx().c)).toEqual({ result: 'refused', reason: 'not_recording' })
    expect(applyRecordCommand(cmd('recordStop'), ctx({ phase: 'recording', saving: true }).c)).toEqual({ result: 'refused', reason: 'saving' })
    const cd = ctx({ phase: 'countdown' })
    expect(applyRecordCommand(cmd('recordStop'), cd.c)).toEqual({ result: 'applied' })
    expect(cd.calls).toEqual(['cancel'])
    const rec = ctx({ phase: 'recording' })
    applyRecordCommand(cmd('recordStop'), rec.c)
    expect(rec.calls).toEqual(['stop'])
  })

  it('maps the studio phase to what the phone shows', () => {
    const base = { phase: 'setup' as StudioPhase, devicesOn: false, saving: false, saved: false, failed: false, startedAt: null }
    expect(recordingState(base)).toEqual({ state: 'unavailable' })
    expect(recordingState({ ...base, devicesOn: true })).toEqual({ state: 'idle' })
    expect(recordingState({ ...base, phase: 'countdown' })).toEqual({ state: 'countdown' })
    expect(recordingState({ ...base, phase: 'recording', startedAt: 'T' })).toEqual({ state: 'recording', startedAt: 'T' })
    expect(recordingState({ ...base, phase: 'recording', saving: true })).toEqual({ state: 'saving' })
    expect(recordingState({ ...base, saved: true })).toEqual({ state: 'saved' })
    expect(recordingState({ ...base, failed: true })).toEqual({ state: 'failed' })
  })
})
