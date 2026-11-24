---
description: "Task list for Web app — phone link (release 2)"
---

# Tasks: Web app — phone link (release 2)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md), Figma frames in [gaps.md](./gaps.md). Backend counterpart: `backend/specs/003-phone-link` (complete; contracts `contracts/openapi.yaml` and `contracts/realtime.md`).

**Tests**: Included (constitution VI). For each story: Vitest for ports and stores, where the mock and HTTP adapters share one contract suite in `tests/unit/link-ports.test.ts`, and a Playwright flow with two pages in one browser context (studio and phone) against the mock. Write the tests first and see them fail.

**Conventions**:
- Format: `[ID] [P?] [Story] Description`. `[P]` means the task can run in parallel.
- Figma frames are named by their gaps.md row (L1–L8, page `08 · Release 2 · Phone link`, file `t9xEIr22yKOj7o2Ft32hxb`).
- Paths are relative to `frontend/`.
- **Release-1 reading surfaces change only by the masthead indicator and panel.** Nothing on them is restyled, and the text column never changes size or focus because of the link.
- Each screen task ends with a visual check against its frame in Arabic, plus English via the locale files.

## Phase 1: Setup

- [ ] T001 Draw the phone-link frames L1–L8 on a new Figma page `08 · Release 2 · Phone link`, from page `01 · Design system` (desktop Arabic light first, plus the phone frames for L4–L6). Record each node id in `specs/004-phone-link/gaps.md`. **No screen task (T020 onward) starts before its frame exists** (constitution II).
- [ ] T002 [P] Add `pusher-js@^8` and `uqr` to `package.json` dependencies and install them.
- [ ] T003 [P] Add `runtimeConfig.public.realtime` (`key`, `host`, `port`, `scheme`; empty by default, `NUXT_PUBLIC_REALTIME_*`) and `routeRules['/remote'] = { ssr: false }` in `nuxt.config.ts`. Make `/remote` `noindex` (add it to the robots/noindex handling the app already has for `/app`).
- [ ] T004 [P] Add the i18n key groups `link.*` (panel, status, reasons, requests, history), `remote.*` (start, controls, results, end screens) and `limits.phone_link.allowed` to `i18n/locales/ar.json` and `i18n/locales/en.json` (each story fills its keys).

## Phase 2: Foundation (blocks all stories)

- [ ] T005 Add every type in data-model.md to `app/services/types.ts`:
  - the link and remote shapes: `LinkParty`, `PhoneLink`, `PhoneLinkWithCode`, `PairingCode`, `LinkRemote`, `Pairing`, `RealtimeSettings`;
  - the message shapes: `LinkCommand`, `CommandType`, `LinkAck`, `RefusalReason`, `StudioState`;
  - the realtime shapes: `LinkEvent`, `PresenceMember`, `ConnectionState`, `LinkAuth`;
  - `'partner_offline'` in `PortErrorCode`.
- [ ] T006 Add `LinkPort`, `LinkRelayPort`, `RealtimePort` and `RealtimeConnection` to `app/services/ports.ts`, exactly as in contracts/ports.md, and add `links`, `relay` and `realtime` to `Services`.
- [ ] T007 Add `'partner_offline'` (409) to `CODES` in `app/services/http/client.ts`, and give it a fallback text in `app/composables/useErrorText.ts`.
- [ ] T008 Mock link backend in `app/services/mock/link.ts`, persisted in KV `tilw:mock:links:v1`. It applies the backend rules (research R11):
  - codes: 6 digits plus a URL secret, 5 minutes, single use, the same `token_invalid` for wrong, used and expired codes, and `rate_limited` after 5 wrong tries in 15 minutes;
  - start: reuses an open link for the same script and host;
  - remotes: one active, a second one pending for 2 minutes, accept/decline;
  - previews are stripped when off;
  - role requests last 30 seconds;
  - end: the 10-minute idle rule on the mock clock, and end reasons;
  - `partner_offline` when the receiver has no live heartbeat.
