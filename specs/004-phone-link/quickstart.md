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
4. **Not delivered (US2)**: `/__mock` in A → mark tab A offline. B shows "Studio offline" within 10 s; a command shows "Not delivered" and is never applied after A comes back.
5. **Reconnect (US2)**: reload B: it reconnects without a code and shows A's current paragraph. Move the mock clock 11 minutes: B shows "This link ended".
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
