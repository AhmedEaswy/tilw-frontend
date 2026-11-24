# Data model: Web app — phone link

Client-side shapes and stores. Server shapes mirror `backend/specs/003-phone-link/contracts/openapi.yaml` (camelCase as sent). Port signatures: [contracts/ports.md](contracts/ports.md). Decisions: [research.md](research.md).

## Types (`app/services/types.ts`)

```ts
type LinkParty = 'host' | 'remote'
type LinkStateName = 'waiting' | 'connected' | 'ended'
type LinkEndReason = 'owner' | 'remote' | 'idle' | 'script_deleted' | 'signed_out' | 'device_revoked'
  | 'email_changed' | 'account_deleted' | 'limit'

interface PairingCode { code: string; url: string; expiresAt: string }

interface LinkRemote {
  id: string
  kind: 'browser' | 'app'
  name: string
  status: 'pending' | 'active' | 'replaced' | 'declined' | 'ended'
  connected: boolean
  lastSeenAt: string | null
}

interface PhoneLink {
  id: string
  scriptId: string | null
  scriptTitle: string | null
  host: { kind: 'web' | 'app'; label: string; connected: boolean }
  player: LinkParty
  previews: boolean
  state: LinkStateName
  remote: LinkRemote | null
  pendingRemote: LinkRemote | null
  startedAt: string
  lastUsedAt: string
  endedAt: string | null
  endReason: LinkEndReason | null
}

interface PhoneLinkWithCode extends PhoneLink { code: PairingCode }

interface RealtimeSettings { key: string; host: string; port: number; scheme: 'http' | 'https' }

interface Pairing {
  link: PhoneLink
  remote: LinkRemote
  credential: string | null          // rl_… for a phone browser
  channels: { own: string; presence: string }
  realtime: RealtimeSettings
}

type CommandType = 'play' | 'pause' | 'next' | 'previous' | 'goto' | 'restart' | 'faster' | 'slower' | 'speed'
  | 'textBigger' | 'textSmaller' | 'recordStart' | 'recordStop'
interface LinkCommand { id: string; type: CommandType; paragraph?: number; wpm?: number }  // id: uuid

type RefusalReason = 'at_end' | 'at_start' | 'not_recording_mode' | 'devices_off' | 'already_recording'
  | 'not_recording' | 'saving' | 'limit' | 'unsupported'
interface LinkAck { commandId: string; result: 'applied' | 'refused'; reason?: RefusalReason }

type RecordingStateName = 'unavailable' | 'idle' | 'countdown' | 'recording' | 'saving' | 'saved' | 'failed'
interface StudioState {
  seq: number
  scriptTitle: string | null       // ≤ 120
  paragraph: number                // 0-based
  paragraphCount: number
  playing: boolean
  mode: 'constant' | 'manual'
  wpm: number                      // 60–220
  fontSize: 'S' | 'M' | 'L' | 'XL'
  recording: { state: RecordingStateName; startedAt?: string }
  preview?: { current: string; next: string | null }   // ≤ 120 each; absent when previews are off
}

type LinkAuth = { kind: 'session' } | { kind: 'remote'; credential: string }
```

`PortErrorCode` gains `partner_offline` (409). The HTTP client's `CODES` list and the mock both use it.

## Realtime events (`app/services/types.ts`)

```ts
type LinkEvent =
  | { name: 'command'; data: LinkCommand }
  | { name: 'ack'; data: LinkAck }
  | { name: 'state'; data: StudioState }
  | { name: 'remote.requested'; data: { remote: LinkRemote } }
  | { name: 'remote.replaced'; data: { reason: 'replaced' } }
  | { name: 'remote.accepted'; data: { player: LinkParty } }
  | { name: 'remote.declined'; data: { reason: 'declined' | 'lapsed' } }
  | { name: 'roles.requested'; data: { player: LinkParty; expiresAt: string } }
  | { name: 'roles.declined'; data: { reason: 'recording' | 'declined' | 'lapsed' } }
  | { name: 'roles.changed'; data: { player: LinkParty } }
  | { name: 'link.updated'; data: { previews: boolean } }
  | { name: 'link.ended'; data: { reason: LinkEndReason } }

interface PresenceMember { id: string /* 'host' | 'remote:<id>' */; party: LinkParty; remoteId: string | null }
type ConnectionState = 'connecting' | 'connected' | 'unavailable' | 'disconnected'
```

## Stores

### `useLinkStore` (studio, `app/stores/link.ts`)

