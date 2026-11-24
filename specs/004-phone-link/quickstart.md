# Quickstart: validate phone link (web app)

Spec: [spec.md](spec.md). Port contract: [contracts/ports.md](contracts/ports.md). Shapes and stores: [data-model.md](data-model.md).

## Prerequisites

- `npm install` (adds `pusher-js` and `uqr`).
- Mock mode (default): nothing else. Phone link runs between two tabs of the same browser.
- Real mode: the backend on branch `003-phone-link`, migrated and seeded, with Reverb running (`php artisan reverb:start`; see `backend/specs/003-phone-link/quickstart.md`). In the frontend `.env`:

```dotenv
NUXT_PUBLIC_SERVICES_MODE=http
NUXT_PUBLIC_API_BASE_URL=https://tilw-backend.test
NUXT_PUBLIC_REALTIME_KEY=<REVERB_APP_KEY>
NUXT_PUBLIC_REALTIME_HOST=tilw-backend.test
NUXT_PUBLIC_REALTIME_PORT=8080
NUXT_PUBLIC_REALTIME_SCHEME=http
```

- To test from a real phone on the same network, the phone must reach both the frontend dev server and the API by address. Run `npm run dev -- --host`, and set the backend's `FRONTEND_URL` to that address so the QR points there.

## Automated checks

```powershell
npm test                       # stores, ports (mock + http contract suite), state coalescing, recorder safety
npm run test:e2e -- link       # Playwright: two pages in one context, one per story, against the mock
npm run typecheck
```

`npm run test:live` runs the shared port suite against the real backend when `NUXT_PUBLIC_SERVICES_MODE=http` is set.

## Scenarios (mock, two tabs)

Open `/app` in tab A (signed in) and open a script's rehearsal. Tab B is the phone.

1. **Pair by code (US1)**: A → Connect phone: QR, 6-digit code, countdown. B → `/remote`, enter the code: "Connected" on both. A wrong code in B shows the single "doesn't work" message; the 6th wrong try shows "Too many tries".
2. **Pair by address (US1)**: copy the remote address from A's panel into B: it pairs without asking for the code, and the address bar no longer shows `#…`.
3. **Commands (US1)**: in B press Play, Next, Faster, Bigger text, Previous: A follows each, B shows each as done. At the last paragraph, Next shows "Already at the end".
4. **Studio offline (US2)**: `/__mock` in A → mark tab A offline. B shows "Studio offline" within 10 s and its controls are disabled, so nothing can be sent; a command already on its way when A dropped shows "Not delivered" and is never applied after A comes back. Mark A online again: B shows "Connected" and drives A.
5. **Reconnect and idle end (US2)**: reload B: it reconnects without a code and shows A's current paragraph. Reload A too: B follows A's new position. Then close B, mark A offline in `/__mock` (both sides gone), move the mock clock 11 minutes and open `/remote` again: B shows "This link ended"; mark A online: its panel shows the link ended. (While either side is connected the link never ends as idle: each pings every minute.)
6. **Record (US3)**: A → recording studio with devices on. B → Record: countdown, then recording time on B. Close B mid-take: the take keeps recording; stop it in A and see it saved.
7. **Second phone and previews (US4)**: tab C → `/remote` with a new code: A shows the request; Accept: B shows "Another phone took over". Turn previews off in A: C shows only the title and position.
8. **Roles with the app (US4)**: `/__mock` → pair a mock Tilw app. Swap roles in A: A shows the remote controls and drives the mock app, which acks and sends state.
9. **History and reasons (US5)**: Settings → Phone links lists open and ended links; End one there: its remote shows "The studio ended this link". Delete a linked script: the remote shows "The script was deleted".
10. **Locked (US1 #7)**: `/__mock` → set `phone_link.allowed` off: Connect phone shows locked with the upgrade path. Plan & usage shows the phone link row.
11. **Two studio tabs**: open the same rehearsal in tab D: it shows "Phone link is open in another tab". Press Move here: commands now apply in D only.

## Checks

- With previews off, inspect B's received events (devtools → BroadcastChannel in the mock; WS frames in real mode): no script text other than the title (SC-006).
- Arabic and English, phone viewport 320×568 and desktop, light and dark, for the panel and the remote page (SC-007).
- Keyboard: Space, arrows and Esc keep working in A while linked; no layout shift on the reading surface when the status changes.
- Real mode: repeat scenarios 1–7 with a real phone and Reverb, and note p95 command time on Wi-Fi and 4G (SC-002).

## Results (2026-11-24)

- **Bundle (T052)**: `pusher-js` is its own lazy chunk (about 60 KB), loaded by a dynamic import when a link connects; it is not in the landing, library or entry chunks. The landing HTML carries only a low-priority `<link rel="prefetch">` for it (Nuxt's default), fetched when the browser is idle. `uqr` is in the QR chunk, which the landing page does not reference.
- **Live run (T053, partial)**: against backend `003-phone-link` with Reverb on this machine, in two browser tabs:
  - `tests/realtime/link-smoke.mjs` (backend): 50 commands, round trip p50 126–129 ms, p95 156–161 ms (SC-002 met).
  - In the browser: pairing by code, Next/Faster/Play from the phone tab (about 190 ms to the studio and back), and a studio reload resuming the link. This found and fixed `links/current` without `scriptId` (G-L5).
  - Still to do: a real phone on Wi-Fi and on 4G, with the p95 for each.
- **Suites (T054)**: vitest, `nuxi typecheck` and the full Playwright suite (desktop and phone) are green on `004-phone-link`, after the release-1/2 e2e fixes (frontend PR #3).
