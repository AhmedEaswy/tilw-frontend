/**
 * Feature 004 (phone link): the studio side of a link, framework-free so it can be unit-tested (research R6).
 * The Pinia store `useLinkStore` mirrors its state.
 *
 * - Starts or resumes the link for the open script and connects to its host and presence channels.
 * - Hands each incoming command to the registered player (the rehearse or record page), which applies it through
 *   the page's own controls, then answers it. With no player for this script the command is refused (`unsupported`).
 * - Sends the player's state: in full when the phone joins, then coalesced to at most one every `coalesceMs`.
 * - Has no access to the recorder: nothing here can stop a take (research R14, SC-005).
 */
import type { LinkPort, LinkRelayPort, RealtimeConnection, RealtimePort } from '../ports'
import {
  isPortError, type ConnectionState, type LinkAuth, type LinkCommand, type LinkEndReason, type LinkEvent, type LinkParty,
  type LinkRemote, type PairingCode, type PhoneLink, type PresenceMember, type RefusalReason, type StudioState,
} from '../types'

export interface LinkPlayer {
  /** The script this page is reading. */
  scriptId: string
  apply(cmd: LinkCommand): { result: 'applied' } | { result: 'refused'; reason: RefusalReason }
  snapshot(): Omit<StudioState, 'seq'>
}

/** One tab hosts a link at a time (research R8). */
export interface HostTab {
  acquire(): Promise<boolean>
  release(): void
  /** Another tab asked to take over: release and stop hosting. */
  onReleaseRequested(cb: () => void): () => void
  /** Ask the hosting tab to let go, then acquire. */
  takeOver(): Promise<boolean>
}

export type HostPhase = 'idle' | 'starting' | 'open' | 'ended' | 'locked' | 'unavailable' | 'otherTab' | 'error'
export type LinkStatus = 'idle' | 'starting' | 'waiting' | 'connected' | 'partnerOffline' | 'ended' | 'locked' | 'unavailable' | 'otherTab'

export interface HostState {
  phase: HostPhase
  link: PhoneLink | null
  code: PairingCode | null
  endReason: LinkEndReason | 'replaced' | null
  pendingRemote: LinkRemote | null
  roleRequest: { player: LinkParty; expiresAt: string } | null
  partnerPresent: boolean
  /** When the phone (re)joined, for "Connected for 3 minutes". */
  partnerSince: number | null
  connection: ConnectionState
  /** The last failure (start, new code…), for the panel's message. */
  error: unknown
  /** Set when a start was refused with limit_reached. */
  limitError: unknown
}

export interface HostDeps {
  links: LinkPort
  /**
   * The same port without the app's "session ended → sign in" redirect, for checks the host makes on its own
   * (after a reconnect, on a refused call). A redirect from those could leave the record page mid-take (SC-005).
   */
  quietLinks?: Pick<LinkPort, 'current' | 'list'>
  relay: LinkRelayPort
  realtime: RealtimePort
  tab?: HostTab
  coalesceMs?: number
}

export const hostChannelOf = (id: string) => `private-link.${id}.host`
export const presenceChannelOf = (id: string) => `presence-link.${id}`
const SESSION: LinkAuth = { kind: 'session' }

/** What the indicator and panel show. */
export function linkStatus(s: HostState): LinkStatus {
  if (s.phase !== 'open') return s.phase === 'error' ? 'idle' : s.phase
  if (!s.link?.remote) return 'waiting'
  return s.partnerPresent && s.connection === 'connected' ? 'connected' : 'partnerOffline'
}

