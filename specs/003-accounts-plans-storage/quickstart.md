# Quickstart: validate the web side of accounts, plans & storage

Contract: [contracts/ports.md](./contracts/ports.md). Shapes and queue: [data-model.md](./data-model.md). Frames: [gaps.md](./gaps.md).

## Prerequisites

- `npm install` in `frontend/` (no new packages).
- Mock mode (default): nothing else. Live mode: backend 002 running with `STORAGE_FAKE=true` and `servicesMode=http` as in release 1's live tests.

## Run

```powershell
npm run dev
npm test
npm run test:e2e
npm run typecheck
```

Live adapter against backend 002:

```powershell
npm run test:live
```

## Scenarios (mock adapter; open `/__mock` for the knobs)

1. **Limits (US1)** — knob: Free, `scripts.max_active` = 2 with 2 active scripts. Library → New script → R2-2 dialog shows 2 of 2 with Archive / Upgrade. Set the limit to 1 → the older script opens with the R2-3 read-only banner; rehearse and record still open.
2. **Recording cap (US1)** — knob: `takes.max_minutes` = 1. Studio footer reads "حتى 1 دقيقة"; a take stops by itself at 01:00 with the release-1 limit toast. Pro (60) shows "حتى 60 دقيقة".
3. **Upgrade (US2)** — Plan & usage → Upgrade → home-page poster in a dialog → yearly → Continue on WhatsApp opens a `wa.me` URL whose text has plan, period, $77 and `TLW-XXXX` and nothing personal. Block popups in the browser → dialog shows the reference with copy and the link button. Knob "fulfil" → toast "Pro active until …"; knob clock +358 days → "ends on …" banner; +366 days → back-on-Free notice, auto sync now manual.
4. **Drive (US3)** — Storage → Link Google Drive (mock redirects back with `?linked=1`) → Manual → in Recordings, "Copy to Drive" on a take → chip goes waiting → uploading N% → In Google Drive. Knob Drive `full` → next copy ends "Backup failed · Drive full" with Retry; the take still plays from the device. Reload mid-upload (knob `slow`) → upload resumes from its offset. Open a second tab → same progress, only one tab uploads.
5. **Other devices (US3)** — knob "add remote-only take" → Recordings shows it "In Drive only"; play and download work (from the fake Drive). Delete it → dialog offers device / device + Drive.
6. **Landing (US4)** — `/` → plans poster shows prices from the mock; switch monthly/yearly; change Pro price via knob, reload → new price. Stop the mock API (knob "API down") → baked-in prices still render.
7. **History (US5)** — edit a script, knob clock +11 min, edit again → History drawer lists a version → preview → Restore → text restored, "Before restore" entry present.
8. **Account (US6)** — change email → pending row; knob shows the link → `/confirm-email?token=…` → success card; expired token → expired card. Devices lists "This browser" plus the knob phone; Sign out removes it. Delete account → 14-day card → sign in → "deletion cancelled" toast.

## Checks

- Network tab during a backup: the only request with the file body goes to `www.googleapis.com/upload/drive/v3/…`; requests to the Tilw API carry metadata only (constitution IV, SC-006 on the backend).
- `npm run test:e2e` includes axe checks on `/app/settings/plan`, `/app/settings/storage`, the upgrade dialog and the History drawer.
