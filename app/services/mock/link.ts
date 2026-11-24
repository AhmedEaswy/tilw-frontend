/**
 * Feature 004 (phone link), mock adapter: the backend 003 rules in the browser (research R11).
 *
 * State lives in its own KV key and is re-read on every call, so two tabs of the same browser (the studio and the
 * "phone") act on one shared link. Presence and delivery go through the realtime hub (mock/realtime.ts). The rules
 * mirror backend/app/Support/PhoneLinks.php: single-use 5-minute codes with one answer for wrong, used and expired;
 * 5 wrong tries then rate_limited; one active remote, a second one waits 2 minutes; previews stripped when off;
 * `partner_offline` when the receiver isn't connected; the 10-minute idle end; end reasons.
 */
import type { LinkPort, LinkRelayPort } from '../ports'
import {
  LINK_RULES, PortError, type LinkAck, type LinkAuth, type LinkCommand, type LinkEndReason, type LinkEvent, type LinkParty,
  type LinkRemote, type Pairing, type PairingCode, type PhoneLink, type PhoneLinkWithCode, type PresenceMember, type StudioState,
} from '../types'
import type { KV } from './db'
import type { ChannelAuthoriser, MockHub } from './realtime'

const KEY = 'tilw:mock:links:v1'
const MIN = 60_000
const COMMANDS = ['play', 'pause', 'next', 'previous', 'goto', 'restart', 'faster', 'slower', 'speed', 'textBigger', 'textSmaller', 'recordStart', 'recordStop']
const REASONS = ['at_end', 'at_start', 'not_recording_mode', 'devices_off', 'already_recording', 'not_recording', 'saving', 'limit', 'unsupported']

interface MockRemote extends Omit<LinkRemote, 'connected'> {
  credential: string | null
  createdAt: number
  pendingUntil: number | null
  endedAt: number | null
}

interface MockLink {
  id: string
  userId: string
  scriptId: string | null
  hostLabel: string
  player: LinkParty
  previews: boolean
  state: 'waiting' | 'connected' | 'ended'
  startedAt: number
  lastUsedAt: number
  endedAt: number | null
  endReason: LinkEndReason | null
  hostSeenAt: number
  remoteSeenAt: number | null
  remotes: MockRemote[]
  roleRequest: { player: LinkParty; by: LinkParty; expiresAt: number } | null
}

interface MockCode { linkId: string; code: string; secret: string; expiresAt: number; usedAt: number | null }
interface LinkState { links: MockLink[]; codes: MockCode[]; wrong: { count: number; firstAt: number; blockedUntil: number } }

export interface MockLinkDeps {
  kv: KV
  hub: MockHub
  now(): number
  /** Latency, network knobs and cloning, like every other mock call. */
  call<T>(fn: () => T): Promise<T>
  /** The signed-in user's id, or null. */
  sessionUserId(): string | null
  /** The effective value of a limit for a user. */
  limit(userId: string, key: string): unknown
  /** The user's script, or null. */
  script(userId: string, scriptId: string): { id: string; title: string } | null
  origin: string
}

export const hostChannel = (id: string) => `private-link.${id}.host`
export const remoteChannel = (id: string, remoteId: string) => `private-link.${id}.remote.${remoteId}`
export const presenceChannel = (id: string) => `presence-link.${id}`
const hostMember: PresenceMember = { id: 'host', party: 'host', remoteId: null }
const remoteMember = (rid: string): PresenceMember => ({ id: `remote:${rid}`, party: 'remote', remoteId: rid })

