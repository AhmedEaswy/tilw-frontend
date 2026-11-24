/**
 * Feature 004 (T013): phone-link ports. The mock adapter runs a whole link between two "tabs" (two mock backends on one
 * KV and one memory network), with the backend 003 rules. The HTTP adapter is checked for the exact routes, headers and
 * bodies of contracts/ports.md, and its realtime side against a fake Pusher.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createHttpRealtime, type PusherChannelLike, type PusherLike } from '~/services/http/realtime'
import { createHttpClient } from '~/services/http/client'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError, type LinkAuth, type LinkEvent, type PresenceMember, type StudioState } from '~/services/types'

const noSleep = () => Promise.resolve()

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isPortError(e) ? e.code : String(e)
  }
}

const state = (seq: number, preview = true): StudioState => ({
  seq, scriptTitle: 'افتتاحية', paragraph: 1, paragraphCount: 3, playing: false, mode: 'constant', wpm: 120, fontSize: 'M',
  recording: { state: 'unavailable' }, ...(preview ? { preview: { current: 'كل حكاية تبدأ', next: 'ماذا أريد' } } : {}),
})

/** Two tabs of one browser: the studio (signed in) and the phone. */
async function twoTabs() {
  const kv = memoryKV()
  const net = memoryNetwork()
  const studio = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  await studio.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  const phone = createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const scriptId = (await studio.services.scripts.list())[0]!.id
  return { kv, net, studio, phone, scriptId }
}

function collect() {
  const events: LinkEvent[] = []
  return { events, on: (e: LinkEvent) => events.push(e), names: () => events.map(e => e.name) }
}

