/**
 * Feature 004 (phone link): the phone side of a link, framework-free so it can be unit-tested (research R9).
 * The Pinia store `useRemoteStore` mirrors its state; pages/remote.vue shows it.
 *
 * - Pairs from the QR secret (then the page removes it from the address) or a typed code, or reconnects with a
 *   pairing stored on the phone less than 10 minutes ago.
 * - Sends commands and shows each result: done, refused with a reason, or not delivered (no answer in 5 s, or the
 *   studio isn't connected). A late answer after the 5 s is ignored; nothing is ever sent again later.
 * - Shows only the newest state (by `seq`).
 * - Forgets the pairing as soon as the link ends, this phone is replaced or declined, or the service refuses it.
 */
import type { LinkRelayPort, RealtimeConnection, RealtimePort } from '../ports'
import {
  LINK_RULES, isPortError, type CommandType, type ConnectionState, type LinkAuth, type LinkEndReason, type LinkEvent,
  type Pairing, type RealtimeSettings, type RefusalReason, type StudioState,
} from '../types'

export interface StoredPairing {
  linkId: string
  remoteId: string
  credential: string
  channels: { own: string; presence: string }
  realtime: RealtimeSettings
  /** Waiting for the studio to accept this phone. */
  pending: boolean
  lastSeenAt: number
}

export interface PairingStore {
  load(): StoredPairing | null
  save(p: StoredPairing): void
  clear(): void
}

/** The phone keeps only this, in localStorage, and only while it can still reconnect (FR-014). */
export function localPairingStore(key = 'tilw:remote:v1'): PairingStore {
  const ls = () => (typeof localStorage === 'undefined' ? null : localStorage)
  return {
    load() {
      try {
        const raw = ls()?.getItem(key)
        return raw ? (JSON.parse(raw) as StoredPairing) : null
      } catch {
        return null
      }
    },
    save(p) {
      try { ls()?.setItem(key, JSON.stringify(p)) } catch { /* private mode: no reconnect after reload */ }
    },
    clear() {
      try { ls()?.removeItem(key) } catch { /* nothing to clear */ }
    },
  }
}

export function memoryPairingStore(): PairingStore & { value: StoredPairing | null } {
  const s = {
    value: null as StoredPairing | null,
    load: () => (s.value ? { ...s.value } : null),
    save: (p: StoredPairing) => { s.value = { ...p } },
    clear: () => { s.value = null },
  }
  return s
}

export type RemotePhase = 'start' | 'pairing' | 'waitingAccept' | 'connected' | 'ended'
/** Why the phone stopped: a link end reason, or what happened to this phone. */
export type RemoteEnd = LinkEndReason | 'replaced' | 'declined' | 'lapsed' | 'left' | 'unknown'
export type PairError = 'invalid' | 'tooMany' | 'limit' | 'network'

export interface CommandResult {
  type: CommandType
  outcome: 'sending' | 'applied' | 'refused' | 'notDelivered'
  reason?: RefusalReason
}

export interface RemoteState {
  phase: RemotePhase
  state: StudioState | null
  studioPresent: boolean
  connection: ConnectionState
  previews: boolean
  /** Commands waiting for an answer. */
  pending: Record<string, CommandType>
  lastResult: CommandResult | null
  ended: RemoteEnd | null
  pairError: PairError | null
}

export interface RemoteDeps {
  relay: LinkRelayPort
  realtime: RealtimePort
  store: PairingStore
  now?: () => number
  uuid?: () => string
  ackTimeoutMs?: number
  /** The phone's name as the studio will show it. */
  deviceName?: string
}