| Field | Type | Notes |
|---|---|---|
| `link` | `PhoneLink \| null` | current open link of this studio, refreshed from events |
| `code` | `PairingCode \| null` | shown in the panel; cleared once a remote is active |
| `status` | `'idle' \| 'starting' \| 'waiting' \| 'connected' \| 'partnerOffline' \| 'ended' \| 'unavailable' \| 'locked' \| 'otherTab'` | derived from link state, presence, connection, plan, tab lock |
| `endReason` | `LinkEndReason \| null` | kept until the panel is closed or a new link starts |
| `pendingRemote` | `LinkRemote \| null` | from `remote.requested`; cleared on accept/decline/lapse |
| `roleRequest` | `{ from: LinkParty; player: LinkParty; expiresAt: string } \| null` | |
| `partnerPresent` | `boolean` | the other party is in the presence channel |
| `connection` | `ConnectionState` | this tab's socket |
| `history` | `PhoneLink[]` | Settings → Phone links, loaded on demand |
| `remoteState` / `pending` | as in `useRemoteStore` | used only while the studio is the remote (roles swapped) |

Actions: `open(scriptId)`, `newCode()`, `setPreviews(on)`, `end()`, `acceptRemote()`, `declineRemote()`, `requestRoles(player)`, `answerRoles(accept)`, `loadHistory()`, `endFromHistory(id)`, `moveHere()`. The store keeps a private `seq` counter and a coalescing state sender (research R6).

**Status transitions**

```text
idle ──open──▶ starting ──ok──▶ waiting ──member_added (remote)──▶ connected
                    └─limit_reached─▶ locked        connected ⇄ partnerOffline (member_removed / added)
any ──link.ended / end()──▶ ended ──open──▶ starting
any ──lock held by another tab──▶ otherTab ──moveHere──▶ (previous status)
http mode with no realtime settings ──▶ unavailable
```

### Player registry (`app/composables/useLinkPlayer.ts`)

```ts
interface LinkPlayer {
  scriptId: string
  apply(cmd: LinkCommand): { result: 'applied' } | { result: 'refused'; reason: RefusalReason }
  snapshot(): Omit<StudioState, 'seq'>
}
```

Rehearse and record register one on mount and unregister on unmount. Each page calls `useLinkPlayer().changed()` after any change that affects the snapshot (paragraph, playing, settings, recording phase). The store coalesces these calls.

### `useRemoteStore` (phone, `app/stores/remote.ts`)

| Field | Type | Notes |
|---|---|---|
| `phase` | `'start' \| 'pairing' \| 'waitingAccept' \| 'connected' \| 'studioOffline' \| 'ended'` | |
| `pairing` | `StoredPairing \| null` | see below |
| `state` | `StudioState \| null` | latest by `seq`; older ones dropped (FR-013) |
| `player` | `LinkParty` | always `host` for a browser remote |
| `pending` | `Map<commandId, { type; sentAt; timer }>` | 5 s timeout → not delivered |
| `lastResult` | `{ type: CommandType; outcome: 'applied' \| 'refused' \| 'notDelivered'; reason?: RefusalReason } \| null` | shown under the controls |
| `endMessage` | i18n key | from `link.ended`, `remote.replaced`, `remote.declined`, `401`, code errors |

Actions: `start()` (hash → pair, or stored → reconnect, or show code entry), `pairWithCode(code)`, `send(type, extra?)`, `leave()`.

### `StoredPairing` (phone, `localStorage['tilw:remote:v1']`)

```ts
interface StoredPairing {
  linkId: string
  remoteId: string
  credential: string           // rl_…
  channels: { own: string; presence: string }
  realtime: RealtimeSettings
  lastSeenAt: number           // ms; updated on every event or successful call
}
```

Used to reconnect only while `now − lastSeenAt < 10 min`. Deleted on end, replace, decline or `401`. Nothing else about the studio or the account is stored on the phone.

## Mock data (`app/services/mock/link.ts`)

KV key `tilw:mock:links:v1`: `{ links: MockLink[], codes: { linkId, codeHash, secret, expiresAt, usedAt }[], wrong: { count, firstAt, blockedUntil } }`. `MockLink` is a `PhoneLink` plus `remotes: (LinkRemote & { credential?: string })[]`, `roleRequest` and `seen: { host: number, remote: number }`. Presence lives only in memory on the BroadcastChannel (heartbeats), never in KV.

## Validation rules (from the backend, enforced in mock and shown by the UI)

- Code: 6 digits, 5 minutes, single use. Wrong, used and expired codes all give `token_invalid`; 5 wrong tries in 15 minutes give `rate_limited`.
- Commands: `goto.paragraph ≥ 0`; `speed.wpm` 60–220. Faster and slower step the same as the studio's own speed control.
- State: previews ≤ 120 characters each; `scriptTitle` ≤ 120.
- Sending a command or state when the receiver isn't present gives `partner_offline`.