- [ ] T009 Mock realtime in `app/services/mock/realtime.ts`: a `RealtimePort` on `BroadcastChannel('tilw-link-mock')`.
  - Channel-addressed events, and authorisation of the same channel rules as the backend (host, own remote, presence; a pending remote may join only its own channel).
  - Presence: heartbeats every 2 s, and a member is removed after 6 s without one.
  - Connection-state callbacks, and a per-tab `offline` knob that stops heartbeats and delivery.
- [ ] T010 Wire `links`, `relay` and `realtime` into `createMockServices` in `app/services/mock/index.ts`. Add `links` to the plugin's `guard()` set in `app/plugins/services.ts`, and leave `relay` and `realtime` unguarded (contracts/ports.md).
- [ ] T011 HTTP adapter for `LinkPort` and `LinkRelayPort` in `app/services/http/index.ts`, with every route in contracts/ports.md. `LinkAuth` `remote` adds `Authorization: Bearer <credential>` per request (research R4).
- [ ] T012 HTTP realtime adapter in `app/services/http/realtime.ts`:
  - dynamic `import('pusher-js')`, with options per research R1;
  - authorisation through `channelAuthorization.customHandler`, which posts `{ socket_id, channel_name }` to `/api/broadcasting/auth` through the shared client with the same `LinkAuth`;
  - events bound by their bare names, and presence mapped to `PresenceMember`;
  - `settings()` returns `runtimeConfig.public.realtime`, or `null` when its key is empty.
- [ ] T013 [P] `tests/unit/link-ports.test.ts`: a contract suite run against the mock and the HTTP adapter (fake fetch and a fake Pusher). It covers:
  - start, reuse, new code, pair by code and by secret, code errors and the rate limit;
  - command and ack routing, state with preview stripping, `partner_offline`;
  - the second phone (accept/decline/lapse), roles, end with each reason;
  - `401` after the end.
- [ ] T014 [P] `/__mock` phone link section in `app/pages/__mock.vue`: "this tab offline" toggle, "pair a mock Tilw app" (an app remote that can be player: auto-acks commands and sends state; research R11), end a link with a chosen reason, and the existing clock offset. Add helpers `linkKnob(page, …)` and `phonePage(context)` to `tests/e2e/r2.ts` (or a new `tests/e2e/link.ts`).
- [ ] T015 Create `app/composables/useLinkPlayer.ts`: a registry of one `LinkPlayer` (`scriptId`, `apply`, `snapshot`), `register` and `unregister` on mount and unmount, and `changed()`, which tells the link store to send state (data-model).
- [ ] T016 Create `app/stores/link.ts` (`useLinkStore`), with the fields, actions and status transitions in data-model.md:
  - Connect and subscribe to the host channel and presence after `start` or `current`.
  - On `command`: dispatch to the registered player, or refuse with `unsupported`, then post the ack.
  - On `member_added`: send the full state.
  - Keep a private `seq`, and coalesce state sends to one every 150 ms, sending the newest (research R6).
  - Drop the connection on `link.ended`.
  - **No import of, or reference to, the recorder** (research R14).
- [ ] T017 [P] Create `app/composables/useHostTab.ts`: Web Lock `tilw-link-host`, with a `BroadcastChannel('tilw-link')` fallback and a "move here" handoff (research R8). The link store uses it before connecting.
- [ ] T018 [P] Create `app/components/link/QrCode.vue`: `uqr` → inline SVG, dark on white with a 4-module quiet zone in both themes, at least 200 px on desktop, with an `aria-label` from i18n.
- [ ] T019 [P] Create `app/components/link/RemoteControls.vue` (presentational):
  - props: `state`, `pending`, `lastResult`, `disabled`, `recordingAvailable`; emits `send(type, extra)`;
  - big Play/Pause, Next and Previous; secondary restart, go to paragraph, faster, slower, speed, text size, record and stop;
  - a result line, 44×44 targets, and RTL/LTR mirroring of Next and Previous [L5].

