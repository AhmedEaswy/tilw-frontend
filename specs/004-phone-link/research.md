# Research: Web app — phone link

Decisions for [plan.md](plan.md). Backend rules, channels and events are fixed by `backend/specs/003-phone-link` ([openapi.yaml](../../../backend/specs/003-phone-link/contracts/openapi.yaml), [realtime.md](../../../backend/specs/003-phone-link/contracts/realtime.md)); this file only decides how the web app meets them.

## R1. Realtime client: `pusher-js`, loaded only when a link opens

- **Decision**: use `pusher-js` 8 (Pusher protocol 7, which Reverb speaks), imported dynamically by the HTTP realtime adapter the first time a link is opened in the studio or on the remote page. Options: `wsHost`/`wsPort`/`wssPort`/`forceTLS` from the realtime settings, `enabledTransports: ['ws', 'wss']`, `activityTimeout: 5000`, `pongTimeout: 3000` (offline noticed within ~8 s, FR-017), `cluster: ''`. Private and presence auth go through `channelAuthorization.customHandler`, which calls `POST /api/broadcasting/auth` with the app's own HTTP client, so cookies, the XSRF token and the remote's bearer credential are handled in one place.
- **Rationale**: pusher-js already handles ping/pong, reconnect with backoff, presence member lists and subscription errors, which are exactly the parts the spec leans on (FR-017, Story 2). A dynamic import keeps it off every page that doesn't use phone link (the landing, the library, the editor).
- **Alternatives**: `laravel-echo` adds a wrapper whose extras (whisper, client events, Laravel channel naming) are switched off or unused here, and it still needs pusher-js. A hand-written Pusher client (the backend smoke test is one) is ~80 lines, but reconnect, backoff and edge cases would be ours to keep correct. Polling over HTTP would miss the 0.5 s target (SC-002).

## R2. QR code: `uqr`, rendered as inline SVG in the browser

- **Decision**: `uqr` (zero-dependency, about 10 KB) encodes the remote address. It is rendered as an inline SVG, dark modules on a white tile with a 4-module quiet zone, in light and dark themes alike, at least 200 px on desktop. The 6-digit code and the address are shown as text beneath it (spec edge case).
- **Rationale**: the address carries the one-time secret, so it must never go to a third-party QR service. SVG stays crisp at any size and needs no canvas.
- **Alternatives**: `qrcode` is larger and pulls canvas/Node shims. An external QR image API would leak the secret (rejected).

## R3. Ports: three new interfaces

- **Decision**:
  - `LinkPort`: the owner's actions, using the session cookie: start, current, list, new code, update previews, end, accept/decline a remote.
  - `LinkRelayPort`: the actions any party makes, each taking a `LinkAuth` (`{ kind: 'session' }` for the studio, `{ kind: 'remote', credential }` for the phone): pair, commands, acks, state, ping, leave, roles request/accept/decline.
  - `RealtimePort`: connects with a `LinkAuth` and realtime settings, and returns a `RealtimeConnection` for subscribing to the link's private and presence channels, receiving events, and watching connection and member changes.
  
  Full shapes are in [contracts/ports.md](contracts/ports.md).
- **Rationale**: the phone has no account, so its calls can't go through ports that assume a session. Splitting by who may call keeps the remote page from ever touching account ports. The live channel is a separate port so the mock can replace the socket entirely (constitution III, FR-021, FR-022).
- **Alternatives**: one `PhoneLinkPort` holding everything makes the remote page depend on owner-only methods. Putting realtime inside the stores breaks principle III.

## R4. The remote's HTTP calls reuse the existing client, with a bearer header

- **Decision**: the HTTP adapter's relay methods call the existing `createHttpClient` with `Authorization: Bearer rl_…` per request when `auth.kind === 'remote'`. The client keeps sending the XSRF header.
- **Rationale**: the remote page is served from the frontend origin, which Sanctum treats as stateful. Writes from it therefore still need the CSRF token, even with a bearer credential, and the client already fetches and sends that token. The backend resolves the `rl_` credential before the session (`PhoneLinks::resolveParty`), so a stray cookie on a shared phone can't make the phone act as the owner.
- **Alternatives**: a second, cookie-less fetch wrapper would fail CSRF on writes from the stateful origin.

