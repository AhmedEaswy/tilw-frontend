# Gaps: phone link

Figma: `t9xEIr22yKOj7o2Ft32hxb`, page **`08 · Release 2 · Phone link`** (`276:157`), created 2026-11-24. The MVP frames (L1, L2, L4, L5) are drawn; L3 and L6–L8 are drawn before the stories that need them. Under constitution II these frames are drawn from page `01 · Design system` **before** the matching screen is built, with desktop Arabic light frames first, as on page 07. Phone, dark and English layouts follow from them, as in releases 1 and 2. Each row's node id is filled in once the frame is drawn.

## Frames to draw

| # | Frame | States | Node |
|---|---|---|---|
| L1 | Connect phone panel (side drawer on desktop, bottom sheet on phones; the reading-settings drawer layout) | waiting with QR + code + countdown; code expired; connected (remote name, kind, previews, end); phone offline; ended with reason; locked by plan; open in another tab; unavailable | `276:158` waiting · `276:218` connected · `276:278` locked (copies of reading settings `6:28` with the drawer content replaced) |
| L2 | Link indicator in the rehearse/record masthead | off, waiting, connected, offline, request badge | inside each L1 frame, masthead pill: `277:511` waiting, and the connected and off pills in `276:218` / `276:278` |
| L3 | Request popover | second phone wants control; role swap asked; role swap from the studio | — |
| L4 | Remote page: start | code entry, pairing, invalid code, too many tries | `278:164` enter code · `278:218` code doesn't work |
| L5 | Remote page: controls | rehearsal state with previews; previews off; recording (countdown, time, saving, saved); command result line (done, refused, not delivered); studio offline | `278:273` controls · `278:331` studio offline (in section `278:386`) |
| L6 | Remote page: end screens | waiting for the studio to accept; declined / lapsed; replaced; ended with reason; left | — |
| L7 | Studio as remote (roles swapped with the Tilw app) | RemoteControls inside the studio frame | — |
| L8 | Settings → Phone links | list with open and ended links; empty state | — |

Plan & usage only gains one more row of the existing limit style, so it needs no new frame.

## Gaps found while building

- **G-L1 Cue variants on the phone (2026-11-24)**: the design-system `Cue` set's `Previous`/`Next` variants are both boxed, so the phone preview shows two boxed lines in `278:273`. Proposed: build the phone preview from the reader's current-line style (boxed, bright) for the current paragraph and plain muted text for the next one, as on the rehearsal phone frame `6:31`.
- **G-L2 Remote language switch**: the phone frames show "English" as a text link (with the `language` glyph), not the landing page's locale switch component. Proposed: reuse `LocaleSwitch.vue` in its compact form.
- **G-L3 Code entry**: the phone frame `278:164` shows six digit boxes; the page uses one numeric field styled as a code (`inputmode="numeric"`, `autocomplete="one-time-code"`), so screen readers, paste and SMS-style autofill work. Proposed: keep one field; redraw the frame as one wide field.
- **G-L4 e2e port**: `playwright.config.ts` reused whatever listened on port 3100 (another local dev server), so every flow failed at sign-in. It now takes `E2E_PORT` and serves the build with `tests/e2e/static-server.mjs` (prerendered pages, then the SPA fallback) instead of `serve --single`.