**Checkpoint**: typecheck passes; `link-ports.test.ts` passes on the mock; two tabs can pair and exchange events through `/__mock`.

---

## Phase 3: User Story 1 - Pair my phone and drive the reading from it (P1) 🎯 MVP

**Goal**: Connect phone on the rehearsal page, the public `/remote` page, and the studio applying commands and sending state.
**Independent Test**: quickstart scenarios 1–3 and 10.

### Tests

- [ ] T020 [P] [US1] `tests/unit/link-store.test.ts`:
  - `open()` gives waiting with a code, then connected on `member_added` (remote), with the full state sent;
  - commands dispatch to the player and are acked with its result, and with no player (or another script) they are refused with `unsupported`;
  - state sends are coalesced (≤ 1 per 150 ms, newest wins) and `seq` increases;
  - `limit_reached` gives `locked`, and no realtime settings give `unavailable`.
- [ ] T021 [P] [US1] `tests/unit/remote-store.test.ts`:
  - a hash secret pairs, and the hash is removed;
  - a code pairs; `token_invalid` and `rate_limited` give their messages;
  - `send` shows done on ack, refused with a reason, or not delivered after 5 s or on `partner_offline`, and a late ack after the timeout is ignored;
  - a state with a lower or equal `seq` is dropped;
  - the pairing is stored with `lastSeenAt`.
- [ ] T022 [P] [US1] `tests/e2e/link.spec.ts` (US1 block), with a studio page and a phone page in one context:
  - Connect phone shows the QR, code and countdown;
  - the phone pairs by code; Play, Next and Faster apply in the studio and show as done on the phone;
  - Next at the last paragraph shows the reason;
  - a wrong code shows the single message;
  - opening the copied remote address pairs without the code;
  - with `phone_link.allowed` off, Connect phone is locked;
  - axe runs on the panel and on `/remote`.

### Implementation

- [ ] T023 [US1] Create `app/components/link/ConnectPanel.vue` (waiting and connected states): QR, the 6-digit code in large digits, the address as copyable text, the expiry countdown with **New code** when it runs out, the remote's name and kind, and **End link**. It is a side drawer on desktop and a bottom sheet on phones, using the reading-settings drawer layout [L1].
- [ ] T024 [US1] Create `app/components/link/LinkIndicator.vue`: a masthead dot and label (off / waiting / connected) that opens the panel. Its fixed width prevents layout shift, and a polite live region announces status changes [L2].
- [ ] T025 [US1] Rehearsal: in `app/pages/app/scripts/[id]/rehearse.vue`, add the indicator and panel, and register a `LinkPlayer` through `useLinkPlayer`:
  - `apply` maps the commands to `engine.toggle/play/stop/next/prev/goTo/restart` and to the reader store's `wpm` and `fontSize` setters, using the same speed and size steps as `ReaderControls`;
  - refusals: `at_end`/`at_start` at the bounds, `not_recording_mode` for record commands, `unsupported` during the countdown or with a dialog open;
  - `snapshot` builds the state (title ≤ 120 characters, paragraph, count, playing, mode, wpm, size, `recording.state: 'unavailable'`, previews ≤ 120 characters from `reader.paragraphs`);
  - call `changed()` from watchers on paragraph, playing and settings.
- [ ] T026 [US1] Create `app/stores/remote.ts` (`useRemoteStore`), with phases and actions per data-model:
  - `start()`: hash secret → pair, then `history.replaceState`; otherwise a stored pairing less than 10 minutes old → reconnect; otherwise code entry.
  - Subscribe to `channels.own` and `channels.presence`.
  - Commands use a pending map with 5-second timers.
  - Drop states whose `seq` isn't higher.
  - Persist and clear `localStorage['tilw:remote:v1']`.