## R5. Where the realtime settings come from

- **Decision**: the studio reads `runtimeConfig.public.realtime` (`key`, `host`, `port`, `scheme`; `NUXT_PUBLIC_REALTIME_*`). The phone uses `Pairing.realtime` from the pair response and stores it with its pairing. When the studio has no realtime settings in `http` mode, Connect phone shows "Phone link isn't available right now" and never starts a link (spec edge case).
- **Rationale**: `LinkWithCode` doesn't carry realtime settings, but `Pairing` does. Using the server's answer on the phone avoids a second source of truth for a page that has no account.

## R6. Studio orchestration: a link store plus a player registry

- **Decision**:
  - **Link store**: a Pinia `useLinkStore` owns the studio side. It holds the link, its status, the pending remote, presence, previews, role requests and the history list, and the realtime connection for the open link. It lives for the whole studio session (not per page), so moving between rehearse, record and the library keeps the link (spec edge case).
  - **Player registry**: the rehearse and record pages register a player with `useLinkPlayer({ apply, snapshot })`:
    - `apply(command)` runs the same functions as the page's own buttons and shortcuts (`engine.toggle/next/prev/goTo/restart`, the speed and size setters, and on the record page `startCountdown`/`stopTake`). It returns `{ result, reason? }`.
    - `snapshot()` returns the state without `seq`.
    
    With no player registered, or one for another script, commands are refused with `unsupported` ("The studio isn't reading this script").
  - **State sending**: the store adds `seq` and sends state:
    - in full on `pusher:member_added` and after a reconnect;
    - otherwise coalesced to at most one request every 150 ms, sending the newest state. That keeps it under the backend's 10 per second while staying well inside the 0.5 s target.
- **Rationale**: the reader engine and recorder are page-local today. A registry lets commands use exactly the same code path as the person's own controls (FR-006) without moving page state into a store.
- **Alternatives**: moving the engine into a global store is a large refactor of release-1 pages, with layout risk on reading surfaces (principle V).

## R7. Mapping refusals to the contract's reasons

- **Decision**: the contract's reasons are fixed (`at_end`, `at_start`, `not_recording_mode`, `devices_off`, `already_recording`, `not_recording`, `saving`, `limit`, `unsupported`). `unsupported` covers everything that isn't one of the others: another script or no reading page open, the countdown, a dialog open over the reader. Each reason has phone-side text in the locale files. Commands are never queued (FR-009).
- **Rationale**: the backend validates the reason enum, so a new reason would need a backend change. Plain words on the phone matter more than precise codes.

## R8. One hosting tab

- **Decision**: the studio tab that starts or resumes a link takes the Web Lock `tilw-link-host`. Other studio tabs see the lock is held and show "Phone link is open in another tab", with **Move here**, which posts on `BroadcastChannel('tilw-link')`: the holder releases its connection and the asking tab takes the lock. Without Web Locks, BroadcastChannel claims are used, the same fallback as the release-2 upload queue.
- **Rationale**: the backend authorises the host channel for any tab with the session cookie, so two tabs would both apply each command. The upload queue already solves "one owner tab" this way (`stores/uploads.ts`).

## R9. The remote page

- **Decision**:
  - **Route and layout**: `pages/remote.vue` with `routeRules: { '/remote': { ssr: false } }`, a minimal `remote` layout (no studio chrome), `noindex`, and no account calls.
  - **Opening the page**:
    1. If the address has a `#secret`, the page pairs with it, then removes the hash with `history.replaceState` so the secret doesn't stay in history or get re-used on reload.
    2. Otherwise, if a stored pairing was used within the last 10 minutes, it reconnects with it.
    3. Otherwise it shows the code entry.
  - **Stored pairing**: kept in `localStorage['tilw:remote:v1']` as `{ linkId, remoteId, credential, channels, realtime, lastSeenAt }`, and deleted on `link.ended`, `remote.replaced`, `remote.declined` or a `401` (FR-014).
  - **Commands**: a pending map with a 5-second timer for each command. The button shows working, then done / refused (reason) / not delivered. Controls are disabled while the studio is offline (FR-011, FR-012).
  - **Keeping the screen on**: Screen Wake Lock is requested while connected and requested again on `visibilitychange` (FR-015). Where it isn't supported, nothing is shown.
  - **Language**: with no saved choice, the page uses English when `navigator.language` starts with `en`, otherwise Arabic, and remembers a manual switch in `localStorage['tilw:remote:locale']` (FR-016). This is specific to the remote page: the studio keeps the account's language.