const rand = (n: number, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789') =>
  Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
const ulid = (p: string) => `${p}${rand(24).toUpperCase()}`

export function createMockLinks(d: MockLinkDeps): { links: LinkPort; relay: LinkRelayPort; server: ChannelAuthoriser; endForScript(scriptId: string): void; endWith(linkId: string, reason: LinkEndReason): void } {
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString())

  function read(): LinkState {
    const raw = d.kv.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as LinkState) : null
    return s ?? { links: [], codes: [], wrong: { count: 0, firstAt: 0, blockedUntil: 0 } }
  }
  function write(s: LinkState) {
    d.kv.setItem(KEY, JSON.stringify(s))
  }
  /**
   * Read, change and save in one step (the mock is single-threaded per tab). Saved even when the call is refused:
   * a refusal can have effects the backend keeps too (the wrong-code count, a link ended by `limit`).
   */
  function tx<T>(fn: (s: LinkState) => T): T {
    const s = read()
    housekeep(s)
    try {
      return fn(s)
    } finally {
      write(s)
    }
  }

  function activeRemote(l: MockLink) {
    return l.remotes.find(r => r.status === 'active') ?? null
  }
  function present(l: MockLink, party: LinkParty) {
    if (party === 'host') return d.hub.isPresent(presenceChannel(l.id), 'host')
    const r = activeRemote(l)
    return !!r && d.hub.isPresent(presenceChannel(l.id), `remote:${r.id}`)
  }
  function channelOf(l: MockLink, party: LinkParty) {
    if (party === 'host') return hostChannel(l.id)
    const r = activeRemote(l)
    return r ? remoteChannel(l.id, r.id) : null
  }
  function send(l: MockLink, party: LinkParty, event: LinkEvent) {
    const ch = channelOf(l, party)
    if (ch) d.hub.publish(ch, event)
  }
  const other = (p: LinkParty): LinkParty => (p === 'host' ? 'remote' : 'host')

  function end(s: LinkState, l: MockLink, reason: LinkEndReason) {
    if (l.state === 'ended') return
    const active = activeRemote(l)
    const t = d.now()
    l.state = 'ended'; l.endedAt = t; l.endReason = reason; l.roleRequest = null
    for (const r of l.remotes) if (r.status === 'active' || r.status === 'pending') { r.status = 'ended'; r.endedAt = t }
    s.codes = s.codes.filter(c => c.linkId !== l.id || c.usedAt !== null)
    const event: LinkEvent = { name: 'link.ended', data: { reason } }
    d.hub.publish(hostChannel(l.id), event)
    if (active) d.hub.publish(remoteChannel(l.id, active.id), event)
  }

  /** What tilw:links-idle does: lapse waiting phones and role requests, end idle links, drop dead codes. */
  function housekeep(s: LinkState) {
    const t = d.now()
    for (const l of s.links) {
      if (l.state === 'ended') continue
      for (const r of l.remotes) {
        if (r.status === 'pending' && r.pendingUntil !== null && r.pendingUntil < t) {
          r.status = 'declined'; r.endedAt = t
          d.hub.publish(remoteChannel(l.id, r.id), { name: 'remote.declined', data: { reason: 'lapsed' } })
        }
      }
      if (l.roleRequest && l.roleRequest.expiresAt < t) {
        send(l, l.roleRequest.by, { name: 'roles.declined', data: { reason: 'lapsed' } })
        l.roleRequest = null
      }
      const cutoff = t - LINK_RULES.reconnectMinutes * MIN
      const seen = Math.max(l.hostSeenAt, l.remoteSeenAt ?? 0)
      if (seen < cutoff && !present(l, 'host') && !present(l, 'remote')) end(s, l, 'idle')
    }
    s.codes = s.codes.filter(c => c.usedAt === null && c.expiresAt >= t - 60 * MIN)
  }

  function view(l: MockLink, s?: LinkState): PhoneLink {
    const pending = l.remotes.find(r => r.status === 'pending') ?? null
    const active = activeRemote(l)
    const pub = (r: MockRemote | null): LinkRemote | null => (r
      ? { id: r.id, kind: r.kind, name: r.name, status: r.status, connected: d.hub.isPresent(presenceChannel(l.id), `remote:${r.id}`), lastSeenAt: r.lastSeenAt }
      : null)
    const script = l.scriptId ? d.script(l.userId, l.scriptId) : null
    void s
    return {
      id: l.id,
      scriptId: l.scriptId,
      scriptTitle: script?.title ?? null,
      host: { kind: 'web', label: l.hostLabel, connected: present(l, 'host') },
      player: l.player,
      previews: l.previews,
      state: l.state,
      remote: pub(active),
      pendingRemote: pub(pending),
      startedAt: iso(l.startedAt)!,
      lastUsedAt: iso(l.lastUsedAt)!,
      endedAt: iso(l.endedAt),
      endReason: l.endReason,
    }
  }

  function owner(): string {
    const id = d.sessionUserId()
    if (!id) throw new PortError('unauthenticated')
    return id
  }
  function ownedOpen(s: LinkState, userId: string, id: string) {
    const l = s.links.find(x => x.id === id && x.userId === userId && x.state !== 'ended')
    if (!l) throw new PortError('not_found')
    return l
  }
  function allowed(userId: string) {
    return d.limit(userId, 'phone_link.allowed') !== false
  }
  function makeCode(s: LinkState, l: MockLink): PairingCode {
    s.codes = s.codes.filter(c => c.linkId !== l.id || c.usedAt !== null)
    const code = rand(6, '0123456789')
    const secret = rand(32)
    const expiresAt = d.now() + LINK_RULES.codeMinutes * MIN
    s.codes.push({ linkId: l.id, code, secret, expiresAt, usedAt: null })
    return { code, url: `${d.origin}/remote#${secret}`, expiresAt: iso(expiresAt)! }
  }

  /** Who is calling, as `link.party` resolves it; null when the caller isn't a party of this open link. */
  function resolve(s: LinkState, auth: LinkAuth, l: MockLink): { party: LinkParty; remote: MockRemote | null } | null {
    if (l.state === 'ended') return null
    if (auth.kind === 'remote') {
      const r = l.remotes.find(x => x.credential === auth.credential && x.status === 'active')
      return r ? { party: 'remote', remote: r } : null
    }
    return d.sessionUserId() === l.userId ? { party: 'host', remote: null } : null
  }
  function party(s: LinkState, auth: LinkAuth, linkId: string) {
    const l = s.links.find(x => x.id === linkId)
    if (!l || l.state === 'ended') throw new PortError('unauthenticated')
    if (!allowed(l.userId)) {
      end(s, l, 'limit')
      throw new PortError('unauthenticated')
    }
    const who = resolve(s, auth, l)
    if (!who) throw new PortError('unauthenticated')
    const t = d.now()
    if (who.party === 'host') l.hostSeenAt = t
    else { l.remoteSeenAt = t; who.remote!.lastSeenAt = iso(t) }
    return { l, ...who }
  }
  function mustBePlayer(l: MockLink, p: LinkParty) {
    if (l.player !== p) throw new PortError('conflict')
  }
  function assertOnline(l: MockLink, p: LinkParty) {
    if (!present(l, p)) throw new PortError('partner_offline')
  }
  const offlineGuard = () => { if (d.hub.offline) throw new PortError('network') }
  const run = <T>(fn: () => T) => d.call(() => { offlineGuard(); return fn() })

  const links: LinkPort = {
    start: scriptId => run(() => tx((s) => {
      const userId = owner()
      const script = d.script(userId, scriptId)
      if (!script) throw new PortError('not_found')
      if (!allowed(userId)) throw new PortError('limit_reached', undefined, undefined, { key: 'phone_link.allowed', value: false, usage: null })
      let l = s.links.find(x => x.userId === userId && x.scriptId === scriptId && x.state !== 'ended')
      const t = d.now()
      if (!l) {
        l = {
          id: ulid('L'), userId, scriptId, hostLabel: 'Web browser', player: 'host', previews: true, state: 'waiting',
          startedAt: t, lastUsedAt: t, endedAt: null, endReason: null, hostSeenAt: t, remoteSeenAt: null, remotes: [], roleRequest: null,
        }
        s.links.push(l)
      } else {
        l.hostSeenAt = t; l.lastUsedAt = t
      }
      const code = makeCode(s, l)
      return { ...view(l), code } as PhoneLinkWithCode
    })),
    current: scriptId => run(() => tx((s) => {
      const userId = owner()
      const open = s.links.filter(x => x.userId === userId && x.scriptId === scriptId && x.state !== 'ended').sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      return open[0] ? view(open[0]) : null
    })),
    list: () => run(() => tx((s) => {
      const userId = owner()
      const since = d.now() - 30 * 24 * 60 * MIN
      return s.links
        .filter(x => x.userId === userId && (x.state !== 'ended' || (x.endedAt ?? 0) >= since))
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .map(l => view(l))
    })),
    newCode: id => run(() => tx(s => makeCode(s, ownedOpen(s, owner(), id)))),
    update: (id, patch) => run(() => tx((s) => {
      const l = ownedOpen(s, owner(), id)
      l.previews = !!patch.previews
      const ev: LinkEvent = { name: 'link.updated', data: { previews: l.previews } }
      send(l, 'host', ev); send(l, 'remote', ev)
      return view(l)
    })),
    end: id => run(() => tx((s) => { end(s, ownedOpen(s, owner(), id), 'owner') })),
    acceptRemote: (id, remoteId) => run(() => tx((s) => {
      const l = ownedOpen(s, owner(), id)
      const pending = l.remotes.find(r => r.id === remoteId && r.status === 'pending')
      if (!pending) throw new PortError('not_found')
      const previous = activeRemote(l)
      const t = d.now()
      if (previous) {
        previous.status = 'replaced'; previous.endedAt = t
        d.hub.publish(remoteChannel(l.id, previous.id), { name: 'remote.replaced', data: { reason: 'replaced' } })
      }
      pending.status = 'active'; pending.pendingUntil = null; pending.lastSeenAt = iso(t)
      l.state = 'connected'; l.remoteSeenAt = t; l.lastUsedAt = t
      d.hub.publish(remoteChannel(l.id, pending.id), { name: 'remote.accepted', data: { player: l.player } })
      return view(l)
    })),
    declineRemote: (id, remoteId) => run(() => tx((s) => {
      const l = ownedOpen(s, owner(), id)
      const pending = l.remotes.find(r => r.id === remoteId && r.status === 'pending')
      if (!pending) throw new PortError('not_found')
      pending.status = 'declined'; pending.endedAt = d.now()
      d.hub.publish(remoteChannel(l.id, pending.id), { name: 'remote.declined', data: { reason: 'declined' } })
    })),
  }

  const relay: LinkRelayPort = {
    pair: (input, name) => run(() => tx((s): Pairing => {
      const t = d.now()
      if (s.wrong.blockedUntil > t) throw new PortError('rate_limited')
      const c = 'code' in input
        ? s.codes.find(x => x.code === input.code)
        : s.codes.find(x => x.secret === input.secret)
      const l = c ? s.links.find(x => x.id === c.linkId && x.state !== 'ended') : null
      if (!c || !l || c.usedAt !== null || c.expiresAt < t) {
        if (t - s.wrong.firstAt > LINK_RULES.wrongWindowMinutes * MIN) s.wrong = { count: 0, firstAt: t, blockedUntil: 0 }
        s.wrong.count++
        if (s.wrong.count > LINK_RULES.wrongCodes) {
          s.wrong.blockedUntil = t + LINK_RULES.blockMinutes * MIN
          throw new PortError('rate_limited')
        }
        throw new PortError('token_invalid')
      }
      if (!allowed(l.userId)) throw new PortError('limit_reached', undefined, undefined, { key: 'phone_link.allowed', value: false, usage: null })
      c.usedAt = t
      const hasActive = !!activeRemote(l)
      const remote: MockRemote = {
        id: ulid('R'), kind: 'browser', name: (name ?? '').trim().slice(0, 80) || 'Phone browser',
        status: hasActive ? 'pending' : 'active', credential: `rl_${rand(40, '0123456789abcdef')}`, lastSeenAt: iso(t),
        createdAt: t, pendingUntil: hasActive ? t + LINK_RULES.pendingRemoteMinutes * MIN : null, endedAt: null,
      }
      l.remotes.push(remote)
      l.lastUsedAt = t
      if (hasActive) {
        const req: LinkRemote = { id: remote.id, kind: remote.kind, name: remote.name, status: remote.status, connected: false, lastSeenAt: remote.lastSeenAt }
        d.hub.publish(hostChannel(l.id), { name: 'remote.requested', data: { remote: req } })
      } else {
        l.state = 'connected'; l.remoteSeenAt = t
      }
      const { credential: _c, createdAt: _a, pendingUntil: _p, endedAt: _e, ...pub } = remote
      return {
        link: view(l),
        remote: { ...pub, connected: false },
        credential: remote.credential,
        channels: { own: remoteChannel(l.id, remote.id), presence: presenceChannel(l.id) },
        realtime: { key: 'mock', host: 'mock', port: 0, scheme: 'https' },
      }
    })),
    command: (auth, id, cmd: LinkCommand) => run(() => tx((s) => {
      const p = party(s, auth, id)
      if (p.party === p.l.player) throw new PortError('conflict')
      if (!cmd || typeof cmd.id !== 'string' || !COMMANDS.includes(cmd.type)) throw new PortError('validation', { type: 'invalid' })
      if (cmd.type === 'speed' && !(typeof cmd.wpm === 'number' && cmd.wpm >= LINK_RULES.wpmMin && cmd.wpm <= LINK_RULES.wpmMax)) throw new PortError('validation', { wpm: 'between' })
      if (cmd.type === 'goto' && !(typeof cmd.paragraph === 'number' && cmd.paragraph >= 0)) throw new PortError('validation', { paragraph: 'min' })
      assertOnline(p.l, p.l.player)
      const payload: LinkCommand = { id: cmd.id, type: cmd.type }
      if (cmd.type === 'goto') payload.paragraph = cmd.paragraph
      if (cmd.type === 'speed') payload.wpm = cmd.wpm
      send(p.l, p.l.player, { name: 'command', data: payload })
      p.l.lastUsedAt = d.now()
    })),
    ack: (auth, id, ack: LinkAck) => run(() => tx((s) => {
      const p = party(s, auth, id)
      mustBePlayer(p.l, p.party)
      if (!['applied', 'refused'].includes(ack.result) || (ack.reason && !REASONS.includes(ack.reason))) throw new PortError('validation', { result: 'invalid' })
      const to = other(p.party)
      assertOnline(p.l, to)
      const payload: LinkAck = { commandId: ack.commandId, result: ack.result }
      if (ack.reason) payload.reason = ack.reason
      send(p.l, to, { name: 'ack', data: payload })
    })),
    state: (auth, id, st: StudioState) => run(() => tx((s) => {
      const p = party(s, auth, id)
      mustBePlayer(p.l, p.party)
      const to = other(p.party)
      assertOnline(p.l, to)
      const { preview, ...rest } = st
      const payload: StudioState = { ...rest, scriptTitle: rest.scriptTitle ? rest.scriptTitle.slice(0, 120) : null }
      // FR-011 / SC-007: with previews off, no script text other than the title leaves the studio.
      if (p.l.previews && preview) {
        payload.preview = { current: (preview.current ?? '').slice(0, LINK_RULES.previewChars), next: preview.next ? preview.next.slice(0, LINK_RULES.previewChars) : null }
      }
      send(p.l, to, { name: 'state', data: payload })
    })),
    ping: (auth, id) => run(() => tx((s) => { party(s, auth, id) })),
    leave: (auth, id) => run(() => tx((s) => {
      const p = party(s, auth, id)
      if (p.party !== 'remote') throw new PortError('conflict')
      end(s, p.l, 'remote')
    })),
    requestRoles: (auth, id, player) => run(() => tx((s) => {
      const p = party(s, auth, id)
      const r = activeRemote(p.l)
      if (!r || r.kind !== 'app' || player === p.l.player) throw new PortError('conflict')
      p.l.roleRequest = { player, by: p.party, expiresAt: d.now() + LINK_RULES.roleRequestSeconds * 1000 }
      send(p.l, other(p.party), { name: 'roles.requested', data: { player, expiresAt: iso(p.l.roleRequest.expiresAt)! } })
    })),
    answerRoles: (auth, id, accept) => run(() => tx((s) => {
      const p = party(s, auth, id)
      const req = p.l.roleRequest
      if (!req || req.by === p.party) throw new PortError('not_found')
      p.l.roleRequest = null
      if (!accept) return send(p.l, req.by, { name: 'roles.declined', data: { reason: 'declined' } })
      p.l.player = req.player
      const ev: LinkEvent = { name: 'roles.changed', data: { player: req.player } }
      send(p.l, 'host', ev); send(p.l, 'remote', ev)
    })),
  }

  const server: ChannelAuthoriser = {
    authorise(auth, channel) {
      const m = /^(private|presence)-link\.([0-9A-Za-z]+)(?:\.(host|remote)(?:\.([0-9A-Za-z]+))?)?$/.exec(channel)
      if (!m) return null
      const [, type, linkId, target, targetRemote] = m
      const s = read()
      const l = s.links.find(x => x.id === linkId)
      if (!l || l.state === 'ended') return null
      const who = resolve(s, auth, l)
      if (!who) {
        // A waiting second phone may listen on its own channel only, to hear the owner's answer.
        if (auth.kind === 'remote' && type === 'private' && target === 'remote') {
          const pending = l.remotes.find(r => r.credential === auth.credential && r.status === 'pending')
          return pending && pending.id === targetRemote ? { member: null } : null
        }
        return null
      }
      if (type === 'private') {
        if (target === 'host' && who.party === 'host' && !targetRemote) return { member: null }
        if (target === 'remote' && who.party === 'remote' && targetRemote === who.remote!.id) return { member: null }
        return null
      }
      if (target) return null
      return { member: who.party === 'host' ? hostMember : remoteMember(who.remote!.id) }
    },
  }

  return {
    links,
    relay,
    server,
    endForScript(scriptId) {
      tx(s => s.links.filter(l => l.scriptId === scriptId && l.state !== 'ended').forEach(l => end(s, l, 'script_deleted')))
    },
    endWith(linkId, reason) {
      tx((s) => { const l = s.links.find(x => x.id === linkId); if (l) end(s, l, reason) })
    },
  }
}
