# Feature Specification: Web app — phone link (release 2)

**Feature Branch**: `004-phone-link` (the backend branch is `003-phone-link`; frontend specs are numbered on their own)

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Phone link in the web studio (frontend side of backend feature 003-phone-link). The studio can be driven from a phone: (1) a 'Connect phone' panel in the studio shows a QR code and 6-digit pairing code, link status (waiting, connected, partner offline, ended), lets the owner accept or decline a second phone, turn script previews on/off, swap which device reads (player) and which controls, end the link, and see recent link history; (2) a public /remote page for a phone browser with no account: pair by code or QR, then remote controls (play, pause, next, previous, go to paragraph, restart, faster/slower, speed, text size, record start/stop) with the current state and preview shown, reconnect after a dropped signal with the same credential, and clear screens when replaced, declined or the link ends; (3) the studio as the reading device applies incoming commands to the reader and teleprompter recorder, answers each with an ack (applied/refused with reason) and sends state updates; (4) the realtime client for Laravel Reverb (Pusher protocol, private and presence channels, auth via POST /api/broadcasting/auth) plus an in-browser mock port so it can be built and tested without Reverb. Contracts: backend/specs/003-phone-link/contracts/openapi.yaml and realtime.md. Plan limit phone_link.allowed hides or locks the feature for plans without it."

## Context

This is the screen side of backend feature `003-phone-link`. Every rule about pairing, codes, credentials, rate limits, channels, roles, reconnecting and ending is defined there ([spec](../../../backend/specs/003-phone-link/spec.md), [HTTP contract](../../../backend/specs/003-phone-link/contracts/openapi.yaml), [realtime contract](../../../backend/specs/003-phone-link/contracts/realtime.md)). This spec says what people see and do in the web app, in the studio and on a phone, and keeps the app's two adapters (in-browser mock and real service) in step.

It closes release-1 gap **G3** (phone remote, deferred 2026-11-19). The landing page, its remote card and the Free plan already promise it: "no extra app, just scan the code".

**Design source**: Figma has no app frame for phone link yet (G3: page 06 node `149:382` is only a visualisation of the feature). Under constitution principle II, frames for the Connect phone panel, the remote page and their states are drawn on a new Figma page `08 · Release 2 · Phone link`, from the design-system page, before the screens are built. Each frame is listed in `gaps.md` when the plan is written. Phone, dark and English layouts follow from them as in release 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pair my phone and drive the reading from it (Priority: P1)

In rehearsal, a signed-in person opens **Connect phone**. A panel shows a QR code, a 6-digit code and how long they last. They scan the QR with their phone's camera, or open the remote address and type the code. The phone browser opens the Tilw remote, with no app and no sign-in. Within seconds both sides show "Connected". The phone shows the script title, where the reading is, and large buttons. Pressing **Next** on the phone moves the studio to the next paragraph, and the phone confirms it.

**Why this priority**: This is the promise on the landing page and the reason the feature exists. Everything else builds on it.

**Independent Test**: In the mock, open rehearsal in one tab and the remote in a second tab. Pair with the shown code, press Play, Next and Faster on the remote, and see the studio react and the remote confirm each one.

**Acceptance Scenarios**:

1. **Given** a signed-in person in rehearsal, **When** they open Connect phone, **Then** the panel shows a QR code, the 6-digit code, the remote address, a "Code works for 5 minutes" countdown and **New code**. When the code runs out, it is replaced by **New code** instead of a dead code.
2. **Given** a phone that scans the QR, **When** the remote page opens, **Then** it pairs on its own without asking for the code. **Given** a phone that opens the remote address by hand, **When** it enters the 6 digits, **Then** it pairs.
3. **Given** a wrong, used or expired code, **When** the phone submits it, **Then** it sees one calm message ("This code doesn't work. Ask the studio for a new one."), never which of the three it was. After too many wrong tries it sees "Too many tries. Try again in an hour."
4. **Given** a paired phone, **When** it sends any command (play, pause, next, previous, go to paragraph, back to the start, faster, slower, set speed, bigger text, smaller text), **Then** the studio applies it as if the person had pressed the same control, and the phone shows it as done. A command the studio can't apply ("already at the last paragraph") shows the reason on the phone, and nothing else changes.
5. **Given** a command with no answer within 5 seconds, or the service saying the studio isn't connected, **When** the phone shows the result, **Then** it says "Not delivered: the studio isn't connected" and never applies the command later.
6. **Given** a connected link, **When** the studio reads, **Then** the phone shows the script title, paragraph N of M, playing or paused, speed, text size and, while previews are on, the start of the current and next paragraph (at most 120 characters each).
7. **Given** a person whose plan doesn't allow phone link, **When** they look for Connect phone, **Then** they see it locked with the reason and the way to upgrade, as with the other plan limits. Starting a link is never attempted.