export function createLinkHost(deps: HostDeps) {
  const coalesceMs = deps.coalesceMs ?? 150
  const quiet = deps.quietLinks ?? deps.links
  const state: HostState = {
    phase: 'idle', link: null, code: null, endReason: null, pendingRemote: null, roleRequest: null,
    partnerPresent: false, partnerSince: null, connection: 'disconnected', error: null, limitError: null,
  }
  const listeners = new Set<(s: HostState) => void>()
  const emit = () => listeners.forEach(cb => cb(state))
  const set = (patch: Partial<HostState>) => { Object.assign(state, patch); emit() }

  let conn: RealtimeConnection | null = null
  let player: LinkPlayer | null = null
  // Numbered from the clock and never reset: a reloaded studio, or a tab taking the link back, must number its states
  // above the ones the phone already showed (it drops anything not newer).
  let seq = 0
  const nextSeq = () => (seq = Math.max(seq + 1, Date.now()))
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastSent = 0
  let holdingTab = false
  let offRelease: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null

  function teardown() {
    if (timer) clearTimeout(timer)
    timer = null
    if (keepAlive) clearInterval(keepAlive)
    keepAlive = null
    conn?.close()
    conn = null
    offRelease?.()
    offRelease = null
    if (holdingTab) deps.tab?.release()
    holdingTab = false
  }

  /** This tab now holds the lock: give the link up when another tab asks for it ("Move here" there). */
  function held() {
    holdingTab = true
    offRelease?.()
    offRelease = deps.tab!.onReleaseRequested(() => {
      teardown()
      set({ phase: 'otherTab', partnerPresent: false, connection: 'disconnected' })
    })
  }

  async function claimTab(): Promise<boolean> {
    if (!deps.tab || holdingTab) return true
    if (await deps.tab.acquire()) held()
    return holdingTab
  }

  function isRemote(m: PresenceMember) {
    return m.party === 'remote'
  }

  async function connect(link: PhoneLink) {
    const settings = deps.realtime.settings()
    if (!settings) return set({ phase: 'unavailable' })
    conn?.close()
    const c = deps.realtime.connect(SESSION, settings)
    conn = c
    set({ connection: c.state })
    c.onState((s) => {
      const was = state.connection
      set({ connection: s })
      // Back after a drop: the phone may have missed changes, and the link may have ended while we were away.
      if (s === 'connected' && was !== 'connected') {
        void sendState(true)
        void refresh()
      }
    })
    // Keep-alive (backend realtime.md): a sign of life every 60 s so a quiet studio isn't ended as idle.
    if (keepAlive) clearInterval(keepAlive)
    keepAlive = setInterval(() => {
      if (state.link) deps.relay.ping(SESSION, state.link.id).catch((e) => { if (isPortError(e, 'unauthenticated')) void endedElsewhere(null) })
      // A phone that rejoined without a presence event (same member, old socket not yet closed) still catches up.
      if (state.partnerPresent) void sendState(true)
    }, 60_000)
    await c.subscribe(hostChannelOf(link.id), onEvent)
    await c.presence(presenceChannelOf(link.id), {
      members: (m) => {
        const present = m.some(isRemote)
        set({ partnerPresent: present, partnerSince: present ? (state.partnerSince ?? Date.now()) : null })
        if (state.partnerPresent) void sendState(true)
      },
      added: (m) => {
        if (!isRemote(m)) return
        // The code that paired this phone is used up; a new one is made on request ("Another phone?").
        set({ partnerPresent: true, partnerSince: Date.now(), code: state.link?.remote ? state.code : null })
        void refresh()
        void sendState(true)
      },
      removed: (m) => {
        if (isRemote(m)) set({ partnerPresent: false, partnerSince: null })
      },
    })
  }

  /**
   * Ask the service about this link: pick up a new phone or a pending one, or, after the studio was offline, learn that
   * the link ended meanwhile (its `link.ended` event was missed) and why.
   */
  async function refresh() {
    const link = state.link
    if (!link?.scriptId) return
    try {
      const l = await quiet.current(link.scriptId)
      if (state.phase !== 'open' || state.link?.id !== link.id) return
      if (l && l.id === link.id) return set({ link: l, pendingRemote: l.pendingRemote ?? state.pendingRemote })
      await endedElsewhere('idle')
    } catch (e) {
      if (isPortError(e, 'unauthenticated')) endLocal(null)
      /* otherwise keep what we have */
    }
  }

  /** The service no longer knows this link as open: end it here with the reason the service recorded, if it has one. */
  async function endedElsewhere(fallback: HostState['endReason']) {
    const link = state.link
    if (!link || state.phase !== 'open') return
    const ended = (await quiet.list().catch(() => [] as PhoneLink[])).find(x => x.id === link.id)
    if (state.phase === 'open' && state.link?.id === link.id) endLocal(ended?.endReason ?? fallback)
  }

  function endLocal(reason: HostState['endReason']) {
    teardown()
    set({
      phase: 'ended', endReason: reason, partnerPresent: false, connection: 'disconnected', code: null, pendingRemote: null,
      roleRequest: null, link: state.link ? { ...state.link, state: 'ended', endReason: (reason === 'replaced' ? null : reason) } : null,
    })
  }

  function onEvent(e: LinkEvent) {
    switch (e.name) {
      case 'command': return void handleCommand(e.data)
      case 'remote.requested': return set({ pendingRemote: e.data.remote, code: null })
      case 'link.updated': return set({ link: state.link ? { ...state.link, previews: e.data.previews } : null })
      case 'roles.requested': return set({ roleRequest: e.data })
      case 'roles.declined': return set({ roleRequest: null })
      case 'roles.changed': return set({ roleRequest: null, link: state.link ? { ...state.link, player: e.data.player } : null })
      case 'link.ended': return endLocal(e.data.reason)
      default:
    }
  }

  async function handleCommand(cmd: LinkCommand) {
    const link = state.link
    if (!link) return
    let answer: { result: 'applied' } | { result: 'refused'; reason: RefusalReason }
    if (!player || player.scriptId !== link.scriptId) answer = { result: 'refused', reason: 'unsupported' }
    else {
      try {
        answer = player.apply(cmd)
      } catch {
        answer = { result: 'refused', reason: 'unsupported' }
      }
    }
    try {
      await deps.relay.ack(SESSION, link.id, { commandId: cmd.id, ...answer })
    } catch (e) {
      if (isPortError(e, 'partner_offline')) set({ partnerPresent: false })
    }
    if (answer.result === 'applied') changed()
  }

  async function sendState(full = false) {
    if (timer) { clearTimeout(timer); timer = null }
    const link = state.link
    if (!link || state.phase !== 'open' || !player || player.scriptId !== link.scriptId) return
    if (!full && !state.partnerPresent) return
    const snap = player.snapshot()
    const payload: StudioState = { ...snap, seq: nextSeq() }
    // With previews off, no script text other than the title leaves the studio (the server strips it too).
    if (!link.previews) delete payload.preview
    lastSent = Date.now()
    try {
      await deps.relay.state(SESSION, link.id, payload)
    } catch (e) {
      if (isPortError(e, 'partner_offline')) set({ partnerPresent: false })
      else if (isPortError(e, 'unauthenticated')) void endedElsewhere(null)
    }
  }

  /** Something the phone shows changed: send soon, at most one state every `coalesceMs`, newest wins. */
  function changed() {
    if (state.phase !== 'open' || !state.partnerPresent || timer) return
    const wait = Math.max(0, coalesceMs - (Date.now() - lastSent))
    timer = setTimeout(() => { timer = null; void sendState() }, wait)
  }

  return {
    get state(): Readonly<HostState> { return state },
    subscribe(cb: (s: HostState) => void) {
      listeners.add(cb)
      cb(state)
      return () => { listeners.delete(cb) }
    },
    setPlayer(p: LinkPlayer | null) {
      player = p
      if (p) changed()
    },
    /** A page leaving: clear its player only if another page hasn't registered since. */
    clearPlayer(p: LinkPlayer) {
      if (player === p) player = null
    },
    changed,
    /** Send the current state now (e.g. "saved" just before the record page leaves). */
    flush: () => sendState(),

    /** The plan already says no (US1 #7): show the locked state without trying to start. */
    lock() {
      set({ phase: 'locked' })
    },

    /** Connect phone: start (or reuse) the link for this script and show its code. */
    async open(scriptId: string) {
      if (!deps.realtime.settings()) return set({ phase: 'unavailable' })
      if (!(await claimTab())) return set({ phase: 'otherTab' })
      set({ phase: 'starting', error: null, limitError: null, endReason: null })
      try {
        const l = await deps.links.start(scriptId)
        const { code, ...link } = l
        set({ link, code, pendingRemote: link.pendingRemote, phase: 'open' })
        await connect(link)
      } catch (e) {
        teardown()
        if (isPortError(e, 'limit_reached')) set({ phase: 'locked', limitError: e })
        else set({ phase: 'error', error: e })
      }
    },

    /** The studio page opened (or reloaded): rejoin an open link for this script without a new code. */
    async resume(scriptId: string) {
      if (state.phase === 'open' && state.link?.scriptId === scriptId) return
      if (!deps.realtime.settings()) return
      let l: PhoneLink | null = null
      try {
        l = await deps.links.current(scriptId)
      } catch {
        return
      }
      // Connect phone was pressed while we were asking: that start wins (and keeps its fresh code).
      if (state.phase !== 'idle' && state.phase !== 'ended' && state.phase !== 'error') return
      if (!l || l.state === 'ended' || l.scriptId !== scriptId) return
      if (!(await claimTab())) return set({ phase: 'otherTab', link: l })
      set({ link: l, code: null, pendingRemote: l.pendingRemote, phase: 'open', endReason: null })
      try {
        await connect(l)
      } catch (e) {
        teardown()
        set({ phase: 'error', error: e })
      }
    },

    async newCode() {
      if (!state.link?.scriptId) return
      try {
        set({ code: await deps.links.newCode(state.link.id), error: null })
      } catch (e) {
        set({ error: e })
      }
    },

    async setPreviews(on: boolean) {
      if (!state.link?.scriptId) return
      const before = state.link.previews
      set({ link: { ...state.link, previews: on } })
      try {
        await deps.links.update(state.link.id, { previews: on })
        changed()
      } catch (e) {
        set({ link: state.link ? { ...state.link, previews: before } : null, error: e })
      }
    },

    async end() {
      if (!state.link?.scriptId) return
      try {
        await deps.links.end(state.link.id)
      } catch (e) {
        if (!isPortError(e, 'not_found')) return set({ error: e })
      }
      endLocal('owner')
    },

    async acceptRemote() {
      if (!state.link || !state.pendingRemote) return
      const l = await deps.links.acceptRemote(state.link.id, state.pendingRemote.id)
      set({ link: l, pendingRemote: null })
    },
    async declineRemote() {
      if (!state.link || !state.pendingRemote) return
      const id = state.pendingRemote.id
      set({ pendingRemote: null })
      await deps.links.declineRemote(state.link.id, id).catch(() => {})
    },

    /** Another studio tab holds the link: take it over here. */
    async moveHere(scriptId: string) {
      if (!deps.tab) return
      if (!(await deps.tab.takeOver())) return
      held()
      set({ phase: 'idle' })
      await this.resume(scriptId)
    },

    /** Panel closed after an end, or the person left the studio for good (sign-out). */
    reset() {
      teardown()
      set({
        phase: 'idle', link: null, code: null, endReason: null, pendingRemote: null, roleRequest: null,
        partnerPresent: false, partnerSince: null, connection: 'disconnected', error: null, limitError: null,
      })
    },
  }
}

export type LinkHost = ReturnType<typeof createLinkHost>