- [ ] T027 [US1] Create `app/layouts/remote.vue` (brand, language switch, no studio chrome) and `app/pages/remote.vue`, with three steps:
  - the start step: a 6-digit numeric input (`inputmode="numeric"`, `autocomplete="one-time-code"`) with the errors from Story 1 #3 [L4];
  - the connected step: `RemoteControls` with the title, "paragraph N of M" and previews in the script's direction [L5];
  - focus management between the steps.
- [ ] T028 [US1] Remote language: with no saved choice, the remote page uses English when `navigator.language` starts with `en`, otherwise Arabic, and the layout's switch saves `localStorage['tilw:remote:locale']`. Implement this in `app/plugins/locale.client.ts`, branching on the `/remote` route only, so the studio's behaviour is unchanged (research R9).
- [ ] T029 [US1] Plan limit: add `'phone_link.allowed'` to `KNOWN_LIMITS` in `app/utils/limits.ts`, with a yes/no display on `app/pages/app/settings/plan.vue`. Connect phone shows locked when `plan.limit('phone_link.allowed') === false`, and opens `LimitDialog` on a `limit_reached` from `start` (research R12) [L1 locked].

**Checkpoint**: US1 unit and e2e tests pass on the mock; a phone tab drives rehearsal.

---

## Phase 4: User Story 2 - Keep working through a dropped signal (P1)

**Goal**: offline notices within 10 s, automatic reconnect without a code, the idle end, the screen kept awake.
**Independent Test**: quickstart scenarios 4–5.

### Tests

- [ ] T030 [P] [US2] Extend `tests/unit/link-store.test.ts` and `tests/unit/remote-store.test.ts`:
  - `member_removed` gives `partnerOffline`, and `member_added` gives connected again with the full state re-sent;
  - the connection going `unavailable` makes the remote's controls disabled;
  - a reload with a stored pairing reconnects;
  - a stored pairing older than 10 minutes, or a `401`, is forgotten and shows "This link ended".
- [ ] T031 [P] [US2] `tests/e2e/link.spec.ts` (US2 block):
  - mark the studio tab offline: the phone shows "Studio offline" within 10 s, and a command shows not delivered and isn't applied after it comes back;
  - reload the phone: it reconnects and shows the current paragraph;
  - move the clock 11 minutes: the phone shows "This link ended".

### Implementation

- [ ] T032 [US2] Studio: offline status, and reconnecting after the socket recovers, in `app/stores/link.ts` (re-subscribe and send full state). The phone offline state goes in `ConnectPanel.vue` and `LinkIndicator.vue` [L1, L2].
- [ ] T033 [US2] Remote: the studio offline phase, disabling controls, reconnecting on `online` and `visibilitychange`, refreshing `lastSeenAt` on every event and successful call, and the 10-minute and `401` end screens, in `app/stores/remote.ts` and `app/pages/remote.vue` [L5 offline, L6].
- [ ] T034 [P] [US2] Create `app/composables/useWakeLock.ts`: request `navigator.wakeLock.request('screen')` while the remote is connected, request it again on `visibilitychange`, release it on end, and do nothing where it's unsupported. Use it in `app/pages/remote.vue`.

**Checkpoint**: US2 tests pass; a dropped phone recovers on its own.

---

## Phase 5: User Story 3 - Start and stop a take from my phone (P2)

**Goal**: record start and stop from the phone through the recording studio's own flow; the link never stops a take.
**Independent Test**: quickstart scenario 6.

### Tests

- [ ] T035 [P] [US3] `tests/unit/link-recorder-safety.test.ts`: with a take running (a fake player whose recorder spy records calls), `link.ended`, `remote.replaced`, presence loss and closing the connection never call stop. Only a `recordStop` command calls the player's stop (SC-005).
- [ ] T036 [P] [US3] `tests/e2e/link.spec.ts` (US3 block):
  - in the recording studio with fake devices, Record from the phone shows the countdown and then the recording time on the phone, and Stop saves the take;
  - Record from rehearsal is refused with "Open the recording studio";
  - closing the phone page mid-take leaves the take recording.

### Implementation