---

### User Story 2 - Keep working through a dropped signal (Priority: P1)

The phone's Wi-Fi drops for a minute. Both sides show "Phone offline" / "Studio offline" within seconds, and the phone stops offering commands it can't deliver. When the network comes back, the phone reconnects on its own, with no new code, and shows the studio's current place.

**Why this priority**: Phones lose signal and lock their screens. Without this the remote fails in real use, mid-take.

**Independent Test**: In the mock, pair two tabs, simulate the remote going offline for 30 seconds, then bring it back. See both offline notices, the automatic reconnect and the current state on the remote. Repeat after 11 minutes and see "This link ended".

**Acceptance Scenarios**:

1. **Given** a connected link, **When** either side loses its connection, **Then** the other side shows it as offline within 10 seconds. The studio keeps reading and recording exactly as it was.
2. **Given** a phone that comes back within 10 minutes, **When** its connection returns or the page is reopened, **Then** it reconnects with its stored pairing, without a code, and shows the studio's full current state within 5 seconds.
3. **Given** both sides offline for more than 10 minutes, or a stored pairing that the service no longer accepts, **When** the phone tries to reconnect, **Then** it forgets the pairing and shows "This link ended. Ask the studio for a new code."
4. **Given** a remote showing a state, **When** an older state arrives late, **Then** the remote ignores it and never jumps back.
5. **Given** a paired phone on the remote page, **When** the device supports it, **Then** the screen is kept awake while connected, so it doesn't lock between commands.

---

### User Story 3 - Start and stop a take from my phone (Priority: P2)

In the recording studio, with camera and microphone ready, the person presses **Record** on the phone. The studio runs its normal countdown and starts the take. The phone shows the countdown, then the recording time. **Stop** on the phone ends and saves the take.

**Why this priority**: Recording alone, in front of the lens, is the main use for a remote. It needs Story 1 working first.

**Independent Test**: In the mock, open the recording studio in one tab and the remote in another. Record and stop from the remote and see the take saved. Close the remote tab mid-take and confirm the take keeps recording.

**Acceptance Scenarios**:

1. **Given** the recording studio with devices ready, **When** the phone sends Record, **Then** the studio starts exactly as if Record were pressed on it (countdown, then recording), and the phone shows countdown, recording time and then saving / saved.
2. **Given** rehearsal, devices off, a take already running, or a take being saved, **When** the phone sends Record or Stop, **Then** the studio refuses with that reason and the phone shows it ("Open the recording studio to record", "Camera and microphone are off", …).
3. **Given** a take in progress, **When** the phone disconnects, is replaced or the link ends, **Then** the take carries on. Only the person, or the plan's maximum take length, stops it.
4. **Given** a take in progress, **When** the phone shows recording, **Then** it shows the elapsed time from the start the studio reported, not from when the phone joined.

---

### User Story 4 - Manage the link from the studio (Priority: P2)

From the Connect phone panel, the person sees which phone is connected and since when. They can turn **previews** off so no script text reaches the phone, end the link, and answer when a second phone asks to take over. When the remote is the Tilw mobile app, they can also swap roles so the app reads and the web studio becomes the remote.

**Why this priority**: People need to trust what the phone can see and to stay in control of who drives their studio. Swapping roles only matters once the mobile app exists.

