/**
 * Feature 004 (phone link), mock adapter: a fake realtime server between tabs of the same browser (research R11).
 *
 * Every tab runs a hub on one BroadcastChannel. Events are addressed by channel name, like Pusher channels. Presence is
 * kept with heartbeats: each tab announces the members it joined every 2 s, and a member that isn't announced for 6 s
 * is removed. A new tab gets an immediate reply, so joining feels instant. A tab can be marked offline (/__mock), which
 * stops its heartbeats and its deliveries in both directions — the other tabs then see it leave, as with a lost socket.
 *
 * The "server" side (`publish`, `isPresent`) runs in whichever tab made the relay call, as the mock backend does.
 */
import type { ConnectionState, LinkAuth, LinkEvent, PresenceMember, RealtimeSettings } from '../types'
import { PortError } from '../types'
import type { RealtimeConnection, RealtimePort } from '../ports'

export type HubMsg =
  | { kind: 'event'; channel: string; event: LinkEvent }
  | { kind: 'beat'; tab: string; members: { channel: string; member: PresenceMember }[]; reply?: boolean }
  | { kind: 'bye'; tab: string }

export interface HubBus {
  post(msg: HubMsg): void
  onMessage(cb: (msg: HubMsg) => void): void
  close(): void
}

/**
 * The browser bus: one BroadcastChannel shared by every tab of this origin. Null outside a browser: Node also has a
 * BroadcastChannel, and an open one keeps the process alive (it made `nuxt generate` hang after prerendering).
 */
export function broadcastBus(name = 'tilw-link-mock'): HubBus | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  const ch = new BroadcastChannel(name)
  return {
    post: msg => ch.postMessage(msg),
    onMessage: cb => ch.addEventListener('message', e => cb((e as MessageEvent<HubMsg>).data)),
    close: () => ch.close(),
  }
}

/** For tests: buses that deliver to each other (never to the sender), like BroadcastChannel. */
export function memoryNetwork() {
  const listeners = new Set<{ cb: (m: HubMsg) => void }>()
  return {
    bus(): HubBus {
      const me = { cb: (_m: HubMsg) => {} }
      listeners.add(me)
      return {
        post: msg => listeners.forEach(l => l !== me && l.cb(JSON.parse(JSON.stringify(msg)))),
        onMessage: (cb) => { me.cb = cb },
        close: () => listeners.delete(me),
      }
    },
  }
}

interface PresenceWatch {
  members: (m: PresenceMember[]) => void
  added: (m: PresenceMember) => void
  removed: (m: PresenceMember) => void
}

export interface MockHubOptions {
  bus?: HubBus | null
  now?: () => number
  beatMs?: number
  timeoutMs?: number
  /** Start offline (e.g. restored from sessionStorage on reload). */
  offline?: boolean
}

