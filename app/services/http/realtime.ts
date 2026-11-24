/**
 * Feature 004 (phone link), HTTP adapter: the live channel on Laravel Reverb over the Pusher protocol (research R1).
 *
 * `pusher-js` is imported only when a link connects, so pages without phone link never load it. Channel authorisation
 * goes through POST /api/broadcasting/auth with the app's own HTTP client, so the studio's cookie + XSRF token and the
 * phone's `rl_` credential are handled in one place. Clients never send over the socket (backend realtime.md).
 */
import type { RealtimeConnection, RealtimePort } from '../ports'
import {
  LINK_EVENTS, PortError, type ConnectionState, type LinkAuth, type LinkEvent, type PresenceMember, type RealtimeSettings,
} from '../types'
import type { HttpClient } from './client'

/** The slice of pusher-js used here (kept small so tests can pass a fake). */
export interface PusherLike {
  connection: { state: string; bind(event: 'state_change', cb: (s: { current: string }) => void): void }
  subscribe(name: string): PusherChannelLike
  unsubscribe(name: string): void
  disconnect(): void
}
export interface PusherChannelLike {
  bind(event: string, cb: (data: unknown) => void): void
  bind_global(cb: (event: string, data: unknown) => void): void
  unbind_all(): void
}
export type PusherFactory = (key: string, options: Record<string, unknown>) => PusherLike | Promise<PusherLike>

const defaultFactory: PusherFactory = async (key, options) => {
  const mod = await import('pusher-js')
  const Pusher = (mod as unknown as { default: new (k: string, o: Record<string, unknown>) => PusherLike }).default
  return new Pusher(key, options)
}

const STATES: Record<string, ConnectionState> = {
  initialized: 'connecting',
  connecting: 'connecting',
  connected: 'connected',
  unavailable: 'unavailable',
  failed: 'unavailable',
  disconnected: 'disconnected',
}

function toMember(id: string, info: unknown): PresenceMember {
  const i = (info ?? {}) as { party?: string; remoteId?: string | null }
  const party = i.party === 'remote' || id.startsWith('remote:') ? 'remote' : 'host'
  return { id, party, remoteId: party === 'remote' ? (i.remoteId ?? id.slice('remote:'.length)) : null }
}

export function createHttpRealtime(opts: { client: HttpClient; settings: RealtimeSettings | null; factory?: PusherFactory }): RealtimePort {
  const factory = opts.factory ?? defaultFactory
  return {
    // Runtime config from env arrives as strings; the port must be a number for pusher-js.
    settings: () => (opts.settings && opts.settings.key ? { ...opts.settings, port: Number(opts.settings.port) || 443 } : null),
    connect(auth: LinkAuth, settings: RealtimeSettings): RealtimeConnection {
      let state: ConnectionState = 'connecting'
      let closed = false
      const stateCbs = new Set<(s: ConnectionState) => void>()
      const setState = (s: ConnectionState) => {
        if (s === state) return
        state = s
        stateCbs.forEach(cb => cb(s))
      }
      const headers: Record<string, string> = auth.kind === 'remote' ? { Authorization: `Bearer ${auth.credential}` } : {}
      const tls = settings.scheme === 'https'
      const pusher = Promise.resolve(factory(settings.key, {
        cluster: '',
        wsHost: settings.host,
        wsPort: settings.port,
        wssPort: settings.port,
        forceTLS: tls,
        enabledTransports: tls ? ['wss'] : ['ws'],
        disableStats: true,
        // Offline noticed within about 8 seconds (backend realtime.md, FR-017).
        activityTimeout: 5000,
        pongTimeout: 3000,
        channelAuthorization: {
          customHandler: (
            params: { socketId: string; channelName: string },
            callback: (error: Error | null, data: { auth: string; channel_data?: string } | null) => void,
          ) => {
            opts.client.post<{ auth: string; channel_data?: string }>('/api/broadcasting/auth', { socket_id: params.socketId, channel_name: params.channelName }, { headers })
              .then(data => callback(null, data))
              .catch(e => callback(e instanceof Error ? e : new Error(String(e)), null))
          },
        },
      })).then((p) => {
        p.connection.bind('state_change', ({ current }) => !closed && setState(STATES[current] ?? 'connecting'))
        setState(STATES[p.connection.state] ?? 'connecting')
        return p
      })

      /** Subscribe and wait for Pusher's answer. */
      async function join(name: string, bindings: (ch: PusherChannelLike) => void) {
        const p = await pusher
        if (closed) throw new PortError('network')
        const ch = p.subscribe(name)
        bindings(ch)
        const data = await new Promise<unknown>((resolve, reject) => {
          ch.bind('pusher:subscription_succeeded', resolve)
          ch.bind('pusher:subscription_error', (err: unknown) => {
            const status = (err as { status?: number } | null)?.status
            reject(new PortError(status === 401 || status === 403 ? 'unauthenticated' : 'network'))
          })
        })
        return { p, ch, data }
      }

      return {
        get state() { return closed ? 'disconnected' : state },
        onState(cb) {
          stateCbs.add(cb)
          return () => { stateCbs.delete(cb) }
        },
        async subscribe(name, onEvent) {
          const { p, ch } = await join(name, (c) => {
            c.bind_global((event, data) => {
              if ((LINK_EVENTS as readonly string[]).includes(event)) onEvent({ name: event, data } as LinkEvent)
            })
          })
          return () => { ch.unbind_all(); p.unsubscribe(name) }
        },
        async presence(name, on) {
          // Bound before the first subscription resolves, and kept: after a reconnect Pusher re-subscribes and sends
          // the member list again, which is how each side learns the other is still (or again) there.
          const report = (data: unknown) => {
            const members: PresenceMember[] = []
            const set = data as { each?: (cb: (m: { id: string; info: unknown }) => void) => void } | null
            set?.each?.(m => members.push(toMember(m.id, m.info)))
            on.members(members)
          }
          const { p, ch } = await join(name, (c) => {
            c.bind('pusher:subscription_succeeded', report)
            c.bind('pusher:member_added', (m: unknown) => {
              const mm = m as { id: string; info: unknown }
              on.added(toMember(mm.id, mm.info))
            })
            c.bind('pusher:member_removed', (m: unknown) => {
              const mm = m as { id: string; info: unknown }
              on.removed(toMember(mm.id, mm.info))
            })
          })
          return () => { ch.unbind_all(); p.unsubscribe(name) }
        },
        close() {
          if (closed) return
          closed = true
          void pusher.then(p => p.disconnect()).catch(() => {})
          stateCbs.forEach(cb => cb('disconnected'))
        },
      }
    },
  }
}