- **Rationale**: the phone has no account and may be shared. Removing the hash and forgetting the pairing quickly limits what a borrowed phone keeps. `localStorage` (not a cookie) keeps the credential out of every request except the ones that send it on purpose.
- **Alternatives**: `sessionStorage` would lose the pairing when the phone kills the tab in the background, which happens often on mobile. That breaks Story 2.

## R10. A remote controls component shared by both sides

- **Decision**: `components/link/RemoteControls.vue`, a presentational component: state in, commands out, plus pending/result display. It is used by the remote page, and in the studio when roles are swapped and the Tilw app reads (Story 4 #5).
- **Rationale**: one set of controls, tested once, appears in both places.

## R11. Mock adapter: a fake realtime server between tabs

- **Decision**:
  - **Shared state**: `services/mock/link.ts` keeps links, codes, remotes and role requests in the mock KV (`localStorage`, shared by same-origin tabs, like the rest of the mock). It applies the backend's rules: 5-minute single-use codes, the same answer for wrong, used and expired codes, 5 wrong tries then `rate_limited`, one active remote with a 2-minute pending window, previews stripped when off, the 10-minute idle end, `partner_offline` when the receiver isn't present, and end reasons.
  - **Fake socket**: `services/mock/realtime.ts` implements `RealtimePort` on `BroadcastChannel('tilw-link-mock')`. Events are addressed by channel name.
    - **Presence**: each connection sends a heartbeat every 2 s; a member missing for 6 s is removed.
    - **Offline knob**: "simulate offline" on `/__mock` stops one tab's heartbeats and deliveries.
    - **Tilw app knob**: "pair a mock Tilw app" adds an app remote that can be the player. It auto-acks commands and sends state, which exercises the role swap without the mobile app.
- **Rationale**: every story must pass its independent test against the mock (principle VI, FR-022). Two tabs of one browser are the closest the mock can get to two devices.
- **Alternatives**: a single-tab simulation would hide the real problems (presence, ordering, two hosts).

## R12. Plan limit and the plan page

- **Decision**:
  - `phone_link.allowed` joins `KNOWN_LIMITS` (`utils/limits.ts`). It shows as a yes/no row on Plan & usage (FR-020).
  - Connect phone reads `plan.limit('phone_link.allowed')`:
    - `false` shows the locked state with the release-2 `LimitDialog` and upgrade path.
    - `undefined` (not loaded yet) shows the button, and a `limit_reached` answer from start opens the same dialog (FR-004).
- **Rationale**: this reuses the release-2 limit handling as is. Free and Pro both allow phone link at launch, so the locked state mainly covers admin overrides.

## R13. Calm reading surfaces

- **Decision**:
  - **Link indicator**: a small status dot and label in the rehearse and record mastheads, which opens the panel.
  - **Requests** (a second phone, a role swap): a non-modal popover anchored to the indicator, which never overlaps the text column.
  - **During countdown and recording**: requests only add a badge to the indicator.
  - **Incoming commands**: they don't move focus, and nothing on the surface changes size when the link status changes (principle V, Story 4 #2).
- **Rationale**: the person is reading on camera, and nothing should pop over the text.

## R14. Takes are never stopped by the link

- **Decision**: the link store and its event handlers have no access to the recorder. Only the record page's registered player can call `stopTake`, and only for an explicit `recordStop` command. A unit test checks that `link.ended`, `remote.replaced` and a lost connection during a take leave the recorder running (FR-008, SC-005).

## R15. End reasons and phone-side messages

- **Decision**: messages are i18n keys `link.ended.{owner|remote|idle|script_deleted|signed_out|device_revoked|email_changed|account_deleted|limit}`, plus remote-only `link.remote.{replaced|declined|lapsed|waiting}`, and code errors `link.pair.{invalid|tooMany}`. Unknown reasons fall back to a generic "This link ended".