- [ ] T037 [US3] Recording studio: in `app/pages/app/scripts/[id]/record.vue`, add the indicator and panel, and register a `LinkPlayer`:
  - `recordStart` → `startCountdown()` when the phase is `setup` and devices are on, otherwise `devices_off`/`already_recording`/`saving`;
  - `recordStop` → `stopTake()` when recording, otherwise `not_recording`;
  - the reading commands work as in T025;
  - `snapshot.recording` maps the phase (setup → idle or unavailable, countdown, recording with `startedAt`, saving, saved, failed);
  - call `changed()` on phase changes.
- [ ] T038 [US3] Remote recording display in `app/components/link/RemoteControls.vue`: Record and Stop buttons, the countdown, the elapsed time from `recording.startedAt` (not from when the phone joined), saving and saved, and the refusal texts for the recording reasons [L5 recording].

**Checkpoint**: US3 tests pass; a take started from the phone survives the phone leaving.

---

## Phase 6: User Story 4 - Manage the link from the studio (P2)

**Goal**: previews on and off, a second phone, role swap with the Tilw app, ending, and one hosting tab.
**Independent Test**: quickstart scenarios 7, 8 and 11.

### Tests

- [ ] T039 [P] [US4] Extend `tests/unit/link-store.test.ts`:
  - `remote.requested` gives `pendingRemote`; accept and decline call the port;
  - previews off stops sending previews in `snapshot` (the store strips them too) and handles `link.updated`;
  - role request and answer, with `roles.changed` switching the studio to remote mode, where `RemoteControls` receives `state`;
  - swap isn't offered for a browser remote or during a take;
  - end → `ended`.
- [ ] T040 [P] [US4] `tests/unit/host-tab.test.ts`: a second tab sees the lock held and shows `otherTab`; "move here" hands the link over, and a command is applied in exactly one tab.
- [ ] T041 [P] [US4] `tests/e2e/link.spec.ts` (US4 block):
  - a second phone pairs and the studio accepts: the first phone shows "Another phone took over";
  - decline, or the 2-minute lapse on the clock knob, gives "The studio didn't accept";
  - previews off: the phone shows only the title and position;
  - with the mock Tilw app, swap roles: the studio shows the remote controls and drives the app;
  - a second studio tab shows "open in another tab".

### Implementation

- [ ] T042 [US4] Create `app/components/link/LinkRequest.vue`: a non-modal popover anchored to the indicator, for a second phone or a role swap, with Accept and Decline and the time left. During countdown and recording it isn't shown; the indicator gets a badge and the request waits in the panel (research R13) [L3].
- [ ] T043 [US4] Panel controls in `ConnectPanel.vue`:
  - the **Previews** switch (`links.update`);
  - pending phone accept and decline;
  - **Swap roles**, only when the remote's kind is `app` and no take is running;
  - **End link** with the ended state and its reason [L1].
- [ ] T044 [US4] Remote side: the waiting-for-accept, replaced and declined/lapsed screens, previews disappearing on `link.updated`, and **Leave** (`relay.leave`, forget the pairing), in `app/stores/remote.ts` and `app/pages/remote.vue` [L6].
- [ ] T045 [US4] Studio as remote: when `player === 'remote'`, the rehearse and record pages show `RemoteControls` fed by the link store (state from the app, commands through `relay.command` with `{ kind: 'session' }`), instead of applying commands. The page's own reader stays paused [L7].
- [ ] T046 [US4] "Open in another tab" state with **Move here** in `ConnectPanel.vue` and `LinkIndicator.vue`, using `useHostTab` [L1].

**Checkpoint**: US4 tests pass.

---

## Phase 7: User Story 5 - See my phone links and why one ended (P3)

**Goal**: Settings → Phone links, and plain-words end reasons on both sides.
**Independent Test**: quickstart scenario 9.

### Tests

