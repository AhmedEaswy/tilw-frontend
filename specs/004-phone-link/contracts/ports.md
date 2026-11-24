# Port contract delta: phone link

Additions to the service ports (`app/services/ports.ts`) on top of [001's ports.md](../../001-studio-frontend/contracts/ports.md) and [003's delta](../../003-accounts-plans-storage/contracts/ports.md). Types are in [data-model.md](../data-model.md). The mock adapter (`services/mock`) and the HTTP adapter (`services/http`) implement every method and pass one shared contract suite (`tests/unit/link-ports.test.ts`), as in releases 1 and 2.

`Services` gains `links: LinkPort`, `relay: LinkRelayPort` and `realtime: RealtimePort`. `links` is wrapped by the plugin's `unauthenticated` guard like the other account ports. `relay` and `realtime` are **not** wrapped, because the phone has no session to lose: a `401` there means the pairing is gone.

## LinkPort (owner, session)

| Method | HTTP (backend 003) | Resolves | Rejects |
|---|---|---|---|
| `start(scriptId)` | `POST /api/links` | `PhoneLinkWithCode` (an open link for this script and studio is reused with a fresh code) | `limit_reached` (`phone_link.allowed`), `not_found`, `rate_limited` |
| `current(scriptId)` | `GET /api/links/current?scriptId=` | `PhoneLink \| null` | |
| `list()` | `GET /api/links` | `PhoneLink[]`, open and ended ≤ 30 days, newest first | |
| `newCode(linkId)` | `POST /api/links/{id}/codes` | `PairingCode` | `not_found`, `rate_limited` |
| `update(linkId, { previews })` | `PATCH /api/links/{id}` | `PhoneLink` | `not_found` |
| `end(linkId)` | `DELETE /api/links/{id}` | `void` | `not_found` |
| `acceptRemote(linkId, remoteId)` | `POST /api/links/{id}/remotes/{remoteId}/accept` | `PhoneLink` | `not_found` (no longer waiting) |
| `declineRemote(linkId, remoteId)` | `POST …/decline` | `void` | `not_found` |

## LinkRelayPort (any party, `LinkAuth`)

| Method | HTTP | Resolves | Rejects |
|---|---|---|---|
| `pair({ code } \| { secret }, name?)` | `POST /api/links/pair` (public) | `Pairing` | `token_invalid` (wrong, used or expired, always the same), `rate_limited`, `limit_reached` |
| `command(auth, linkId, cmd)` | `POST /api/links/{id}/commands` | `void` (202) | `partner_offline`, `conflict` (sender is the player), `rate_limited`, `unauthenticated` |
| `ack(auth, linkId, ack)` | `POST /api/links/{id}/acks` | `void` | `partner_offline`, `conflict` |
| `state(auth, linkId, state)` | `PUT /api/links/{id}/state` | `void` | `partner_offline`, `rate_limited` |
| `ping(auth, linkId)` | `POST /api/links/{id}/ping` | `void` | `unauthenticated` |
| `leave(auth, linkId)` | `POST /api/links/{id}/leave` (remote only) | `void` | |
| `requestRoles(auth, linkId, player)` | `POST /api/links/{id}/roles` | `void` | `conflict` (browser remote, or a take running) |
| `answerRoles(auth, linkId, accept)` | `POST …/roles/accept` or `…/roles/decline` | `void` | `not_found` (no request, or it lapsed) |

`auth.kind === 'remote'` adds `Authorization: Bearer <credential>` to the request. The XSRF handling of the shared client still applies (research R4). `unauthenticated` from a remote call means the pairing is no longer valid: the remote store forgets it.

## RealtimePort

```ts
interface RealtimePort {
  /** null when phone link can't reach a realtime server (http mode without settings). */
  settings(): RealtimeSettings | null
  connect(auth: LinkAuth, settings: RealtimeSettings): RealtimeConnection
}

interface RealtimeConnection {
  readonly state: ConnectionState
  onState(cb: (s: ConnectionState) => void): () => void
  /** Private channel; resolves once subscribed, rejects when authorisation is refused. */
  subscribe(channel: string, onEvent: (e: LinkEvent) => void): Promise<() => void>
  /** Presence channel: the initial members, then additions and removals. */
  presence(channel: string, on: {
    members: (m: PresenceMember[]) => void
    added: (m: PresenceMember) => void
    removed: (m: PresenceMember) => void
  }): Promise<() => void>
  close(): void
}
```

- **HTTP adapter** (`services/http/realtime.ts`): lazily imports `pusher-js` and authorises through `POST /api/broadcasting/auth` with the same `LinkAuth`. Event names arrive without a prefix (`command`, `link.ended`, …), and presence uses `pusher:member_added` and `pusher:member_removed` (realtime.md).
- **Mock adapter** (`services/mock/realtime.ts`): `BroadcastChannel('tilw-link-mock')`, with 2-second heartbeats and a 6-second presence timeout. `/__mock` can mark a tab offline (research R11).

## Unchanged

Release-1 and release-2 ports keep their behaviour. `PlanPort.myPlan()` already returns `phone_link.allowed` among the limits. The app now lists it in `KNOWN_LIMITS`.