**Independent Test**: In the mock, pair a first remote tab, then pair a second tab with a new code. Accept it in the studio and see the first tab told it was replaced. Turn previews off and confirm the remote shows only the title. End the link and see both sides return to their starting screens.

**Acceptance Scenarios**:

1. **Given** a connected link, **When** the panel is open, **Then** it shows the remote's name and kind (phone browser or Tilw app), connected or offline, and **Previews**, **New code** and **End link**.
2. **Given** a second phone that pairs, **When** it is waiting, **Then** the studio shows a small, non-blocking request ("iPhone wants to control this studio") with **Accept** and **Decline**, and the waiting phone shows "Waiting for the studio to accept". The request never covers the reading text, and during a take it waits in the panel until the person opens it.
3. **Given** the person accepts, **When** the switch happens, **Then** the new phone becomes the remote and the old one shows "Another phone took over" and stops sending. **Given** they decline, or 2 minutes pass, **Then** the waiting phone shows "The studio didn't accept" and the first phone keeps control.
4. **Given** previews on, **When** the person turns them off, **Then** the remote immediately shows only the title and position, and no script text other than the title reaches it until they are turned back on.
5. **Given** a remote that is the Tilw app, **When** either side asks to swap roles, **Then** the other side sees the request with Accept and Decline. Once accepted, the app reads, and the web studio shows the same remote controls the phone page has. Swapping isn't offered for a phone browser remote, or during a take.
6. **Given** the person ends the link (from the panel or from the phone), **When** it ends, **Then** both sides show that it ended and why, the phone forgets its pairing, and the studio returns to "Connect phone".

---

### User Story 5 - See my phone links and why one ended (Priority: P3)

In **Settings**, a **Phone links** section lists the person's open links and those that ended in the last 30 days: phone name and kind, script, which device was the studio, connected now or not, and last used. They can end any open link from there. Whenever a link ends for a reason outside the studio (signed out everywhere, email changed, device revoked, script deleted, plan changed, idle), both sides say so in plain words.

**Why this priority**: Helpful for trust and housekeeping, but people can use phone link fully without it.

**Independent Test**: In the mock, create two links, end one, and see both in Phone links with the right states. End the open one from Settings and see the remote tab show "The studio ended this link". Delete a linked script and see the reason "The script was deleted" on the remote.

**Acceptance Scenarios**:

1. **Given** a person with links, **When** they open Settings → Phone links, **Then** they see the list newest first, with an **End** action on open ones and an empty state when there are none.
2. **Given** a link that ends for any reason, **When** either side shows it, **Then** the message names the reason (the studio ended it, the phone left, inactive for 10 minutes, another phone took over, signed out, email changed, account deleted, device signed out, script deleted, plan no longer includes phone link).
3. **Given** the plan page from release 2, **When** this feature ships, **Then** the phone link limit row appears there like the other limits, and is no longer hidden.

---

### Edge Cases

- **Studio open in two tabs**: only one tab hosts the link. The other shows "Phone link is open in another tab" with a way to move it here, so a command is never applied twice.
- **Studio leaves the script**: if the person goes to the library or opens another script while linked, the link stays open. Commands are refused with "The studio isn't reading this script" until they return. Closing the tab makes the studio offline for the phone, and the 10-minute rule applies.
- **The person presses controls in the studio while the phone is linked**: both work. The phone sees the change in the next state, and the last action wins.
- **Keyboard shortcuts** (Space, arrows, Esc) keep working in the studio while linked. Incoming commands never move focus or cause layout shift on the reading surface.
- **Countdown**: a Play or Record command during the countdown is refused with a reason, never queued.
- **Phone with no camera, or the QR doesn't scan**: the remote address and 6-digit code are always shown under the QR.
- **Phone's language**: the remote page opens in Arabic, or in English when the phone's language is English, with a language switch that the phone remembers. It renders right-to-left or left-to-right accordingly.
- **Script direction**: previews on the phone follow the script's text direction, not the page's.
- **Remote page opened without a code or with a broken address**: it shows the code entry, never an error page.
- **Stored pairing on a shared phone**: the remote page offers **Leave** (forget this studio), which ends the link for both sides.
- **Small phones**: the remote works one-handed in portrait from 320×568, with large targets for Play/Pause, Next and Previous.
- **Plan changes during a link**: the link ends with "plan no longer includes phone link", and Connect phone shows as locked.
- **Real service without the realtime server reachable**: the studio shows "Phone link isn't available right now" instead of a code that can never connect.