- [ ] T047 [P] [US5] `tests/e2e/link.spec.ts` (US5 block):
  - Settings → Phone links lists an open and an ended link, newest first;
  - End from there: the phone shows "The studio ended this link";
  - deleting the linked script: the phone shows "The script was deleted";
  - each reason from the `/__mock` end knob shows its text on both sides;
  - the empty state.

### Implementation

- [ ] T048 [US5] Create `app/components/link/LinkHistory.vue` (phone name and kind, script, studio device, connected or not, last used as relative time, **End** on open links) and add a **Phone links** section to `app/pages/app/settings/index.vue`, using the existing settings row and list components [L8].
- [ ] T049 [US5] End-reason texts for every `LinkEndReason`, plus `replaced`/`declined`/`lapsed`/`left`, with a generic fallback for unknown reasons. They are used by `ConnectPanel.vue`, `pages/remote.vue` and `LinkHistory.vue` through one helper, `linkEndText(reason)`, in `app/utils/link.ts` (research R15).

**Checkpoint**: all stories pass on the mock.

---

## Phase 8: Polish & cross-cutting

- [ ] T050 [P] Update `specs/001-studio-frontend/contracts/ports.md` with a pointer to this feature's port delta, and mark gap G3 as resolved by 004 in `specs/001-studio-frontend/gaps.md`.
- [ ] T051 [P] Run axe and keyboard checks on `/remote` (320×568, Arabic and English, light and dark) and on the panel, and keep shortcuts working while linked. The results go in `tests/e2e/link.spec.ts`.
- [ ] T052 [P] Bundle check: `pusher-js` and `uqr` must not be in the landing or library chunks (`nuxt build` analyse). Note the result in `specs/004-phone-link/quickstart.md`.
- [ ] T053 Live run: with backend `003-phone-link` and Reverb running and `NUXT_PUBLIC_SERVICES_MODE=http`:
  - run `npm run test:live` with the link port suite;
  - run quickstart scenarios 1–7 with a real phone, and record the p95 command time on Wi-Fi and 4G (SC-002) and any gaps in `specs/004-phone-link/quickstart.md` and `gaps.md`.
- [ ] T054 Run `npm test`, `npm run typecheck` and `npm run test:e2e`, and compare the e2e failures with the release-1/release-2 baseline (pre-existing failures are noted, not fixed here).

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** run in order. T001 (Figma frames) gates every screen task, but not the foundation code (T005–T019 can start at once).
- **Phase 2** blocks every story: types, ports, both adapters, the stores, the player registry, the controls component.
- **US1** needs Phase 2. It is the MVP: a phone tab or phone drives rehearsal.
- **US2** needs US1 (it extends both stores and the remote page).
- **US3** needs US1 only (the record page player and the recording display); it can run beside US2.
- **US4** needs US1. T045 needs T037 when the record page is included; it can run beside US2 and US3, except where the same files change (`ConnectPanel.vue`, `remote.ts`: merge one at a time).
- **US5** needs US1 (it reads links and reasons); it is independent of US2–US4.
- **Polish** comes after the stories it covers. T053 needs the backend branch and Reverb.

## Parallel Examples

- **Phase 2**: T013, T014, T017, T018 and T019 together after T005–T006. T008–T009 (mock) and T011–T012 (HTTP) are two parallel lanes.
- **US1 tests**: T020, T021 and T022 together. Then T023–T024 (panel, indicator) beside T026–T028 (remote page and store).
- **After US1**: US2 (T030–T034) beside US3 (T035–T038) and US5 (T047–T049): different files, except `remote.ts` (US2) and `RemoteControls.vue` (US3), which don't overlap.

## Implementation Strategy

- **MVP**: Phase 1, Phase 2 and US1. Pair a phone and drive rehearsal, which is the landing-page promise. Demo with two tabs on the mock, then with a real phone against backend 003.
- **Increment 2**: US2, so a dropped signal doesn't lose the remote (needed before real use).
- **Increment 3**: US3 (record from the phone) and US4 (previews, second phone, roles, one host tab).
- **Increment 4**: US5 (history and reasons), then Polish and the live run.
