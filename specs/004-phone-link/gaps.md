# Gaps: phone link

Figma: `t9xEIr22yKOj7o2Ft32hxb`, page **`08 · Release 2 · Phone link`** (`276:157`), created 2026-11-24. The MVP frames (L1, L2, L4, L5) are drawn; L3 and L6–L8 are drawn before the stories that need them. Under constitution II these frames are drawn from page `01 · Design system` **before** the matching screen is built, with desktop Arabic light frames first, as on page 07. Phone, dark and English layouts follow from them, as in releases 1 and 2. Each row's node id is filled in once the frame is drawn.

## Frames to draw

| # | Frame | States | Node |
|---|---|---|---|
| L1 | Connect phone panel (side drawer on desktop, bottom sheet on phones; the reading-settings drawer layout) | waiting with QR + code + countdown; code expired; connected (remote name, kind, previews, end); phone offline; ended with reason; locked by plan; open in another tab; unavailable | `276:158` waiting · `276:218` connected · `276:278` locked (copies of reading settings `6:28` with the drawer content replaced) |
| L2 | Link indicator in the rehearse/record masthead | off, waiting, connected, offline, request badge | inside each L1 frame, masthead pill: `277:511` waiting, and the connected and off pills in `276:218` / `276:278` |
| L3 | Request popover | second phone wants control; role swap asked; role swap from the studio | — |
| L4 | Remote page: start | code entry, pairing, invalid code, too many tries | `278:164` enter code · `278:218` code doesn't work |
| L5 | Remote page: controls | rehearsal state with previews; previews off; recording (countdown, time, saving, saved); command result line (done, refused, not delivered); studio offline | `278:273` controls · `278:331` studio offline (in section `278:386`); recording in section `286:424`: `286:425` countdown, `286:488` recording, `286:551` saving, `286:614` saved |
| L6 | Remote page: end screens | waiting for the studio to accept; declined / lapsed; replaced; ended with reason; left | section `284:276`: `284:277` waiting, `284:326` declined, `284:370` replaced, `284:414` ended (idle), `284:458` left (Arabic phone; English follows) |
| L7 | Studio as remote (roles swapped with the Tilw app) | RemoteControls inside the studio frame | — |
| L8 | Settings → Phone links | list with open and ended links; empty state | — |

Plan & usage only gains one more row of the existing limit style, so it needs no new frame.

## Gaps found while building

- **G-L1 Cue variants on the phone (2026-11-24)**: the design-system `Cue` set's `Previous`/`Next` variants are both boxed, so the phone preview shows two boxed lines in `278:273`. Proposed: build the phone preview from the reader's current-line style (boxed, bright) for the current paragraph and plain muted text for the next one, as on the rehearsal phone frame `6:31`. **Decided 2026-11-24: accepted.**
- **G-L2 Remote language switch**: the phone frames show "English" as a text link (with the `language` glyph), not the landing page's locale switch component. Proposed: reuse `LocaleSwitch.vue` in its compact form.
- **G-L3 Code entry**: the phone frame `278:164` shows six digit boxes; the page uses one numeric field styled as a code (`inputmode="numeric"`, `autocomplete="one-time-code"`), so screen readers, paste and SMS-style autofill work. Proposed: keep one field; redraw the frame as one wide field. **Decided 2026-11-24: one field (user). Redrawn as one field in `278:164` / `278:218`.**
- **G-L4 e2e port**: `playwright.config.ts` reused whatever listened on port 3100 (another local dev server), so every flow failed at sign-in. It now takes `E2E_PORT` and serves the build with `tests/e2e/static-server.mjs` (prerendered pages, then the SPA fallback) instead of `serve --single`.
- **G-L5 Live test against Reverb (2026-11-24)**: pairing, commands (round trip about 190 ms in the browser) and play/pause work against the real backend. One bug found: `LinkPort.current()` called `GET /api/links/current` without the `scriptId` query the backend requires (422), so the studio never saw the phone pair and a reload couldn't resume the link. The mock accepted it. Fixed: `current(scriptId)` in the port, both adapters and the host; the mock now filters by script too.
- **G-L6 Rejoining without a presence event (2026-11-24, US2)**: Pusher sends `member_added` only for a member's first connection, so a phone whose old socket hasn't closed when the reloaded page subscribes gets no fresh state. Also, a reloaded studio restarted `seq` at 0, so the phone dropped its states as old. Fixed in the web client only (no backend change): `seq` starts from the clock, and the studio re-sends its full state with each 60 s keep-alive while a phone is present. The mock hub now treats a member back from another tab as joining again.
- **G-L7 Stop during the countdown (2026-11-24, US3)**: the contract answers `recordStop` with `not_recording` unless a take runs. During the countdown the phone shows Stop, so the record page cancels the countdown instead (as Esc does in the studio) and answers `applied`. Nothing has been recorded at that point.