## Requirements *(mandatory)*

### Functional Requirements

**Studio: starting and managing a link**

- **FR-001**: The rehearsal and recording pages MUST offer **Connect phone**, which starts a link for the open script and shows a QR code of the remote address, the 6-digit code, the address in text, a countdown to the code's expiry, and **New code**.
- **FR-002**: The panel MUST show the link's status at all times: waiting for a phone, connected, phone offline, a second phone waiting, ended (with the reason). The same status MUST be visible as a small indicator on the reading page when the panel is closed.
- **FR-003**: The person MUST be able to accept or decline a waiting second phone, turn previews on or off, end the link, and (when the remote is the Tilw app) ask for or answer a role swap. Swap MUST NOT be offered for a phone browser remote or during a take.
- **FR-004**: When the person's plan doesn't allow phone link, Connect phone MUST appear locked with the limit message and upgrade path used for other limits (release 2). A "limit reached" answer from the service MUST show the same message.
- **FR-005**: Only one browser tab MUST host a given link at a time.

**Studio as the reading device**

- **FR-006**: The studio MUST apply each incoming command through the same actions as its own controls (reader and recording studio), then answer it as applied, or refused with one of the contract's reasons. Reasons MUST be shown to the phone person in plain words.
- **FR-007**: The studio MUST send its full state when the other side joins or rejoins, and after every change. The state is the script title, paragraph count, current paragraph, playing or paused, reading mode, speed, text size, recording state and its start time, and, while previews are on, up to 120 characters of the current and next paragraph. Each state MUST carry an increasing sequence number.
- **FR-008**: Nothing the remote does (leaving, dropping, being replaced, the link ending) MUST stop or discard a take in progress.
- **FR-009**: Commands MUST never be applied late. A command the studio receives while it can't apply it (countdown, another script open, a dialog in the way) is refused with a reason, not queued.

**Phone remote page**

- **FR-010**: A public remote page MUST pair a phone browser without an account, from the QR address on its own or from a typed 6-digit code. It MUST show the code errors described in Story 1 #3 without saying why a code failed.
- **FR-011**: Once paired, the remote MUST offer every command in the contract: play/pause, next, previous, go to paragraph, back to the start, faster, slower, set speed, bigger and smaller text, record and stop. It MUST show each command's result (done, refused with reason, or not delivered).
- **FR-012**: The remote MUST treat a command with no answer within 5 seconds, or a "partner offline" answer, as not delivered, and MUST show the studio as offline in that case.
- **FR-013**: The remote MUST show the latest state only, ignoring states older than the last one shown, and MUST show previews only when they are present.
- **FR-014**: The remote MUST keep its pairing on the phone so it can reconnect without a code for up to 10 minutes, and MUST forget it as soon as the link ends, it is replaced or declined, or the service refuses it.
- **FR-015**: The remote MUST offer **Leave**, and MUST keep the screen awake while connected where the device allows it.
- **FR-016**: The remote page MUST work in Arabic and English, follow the phone's language at first, remember a manual choice on the phone, and work in portrait from 320×568 with touch targets of at least 44×44.

**Connection and both sides**

- **FR-017**: Each side MUST show the other as offline within 10 seconds of losing it, and as connected again as soon as it returns. Both sides MUST reconnect on their own when the network comes back.
- **FR-018**: Every way a link ends MUST be shown to both sides with its reason. After it ends, the remote stops sending and the studio returns to Connect phone.

**Settings and plan**

- **FR-019**: Settings MUST gain a **Phone links** section listing open links and links ended within 30 days (remote name and kind, script, studio device, connected or not, last used), with **End** on open ones.
- **FR-020**: The Plan & usage page MUST show the phone link limit like the other limits, now that the feature exists.