export function createMockHub(opts: MockHubOptions = {}) {
  const bus = opts.bus ?? null
  const now = opts.now ?? (() => Date.now())
  const beatMs = opts.beatMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 6000
  const tab = Math.random().toString(36).slice(2, 10)
  let offline = !!opts.offline

  const listeners = new Map<string, Set<(e: LinkEvent) => void>>()
  /** channel → memberId → who announced it and when. */
  const presence = new Map<string, Map<string, { member: PresenceMember; tab: string; at: number }>>()
  /** Members this tab joined: channel → memberId → count (a tab may join the same member twice). */
  const joined = new Map<string, Map<string, { member: PresenceMember; n: number }>>()
  const watches = new Map<string, Set<PresenceWatch>>()
  const offlineCbs = new Set<(off: boolean) => void>()
  const knownTabs = new Set<string>()

  const table = (channel: string) => {
    let t = presence.get(channel)
    if (!t) presence.set(channel, (t = new Map()))
    return t
  }
  const watchersOf = (channel: string) => watches.get(channel) ?? new Set<PresenceWatch>()

  function deliver(channel: string, event: LinkEvent) {
    if (offline) return
    listeners.get(channel)?.forEach(cb => cb(event))
  }

  function upsert(channel: string, member: PresenceMember, from: string) {
    const t = table(channel)
    const prev = t.get(member.id)
    t.set(member.id, { member, tab: from, at: now() })
    // A member back from another tab (a reload whose goodbye got lost) counts as joining again, as with Pusher when
    // the old socket closes before the new one subscribes.
    if (!prev || prev.tab !== from) watchersOf(channel).forEach(w => w.added(member))
  }
  function drop(channel: string, memberId: string) {
    const t = table(channel)
    const rec = t.get(memberId)
    if (!rec) return
    t.delete(memberId)
    watchersOf(channel).forEach(w => w.removed(rec.member))
  }

  function myMembers() {
    const out: { channel: string; member: PresenceMember }[] = []
    joined.forEach((m, channel) => m.forEach(({ member }) => out.push({ channel, member })))
    return out
  }
  function beat(reply = false) {
    if (offline) return
    const members = myMembers()
    for (const { channel, member } of members) table(channel).set(member.id, { member, tab, at: now() })
    bus?.post({ kind: 'beat', tab, members, reply })
  }
  function prune() {
    const cutoff = now() - timeoutMs
    presence.forEach((t, channel) => {
      t.forEach((rec, id) => {
        const mine = rec.tab === tab && joined.get(channel)?.has(id)
        // Offline, this tab hears nobody: everyone else times out. Its own members stay in its own view.
        if (!mine && rec.at < cutoff) drop(channel, id)
      })
    })
  }

  bus?.onMessage((msg) => {
    if (offline) return
    if (msg.kind === 'event') return deliver(msg.channel, msg.event)
    if (msg.kind === 'bye') {
      knownTabs.delete(msg.tab)
      presence.forEach((t, channel) => t.forEach((rec, id) => rec.tab === msg.tab && drop(channel, id)))
      return
    }
    // beat: refresh what that tab announced, remove what it no longer announces.
    const announced = new Set(msg.members.map(m => `${m.channel}|${m.member.id}`))
    presence.forEach((t, channel) => t.forEach((rec, id) => {
      if (rec.tab === msg.tab && !announced.has(`${channel}|${id}`)) drop(channel, id)
    }))
    msg.members.forEach(({ channel, member }) => upsert(channel, member, msg.tab))
    if (!knownTabs.has(msg.tab)) {
      knownTabs.add(msg.tab)
      if (!msg.reply) beat(true)
    }
  })

  // Heartbeats only matter between browser tabs. On the server (prerendering) a running interval would keep the
  // Node process alive and `nuxt generate` would never finish, so there is none; in Node it never holds the process.
  const timer = beatMs > 0 && typeof window !== 'undefined'
    ? setInterval(() => { beat(); prune() }, beatMs)
    : null
  ;(timer as { unref?: () => void } | null)?.unref?.()
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => bus?.post({ kind: 'bye', tab }))

  return {
    tab,
    get offline() { return offline },
    /** /__mock: stop or restart this tab's heartbeats and deliveries. */
    setOffline(off: boolean) {
      if (off === offline) return
      if (off) bus?.post({ kind: 'bye', tab })
      offline = off
      if (!off) { knownTabs.clear(); beat() }
      offlineCbs.forEach(cb => cb(off))
    },
    onOffline(cb: (off: boolean) => void) {
      offlineCbs.add(cb)
      return () => offlineCbs.delete(cb)
    },
    // ---------- server side ----------
    publish(channel: string, event: LinkEvent) {
      if (offline) return
      deliver(channel, event)
      bus?.post({ kind: 'event', channel, event })
    },
    isPresent(channel: string, memberId: string) {
      if (joined.get(channel)?.has(memberId)) return !offline
      const rec = presence.get(channel)?.get(memberId)
      return !!rec && !offline && rec.at >= now() - timeoutMs
    },
    // ---------- client side ----------
    listen(channel: string, cb: (e: LinkEvent) => void) {
      let set = listeners.get(channel)
      if (!set) listeners.set(channel, (set = new Set()))
      set.add(cb)
      return () => { set!.delete(cb) }
    },
    join(channel: string, member: PresenceMember) {
      let m = joined.get(channel)
      if (!m) joined.set(channel, (m = new Map()))
      const rec = m.get(member.id)
      if (rec) rec.n++
      else {
        m.set(member.id, { member, n: 1 })
        upsert(channel, member, tab)
      }
      beat()
      return () => {
        const r = m!.get(member.id)
        if (!r) return
        if (--r.n > 0) return
        m!.delete(member.id)
        drop(channel, member.id)
        beat()
      }
    },
    watch(channel: string, w: PresenceWatch) {
      let set = watches.get(channel)
      if (!set) watches.set(channel, (set = new Set()))
      set.add(w)
      w.members([...table(channel).values()].map(r => r.member))
      return () => { set!.delete(w) }
    },
    /** Tests: run one heartbeat and timeout check now. */
    tick() { beat(); prune() },
    dispose() {
      if (timer) clearInterval(timer)
      bus?.post({ kind: 'bye', tab })
      bus?.close()
    },
  }
}

export type MockHub = ReturnType<typeof createMockHub>

/** Who may join a channel; implemented by the mock link backend (mock/link.ts). */
export interface ChannelAuthoriser {
  /** null = refused. For presence channels, the member to announce. */
  authorise(auth: LinkAuth, channel: string): { member: PresenceMember | null } | null
}

/** RealtimePort over the hub: what the stores see instead of a Pusher socket. */
export function createMockRealtime(hub: MockHub, server: ChannelAuthoriser): RealtimePort {
  const settings: RealtimeSettings = { key: 'mock', host: 'mock', port: 0, scheme: 'https' }
  return {
    settings: () => settings,
    connect(auth: LinkAuth): RealtimeConnection {
      let closed = false
      const stateCbs = new Set<(s: ConnectionState) => void>()
      const cleanups = new Set<() => void>()
      const current = (): ConnectionState => (closed ? 'disconnected' : hub.offline ? 'unavailable' : 'connected')
      const offOffline = hub.onOffline(() => stateCbs.forEach(cb => cb(current())))
      const allow = (channel: string) => {
        if (closed) throw new PortError('network')
        const ok = server.authorise(auth, channel)
        if (!ok) throw new PortError('unauthenticated')
        return ok
      }
      return {
        get state() { return current() },
        onState(cb) {
          stateCbs.add(cb)
          return () => { stateCbs.delete(cb) }
        },
        async subscribe(channel, onEvent) {
          allow(channel)
          const off = hub.listen(channel, onEvent)
          cleanups.add(off)
          return () => { off(); cleanups.delete(off) }
        },
        async presence(channel, on) {
          const { member } = allow(channel)
          if (!member) throw new PortError('unauthenticated')
          const leave = hub.join(channel, member)
          const unwatch = hub.watch(channel, on)
          const off = () => { unwatch(); leave() }
          cleanups.add(off)
          return () => { off(); cleanups.delete(off) }
        },
        close() {
          if (closed) return
          closed = true
          cleanups.forEach(fn => fn())
          cleanups.clear()
          offOffline()
          stateCbs.forEach(cb => cb('disconnected'))
        },
      }
    },
  }
}