export function createLinkRemote(deps: RemoteDeps) {
  const now = deps.now ?? (() => Date.now())
  const uuid = deps.uuid ?? (() => crypto.randomUUID())
  const ackTimeoutMs = deps.ackTimeoutMs ?? LINK_RULES.ackTimeoutMs
  const reconnectMs = LINK_RULES.reconnectMinutes * 60_000

  const state: RemoteState = {
    phase: 'start', state: null, studioPresent: false, connection: 'disconnected', previews: true,
    pending: {}, lastResult: null, ended: null, pairError: null,
  }
  const listeners = new Set<(s: RemoteState) => void>()
  const emit = () => listeners.forEach(cb => cb(state))
  const set = (patch: Partial<RemoteState>) => { Object.assign(state, patch); emit() }

  let pairing: StoredPairing | null = null
  let conn: RealtimeConnection | null = null
  let presenceOff: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const auth = (): LinkAuth => ({ kind: 'remote', credential: pairing!.credential })
  function touch() {
    if (!pairing) return
    pairing.lastSeenAt = now()
    deps.store.save(pairing)
  }

  function teardown() {
    timers.forEach(t => clearTimeout(t))
    timers.clear()
    if (keepAlive) clearInterval(keepAlive)
    keepAlive = null
    presenceOff = null
    conn?.close()
    conn = null
  }

  function finish(reason: RemoteEnd) {
    teardown()
    pairing = null
    deps.store.clear()
    set({ phase: 'ended', ended: reason, studioPresent: false, connection: 'disconnected', pending: {} })
  }

  async function joinPresence() {
    if (!conn || !pairing || presenceOff) return
    presenceOff = await conn.presence(pairing.channels.presence, {
      members: m => set({ studioPresent: m.some(x => x.party === 'host') }),
      added: (m) => { if (m.party === 'host') set({ studioPresent: true }) },
      removed: (m) => { if (m.party === 'host') set({ studioPresent: false }) },
    })
  }

  function onEvent(e: LinkEvent) {
    touch()
    switch (e.name) {
      case 'ack': {
        const type = state.pending[e.data.commandId]
        if (!type) return // answered too late: already shown as not delivered
        clearTimeout(timers.get(e.data.commandId))
        timers.delete(e.data.commandId)
        const { [e.data.commandId]: _done, ...rest } = state.pending
        return set({
          pending: rest,
          lastResult: e.data.result === 'applied' ? { type, outcome: 'applied' } : { type, outcome: 'refused', reason: e.data.reason ?? 'unsupported' },
        })
      }
      case 'state':
        if (state.state && e.data.seq <= state.state.seq) return
        return set({ state: e.data, studioPresent: true })
      case 'link.updated': {
        const s = state.state
        if (!e.data.previews && s) {
          const { preview: _p, ...rest } = s
          return set({ previews: false, state: rest })
        }
        return set({ previews: e.data.previews })
      }
      case 'remote.accepted':
        if (pairing) { pairing.pending = false; touch() }
        set({ phase: 'connected' })
        return void joinPresence().catch(() => finish('unknown'))
      case 'remote.replaced': return finish('replaced')
      case 'remote.declined': return finish(e.data.reason)
      case 'link.ended': return finish(e.data.reason)
      default:
    }
  }

  async function connect() {
    if (!pairing) return
    teardown()
    const c = deps.realtime.connect(auth(), pairing.realtime)
    conn = c
    set({ connection: c.state })
    c.onState((s) => {
      const was = state.connection
      set({ connection: s, ...(s !== 'connected' ? { studioPresent: false } : {}) })
      // Back online: tell the service we're here (it may have ended the link meanwhile).
      if (s === 'connected' && was !== 'connected' && pairing) void ping()
    })
    await c.subscribe(pairing.channels.own, onEvent)
    if (!pairing.pending) await joinPresence()
    keepAlive = setInterval(() => void ping(), 60_000)
  }

  async function ping() {
    if (!pairing) return
    try {
      await deps.relay.ping(auth(), pairing.linkId)
      touch()
    } catch (e) {
      if (isPortError(e, 'unauthenticated')) finish('unknown')
    }
  }

  async function adopt(p: Pairing) {
    if (!p.credential) throw new Error('A phone browser pairing always has a credential')
    pairing = {
      linkId: p.link.id, remoteId: p.remote.id, credential: p.credential, channels: p.channels, realtime: p.realtime,
      pending: p.remote.status === 'pending', lastSeenAt: now(),
    }
    deps.store.save(pairing)
    set({ phase: pairing.pending ? 'waitingAccept' : 'connected', previews: p.link.previews, ended: null, pairError: null, state: null })
    try {
      await connect()
    } catch (e) {
      if (isPortError(e, 'unauthenticated')) finish('unknown')
      else set({ connection: 'unavailable' })
    }
  }

  async function pair(input: { code: string } | { secret: string }) {
    set({ phase: 'pairing', pairError: null })
    try {
      await adopt(await deps.relay.pair(input, deps.deviceName))
    } catch (e) {
      const err: PairError = isPortError(e, 'rate_limited') ? 'tooMany'
        : isPortError(e, 'limit_reached') ? 'limit'
          : isPortError(e, 'network') ? 'network' : 'invalid'
      set({ phase: 'start', pairError: err })
    }
  }

  return {
    get state(): Readonly<RemoteState> { return state },
    subscribe(cb: (s: RemoteState) => void) {
      listeners.add(cb)
      cb(state)
      return () => { listeners.delete(cb) }
    },

    /** Page opened: the QR secret if there is one, else a recent stored pairing, else the code entry. */
    async start(secret?: string | null) {
      if (secret) return pair({ secret })
      const stored = deps.store.load()
      if (stored && now() - stored.lastSeenAt < reconnectMs) {
        pairing = stored
        set({ phase: stored.pending ? 'waitingAccept' : 'connected', ended: null })
        try {
          await deps.relay.ping(auth(), stored.linkId)
        } catch (e) {
          if (isPortError(e, 'unauthenticated')) return finish('unknown')
          // A pending phone can't ping yet; anything else (network) is retried by the socket.
        }
        try {
          await connect()
        } catch (e) {
          if (isPortError(e, 'unauthenticated')) return finish('unknown')
          set({ connection: 'unavailable' })
        }
        return
      }
      if (stored) deps.store.clear()
      set({ phase: 'start' })
    },

    pairWithCode: (code: string) => pair({ code: code.replace(/\D/g, '') }),

    /** Back to the code entry after an end screen. */
    again() {
      set({ phase: 'start', ended: null, pairError: null, state: null, lastResult: null })
    },

    async send(type: CommandType, extra: { paragraph?: number; wpm?: number } = {}) {
      if (!pairing || state.phase !== 'connected') return
      const id = uuid()
      set({ pending: { ...state.pending, [id]: type }, lastResult: { type, outcome: 'sending' } })
      const notDelivered = () => {
        if (!state.pending[id]) return
        timers.delete(id)
        const { [id]: _gone, ...rest } = state.pending
        set({ pending: rest, lastResult: { type, outcome: 'notDelivered' } })
      }
      timers.set(id, setTimeout(notDelivered, ackTimeoutMs))
      try {
        await deps.relay.command(auth(), pairing.linkId, { id, type, ...extra })
        touch()
      } catch (e) {
        clearTimeout(timers.get(id))
        if (isPortError(e, 'unauthenticated')) return finish('unknown')
        if (isPortError(e, 'partner_offline')) set({ studioPresent: false })
        notDelivered()
      }
    },

    async leave() {
      if (pairing) await deps.relay.leave(auth(), pairing.linkId).catch(() => {})
      finish('left')
    },

    dispose: teardown,
  }
}

export type LinkRemoteClient = ReturnType<typeof createLinkRemote>