**Data port and adapters (constitution III)**

- **FR-021**: The app MUST reach phone link only through typed service interfaces: one for the link's HTTP actions (start, new code, current link, list, update previews, end, accept/decline a phone, roles, pair, commands, acks, state, ping, leave) and one for the live channel (connect, join the link's channels, receive events, see who is present). Components and stores MUST NOT open sockets or call the service directly.
- **FR-022**: The mock adapter MUST simulate a complete link between two tabs of the same browser (studio tab and remote tab), including codes, pairing, commands, acks, state, presence, a second phone, previews, ending, and simulated offline periods, so every story can be tested without the realtime server.
- **FR-023**: The real adapter MUST follow the backend's HTTP and realtime contracts exactly, including the new error kind "partner offline" and the existing error kinds. The service contract document (`ports.md`) MUST be updated for the new interfaces.
- **FR-024**: All new text MUST live in the Arabic and English locale files, and every new screen MUST render correctly in both directions (constitution I).

### Key Entities

- **Phone link**: one studio's link for one script. Status (waiting, connected, ended), which side reads, previews on or off, the remote, started and last used, and the end reason.
- **Pairing code**: the 6-digit code, the QR address and when they expire. Shown in the studio only.
- **Remote**: the phone or app that controls the studio. Name, kind (phone browser or Tilw app), waiting / active / replaced / declined, last seen.
- **Remote pairing (phone side)**: what the phone keeps to reconnect: which link, its credential, and when it was last used. Never anything about the account.
- **Command**: one action from the remote, with an id, and its result (applied, refused with reason, not delivered).
- **Studio state**: what the remote shows (FR-007), with its sequence number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can go from opening Connect phone to controlling the reading from their phone in under 30 seconds, without installing or signing in to anything on the phone.
- **SC-002**: With the real service on ordinary home Wi-Fi or 4G, 95 % of commands show as done on the phone within half a second of being pressed.
- **SC-003**: After a drop of up to 10 minutes, the phone is controlling the studio again within 5 seconds of its network returning, with no code, in 99 % of tries.
- **SC-004**: In testing with dropped and restored connections, 0 commands are applied by the studio more than 5 seconds after they were pressed, and 0 are applied twice.
- **SC-005**: 0 takes are stopped or lost because the phone disconnected, was replaced or the link ended.
- **SC-006**: With previews off, a review of everything the phone receives finds no script text other than the title.
- **SC-007**: Every story passes its independent test against the mock adapter, in Arabic and English, on a 320×568 phone viewport and on desktop.
- **SC-008**: In a usability check, 9 of 10 first-time people pair their phone and press Next without help.

## Assumptions

- The backend feature `003-phone-link` is complete on its branch and is the source of truth for every rule here. Timings come from it: codes last 5 minutes, a waiting second phone 2 minutes, a role request 30 seconds, and links end after 10 minutes with neither side connected. Previews are at most 120 characters.
- The phone's own camera app reads the QR and opens the remote address. The remote page doesn't scan codes itself, which keeps the camera untouched (constitution IV).
- The remote address is the frontend's public remote page, with the one-time secret after `#` so it isn't sent to the server in the page request. The page is public, outside `/app`, and runs only in the browser.
- The web studio is the reading device when a link starts. A phone browser is only ever a remote. Swapping so the web studio becomes the remote is only possible with the Tilw mobile app, which isn't built yet, so that path is tested against the mock only in this release.
- Phone link is allowed on Free and Pro at launch (the landing page promises it for free). The locked state matters for admin overrides and future plans.
- The release-2 plan, limit-message and settings components from feature `003-accounts-plans-storage` are reused, not rebuilt.
- Figma frames for this feature are drawn before the screens are built (Context). Small system states (loading, generic error) reuse existing components.
- No analytics or tracking are added. Nothing about commands or state is kept on the phone beyond the pairing needed to reconnect.
- **Out of scope**: the mobile app itself, AI tools (`004-ai-writing-tools` on the backend), and the admin console (005).