describe('mock link: starting and pairing', () => {
  let t: Awaited<ReturnType<typeof twoTabs>>
  beforeEach(async () => (t = await twoTabs()))

  it('starts a link with a 6-digit code and a remote address, and reuses the open link with a fresh code', async () => {
    const a = await t.studio.services.links.start(t.scriptId)
    expect(a.code.code).toMatch(/^\d{6}$/)
    expect(a.code.url).toMatch(/^http:\/\/test\/remote#\w{32}$/)
    expect(a.state).toBe('waiting')
    const b = await t.studio.services.links.start(t.scriptId)
    expect(b.id).toBe(a.id)
    // The first code stopped working when the new one was made.
    expect(await code(t.phone.services.relay.pair({ code: a.code.code }))).toBe(a.code.code === b.code.code ? 'ok' : 'token_invalid')
  })

  it('pairs by code or by the QR secret, once; wrong, used and expired codes give the same answer', async () => {
    const link = await t.studio.services.links.start(t.scriptId)
    const p = await t.phone.services.relay.pair({ secret: link.code.url.split('#')[1]! }, 'iPhone')
    expect(p.credential).toMatch(/^rl_[0-9a-f]{40}$/)
    expect(p.remote).toMatchObject({ kind: 'browser', status: 'active', name: 'iPhone' })
    expect(p.channels).toEqual({ own: `private-link.${link.id}.remote.${p.remote.id}`, presence: `presence-link.${link.id}` })
    expect(p.link.state).toBe('connected')
    expect(await code(t.phone.services.relay.pair({ code: link.code.code }))).toBe('token_invalid')
    expect(await code(t.phone.services.relay.pair({ code: '000000' }))).toBe('token_invalid')

    const fresh = await t.studio.services.links.newCode(link.id)
    t.studio.db.setKnobs({ clockOffsetMs: 6 * 60_000 })
    t.phone.db.reload()
    expect(await code(t.phone.services.relay.pair({ code: fresh.code }))).toBe('token_invalid')
  })

  it('refuses the 6th wrong code with rate_limited, even a right one', async () => {
    const link = await t.studio.services.links.start(t.scriptId)
    for (let i = 0; i < 5; i++) expect(await code(t.phone.services.relay.pair({ code: '999999' }))).toBe('token_invalid')
    expect(await code(t.phone.services.relay.pair({ code: '999998' }))).toBe('rate_limited')
    expect(await code(t.phone.services.relay.pair({ code: link.code.code }))).toBe('rate_limited')
  })

  it('refuses to start when the plan does not allow phone link', async () => {
    const me = (await t.studio.services.auth.me())!
    t.studio.db.write(s => ((s.overrides[me.id] ??= {})['phone_link.allowed'] = false))
    const e = await t.studio.services.links.start(t.scriptId).catch(x => x)
    expect(isPortError(e, 'limit_reached')).toBe(true)
    expect(e.limit.key).toBe('phone_link.allowed')
  })
})

describe('mock link: relay and channels', () => {
  let t: Awaited<ReturnType<typeof twoTabs>>
  let linkId: string
  let phoneAuth: LinkAuth
  let own: string
  const host: LinkAuth = { kind: 'session' }

  beforeEach(async () => {
    t = await twoTabs()
    const link = await t.studio.services.links.start(t.scriptId)
    linkId = link.id
    const p = await t.phone.services.relay.pair({ code: link.code.code })
    phoneAuth = { kind: 'remote', credential: p.credential! }
    own = p.channels.own
  })

  async function connectBoth() {
    const rt = { key: 'mock', host: 'mock', port: 0, scheme: 'https' as const }
    const studioConn = t.studio.services.realtime.connect(host, rt)
    const phoneConn = t.phone.services.realtime.connect(phoneAuth, rt)
    const studio = collect()
    const phone = collect()
    const seen: PresenceMember[][] = []
    await studioConn.subscribe(`private-link.${linkId}.host`, studio.on)
    await studioConn.presence(`presence-link.${linkId}`, { members: m => seen.push(m), added: () => {}, removed: () => {} })
    await phoneConn.subscribe(own, phone.on)
    await phoneConn.presence(`presence-link.${linkId}`, { members: () => {}, added: () => {}, removed: () => {} })
    return { studioConn, phoneConn, studio, phone }
  }

  it('refuses a command while the studio is not connected (partner_offline), never delivering it later', async () => {
    expect(await code(t.phone.services.relay.command(phoneAuth, linkId, { id: crypto.randomUUID(), type: 'next' }))).toBe('partner_offline')
  })

  it('routes a command to the studio, its ack and the state back to the phone; previews follow the setting', async () => {
    const { studio, phone } = await connectBoth()
    const id = crypto.randomUUID()
    await t.phone.services.relay.command(phoneAuth, linkId, { id, type: 'next' })
    expect(studio.events).toEqual([{ name: 'command', data: { id, type: 'next' } }])
    await t.studio.services.relay.ack(host, linkId, { commandId: id, result: 'refused', reason: 'at_end' })
    await t.studio.services.relay.state(host, linkId, state(1))
    expect(phone.names()).toEqual(['ack', 'state'])
    expect((phone.events[1]!.data as StudioState).preview?.current).toBe('كل حكاية تبدأ')

    await t.studio.services.links.update(linkId, { previews: false })
    await t.studio.services.relay.state(host, linkId, state(2))
    const last = phone.events.at(-1)!
    expect(last.name).toBe('state')
    expect(last.data).not.toHaveProperty('preview')
    expect(phone.names()).toContain('link.updated')
  })

  it('only the player answers, and the player does not send commands', async () => {
    await connectBoth()
    expect(await code(t.studio.services.relay.command(host, linkId, { id: crypto.randomUUID(), type: 'next' }))).toBe('conflict')
    expect(await code(t.phone.services.relay.ack(phoneAuth, linkId, { commandId: crypto.randomUUID(), result: 'applied' }))).toBe('conflict')
  })

  it('keeps channels private to their party', async () => {
    const rt = { key: 'mock', host: 'mock', port: 0, scheme: 'https' as const }
    const phoneConn = t.phone.services.realtime.connect(phoneAuth, rt)
    expect(await code(phoneConn.subscribe(`private-link.${linkId}.host`, () => {}))).toBe('unauthenticated')
    const stranger = t.phone.services.realtime.connect({ kind: 'remote', credential: 'rl_nope' }, rt)
    expect(await code(stranger.subscribe(own, () => {}))).toBe('unauthenticated')
  })

  it('a second phone waits; accepting it replaces the first, whose credential stops working', async () => {
    const { studio } = await connectBoth()
    const fresh = await t.studio.services.links.newCode(linkId)
    const second = await t.phone.services.relay.pair({ code: fresh.code }, 'Galaxy')
    expect(second.remote.status).toBe('pending')
    expect(studio.names()).toContain('remote.requested')
    const secondEvents = collect()
    const rt = { key: 'mock', host: 'mock', port: 0, scheme: 'https' as const }
    await t.phone.services.realtime.connect({ kind: 'remote', credential: second.credential! }, rt).subscribe(second.channels.own, secondEvents.on)

    const firstEvents = collect()
    await t.phone.services.realtime.connect(phoneAuth, rt).subscribe(own, firstEvents.on)
    const after = await t.studio.services.links.acceptRemote(linkId, second.remote.id)
    expect(after.remote?.id).toBe(second.remote.id)
    expect(firstEvents.names()).toContain('remote.replaced')
    expect(secondEvents.names()).toContain('remote.accepted')
    expect(await code(t.phone.services.relay.ping(phoneAuth, linkId))).toBe('unauthenticated')
  })

  it('ending the link tells both sides and the credential stops working', async () => {
    const { studio, phone } = await connectBoth()
    await t.studio.services.links.end(linkId)
    expect(studio.events.at(-1)).toEqual({ name: 'link.ended', data: { reason: 'owner' } })
    expect(phone.events.at(-1)).toEqual({ name: 'link.ended', data: { reason: 'owner' } })
    expect(await code(t.phone.services.relay.ping(phoneAuth, linkId))).toBe('unauthenticated')
    const list = await t.studio.services.links.list()
    expect(list[0]).toMatchObject({ id: linkId, state: 'ended', endReason: 'owner' })
  })

  it('deleting the script ends its link with script_deleted', async () => {
    const { phone } = await connectBoth()
    await t.studio.services.scripts.remove(t.scriptId)
    expect(phone.events.at(-1)).toEqual({ name: 'link.ended', data: { reason: 'script_deleted' } })
  })

  it('the phone leaving ends the link with remote', async () => {
    const { studio } = await connectBoth()
    await t.phone.services.relay.leave(phoneAuth, linkId)
    expect(studio.events.at(-1)).toEqual({ name: 'link.ended', data: { reason: 'remote' } })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// HTTP adapter
// ---------------------------------------------------------------------------------------------------------------

interface Call { method: string; url: string; headers: Record<string, string>; body: unknown }

function fakeApi() {
  const calls: Call[] = []
  const cookies: Record<string, string> = { 'XSRF-TOKEN': 'tok' }
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      method: init.method ?? 'GET',
      url: String(url).replace('http://api.test', ''),
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as unknown as typeof fetch
  return { f, calls, cookies }
}

describe('http link adapter', () => {
  it('maps every method to the backend 003 route, signing phone calls with the rl_ credential', async () => {
    const api = fakeApi()
    const { services: s } = createHttpServices({ baseUrl: 'http://api.test', fetch: api.f, readCookie: n => api.cookies[n] ?? null })
    const phone: LinkAuth = { kind: 'remote', credential: 'rl_abc' }
    const host: LinkAuth = { kind: 'session' }
    await s.links.start('S1')
    await s.links.current()
    await s.links.list()
    await s.links.newCode('L1')
    await s.links.update('L1', { previews: false })
    await s.links.end('L1')
    await s.links.acceptRemote('L1', 'R2')
    await s.links.declineRemote('L1', 'R2')
    await s.relay.pair({ code: '123456' }, 'iPhone')
    await s.relay.command(phone, 'L1', { id: 'c1', type: 'speed', wpm: 140 })
    await s.relay.ack(host, 'L1', { commandId: 'c1', result: 'applied' })
    await s.relay.state(host, 'L1', state(3))
    await s.relay.ping(phone, 'L1')
    await s.relay.leave(phone, 'L1')
    await s.relay.requestRoles(host, 'L1', 'remote')
    await s.relay.answerRoles(host, 'L1', true)
    await s.relay.answerRoles(host, 'L1', false)

    expect(api.calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'POST /api/links', 'GET /api/links/current', 'GET /api/links', 'POST /api/links/L1/codes', 'PATCH /api/links/L1',
      'DELETE /api/links/L1', 'POST /api/links/L1/remotes/R2/accept', 'POST /api/links/L1/remotes/R2/decline',
      'POST /api/links/pair', 'POST /api/links/L1/commands', 'POST /api/links/L1/acks', 'PUT /api/links/L1/state',
      'POST /api/links/L1/ping', 'POST /api/links/L1/leave', 'POST /api/links/L1/roles', 'POST /api/links/L1/roles/accept',
      'POST /api/links/L1/roles/decline',
    ])
    expect(api.calls[0]!.body).toEqual({ scriptId: 'S1' })
    expect(api.calls[8]!.body).toEqual({ code: '123456', name: 'iPhone' })
    expect(api.calls[8]!.headers.Authorization).toBeUndefined()
    expect(api.calls[9]!.headers.Authorization).toBe('Bearer rl_abc')
    expect(api.calls[9]!.headers['X-XSRF-TOKEN']).toBe('tok')
    expect(api.calls[10]!.headers.Authorization).toBeUndefined()
  })

  it('maps 409 partner_offline to its own error code', async () => {
    const f = (async () => new Response(JSON.stringify({ code: 'partner_offline', message: 'x' }), { status: 409 })) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => 'tok' })
    expect(await code(services.relay.command({ kind: 'remote', credential: 'rl_x' }, 'L1', { id: 'c', type: 'next' }))).toBe('partner_offline')
  })
})

describe('http realtime adapter', () => {
  function fakePusher() {
    const channels = new Map<string, { binds: Map<string, (d: unknown) => void>; global: ((e: string, d: unknown) => void)[] }>()
    const stateCbs: ((s: { current: string }) => void)[] = []
    let options: Record<string, unknown> = {}
    const pusher: PusherLike = {
      connection: { state: 'connecting', bind: (_e, cb) => stateCbs.push(cb) },
      subscribe(name) {
        const rec = { binds: new Map<string, (d: unknown) => void>(), global: [] as ((e: string, d: unknown) => void)[] }
        channels.set(name, rec)
        const ch: PusherChannelLike = {
          // Like pusher-js, several handlers may be bound to one event.
          bind: (e, cb) => {
            const prev = rec.binds.get(e)
            rec.binds.set(e, prev ? (d: unknown) => { prev(d); cb(d) } : cb)
          },
          bind_global: cb => rec.global.push(cb),
          unbind_all: () => {},
        }
        return ch
      },
      unsubscribe: name => channels.delete(name),
      disconnect: () => {},
    }
    return {
      factory: (_k: string, o: Record<string, unknown>) => { options = o; return pusher },
      options: () => options,
      channels,
      state: (s: string) => stateCbs.forEach(cb => cb({ current: s })),
    }
  }

  it('authorises through /api/broadcasting/auth with the same credential and passes link events through', async () => {
    const api = fakeApi()
    const client = createHttpClient({ baseUrl: 'http://api.test', fetch: api.f, readCookie: n => api.cookies[n] ?? null })
    const fp = fakePusher()
    const rt = createHttpRealtime({ client, settings: { key: 'k', host: 'h.test', port: '8080' as unknown as number, scheme: 'http' }, factory: fp.factory })
    const settings = rt.settings()!
    expect(settings.port).toBe(8080)
    const conn = rt.connect({ kind: 'remote', credential: 'rl_abc' }, settings)
    const got: LinkEvent[] = []
    const sub = conn.subscribe('private-link.L1.remote.R1', e => got.push(e))
    await Promise.resolve(); await Promise.resolve()
    const ch = fp.channels.get('private-link.L1.remote.R1')!
    ch.binds.get('pusher:subscription_succeeded')!({})
    await sub
    ch.global.forEach(cb => cb('ack', { commandId: 'c1', result: 'applied' }))
    ch.global.forEach(cb => cb('pusher:pong', {}))
    expect(got).toEqual([{ name: 'ack', data: { commandId: 'c1', result: 'applied' } }])

    const opts = fp.options()
    expect(opts).toMatchObject({ wsHost: 'h.test', wsPort: 8080, forceTLS: false, activityTimeout: 5000, pongTimeout: 3000 })
    const auth = (opts.channelAuthorization as { customHandler: (p: unknown, cb: (e: unknown, d: unknown) => void) => void }).customHandler
    const signed = await new Promise(resolve => auth({ socketId: '1.2', channelName: 'private-link.L1.remote.R1' }, (_e, d) => resolve(d)))
    expect(signed).toEqual({ ok: true })
    const call = api.calls.at(-1)!
    expect(`${call.method} ${call.url}`).toBe('POST /api/broadcasting/auth')
    expect(call.body).toEqual({ socket_id: '1.2', channel_name: 'private-link.L1.remote.R1' })
    expect(call.headers.Authorization).toBe('Bearer rl_abc')

    const states: string[] = []
    conn.onState(s => states.push(s))
    fp.state('connected'); fp.state('unavailable')
    expect(states).toEqual(['connected', 'unavailable'])
  })

  it('maps presence members and refuses a channel the server does not authorise', async () => {
    const api = fakeApi()
    const client = createHttpClient({ baseUrl: 'http://api.test', fetch: api.f, readCookie: () => 'tok' })
    const fp = fakePusher()
    const rt = createHttpRealtime({ client, settings: { key: 'k', host: 'h', port: 443, scheme: 'https' }, factory: fp.factory })
    const conn = rt.connect({ kind: 'session' }, rt.settings()!)
    const members: PresenceMember[][] = []
    const added: PresenceMember[] = []
    const p = conn.presence('presence-link.L1', { members: m => members.push(m), added: m => added.push(m), removed: () => {} })
    await Promise.resolve(); await Promise.resolve()
    const ch = fp.channels.get('presence-link.L1')!
    ch.binds.get('pusher:subscription_succeeded')!({ each: (cb: (m: { id: string; info: unknown }) => void) => cb({ id: 'host', info: { party: 'host', remoteId: null } }) })
    await p
    ch.binds.get('pusher:member_added')!({ id: 'remote:R1', info: { party: 'remote', remoteId: 'R1' } })
    expect(members).toEqual([[{ id: 'host', party: 'host', remoteId: null }]])
    expect(added).toEqual([{ id: 'remote:R1', party: 'remote', remoteId: 'R1' }])

    const refused = conn.subscribe('private-link.L2.host', () => {})
    await Promise.resolve(); await Promise.resolve()
    fp.channels.get('private-link.L2.host')!.binds.get('pusher:subscription_error')!({ status: 403 })
    expect(await code(refused)).toBe('unauthenticated')
  })

  it('reports no settings when the key is empty (phone link unavailable)', () => {
    const client = createHttpClient({ baseUrl: 'http://api.test', fetch: fakeApi().f })
    expect(createHttpRealtime({ client, settings: { key: '', host: '', port: 443, scheme: 'https' } }).settings()).toBeNull()
  })
})
