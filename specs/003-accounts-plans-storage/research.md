# Research: Web app — accounts, plans & storage

Each decision: what, why, what else was weighed. Backend decisions are in `backend/specs/002-accounts-plans-storage/research.md`; this file covers the browser side.

## 1. Port shape

- **Decision**: three new ports and additions to existing ones (full list in [contracts/ports.md](./contracts/ports.md)):
  - `PlanPort` — `listPlans`, `myPlan`, `requestUpgrade`, `cancelRequest`.
  - `StoragePort` — `status`, `connectUrl`, `unlink`, `setSyncMode`, `uploadToken`, `uploader()` (returns the Drive uploader; the mock returns a fake).
  - `RemoteTakesPort` — `list`, `register`, `update`, `remove`.
  - `ScriptsPort` + `listVersions`, `getVersion`, `restoreVersion`; `Script`/`ScriptSummary` + `readOnly`, `readOnlyReason`.
  - `AccountPort` + `requestEmailChange`, `pendingEmailChange`, `cancelEmailChange`, `resendEmailChange`, `listDevices`, `revokeDevice`; `deleteAccount` now returns `{ deletionDueAt }`.
  - `AuthPort` + `confirmEmail`; `signIn` returns `{ user, notice? }` via a new `lastNotice()` so the existing `signIn(): Promise<User>` signature stays.
- **Rationale**: mirrors backend route groups one to one, keeps release-1 method signatures (FR-032 on the backend side, constitution III here).
- **Alternatives**: one big `BillingPort` (mixes Drive and plans); putting take records on the existing `TakesRepo` (that repo is device-only by design).

## 2. Error codes

- **Decision**: `PortErrorCode` gains `limit_reached`, `storage_full`, `storage_not_linked`. `PortError` gains optional `limit: { key, value, usage }`. The HTTP client maps by `code` (status is informative only). Google upload errors map locally: HTTP 403 with reason `storageQuotaExceeded` → `storage_full`; 401 after one token refresh → `storage_not_linked`.
- `useLimitError()` turns a `limit_reached` into the R2-2 dialog content: title, sentence with value and usage, and the fixing action per key (`scripts.max_active` → Archive a script; `scripts.max_words` → shorten; `takes.max_minutes` → info only; `storage.auto_sync` → upgrade). Unknown keys get a generic "limit of your plan" message plus Upgrade (spec US1 #5).

## 3. Plan store and limits

- **Decision**: `usePlanStore` holds `plans`, `myPlan`, `pendingRequest`. It loads after sign-in, refetches on window focus (at most every 60 s) and after any `limit_reached`. Getter `limit(key)` returns the effective value or `undefined`; components show only keys they know (spec US1 #5). One-time notices (`pro_started`, `pro_ended`, `deletion_cancelled`) come from the server and show once as toasts.
- **Rationale**: the server decides; the client never enforces limits on its own (spec edge case "limit checks never run on the device alone"), except the recording cap, which must stop a take locally.
- **Recording cap**: `RECORD_LIMIT_MS` becomes `recordLimitMs(minutes)` with the plan's `takes.max_minutes`; when the plan is unknown (offline) the release-1 value of 10 minutes is used so recording always works.

## 4. Plans poster (home-page design)

- **Decision**: extract the landing `#plans` markup, styles and `landing/plans.js` animation into `components/plans/PlansPoster.vue` with props `{ plans, period, mode }`. Landing mode: CTA "احصل على Tilw Pro" → `/app/settings/plan?upgrade=1` (via sign-in when signed out). Upgrade mode: Free CTA becomes "خطتك الحالية" (disabled) and Pro CTA "متابعة على واتساب". Monthly/yearly switch updates the price row.
- **Landing data**: the landing is prerendered; `usePublicPlans()` fetches `GET /api/plans` on the client after hydration and swaps prices in place. The build bakes the starting values (Free $0; Pro $8 / $77) into the HTML as a fallback so the section never shows a broken state when the API is unreachable (spec US4 #1).
- **Alternatives**: fetch at build time only (stale prices until redeploy — violates "editable without a release"); render from SSR at runtime (the site is static).

## 5. Upgrade flow and WhatsApp

- **Decision**: `useUpgrade().start(period)` calls `PlanPort.requestUpgrade`, then opens the returned `whatsappUrl` with `window.open(url, '_blank', 'noopener')` **inside the click handler** (avoids popup blockers). The window is opened synchronously with `about:blank` first, then navigated after the request resolves; if `window.open` returns `null`, the dialog switches to the fallback state (R2-5 panel: reference with copy button and "open the link" button). `whatsappUrl: null` (no sales number configured) shows the reference only.
- **Rationale**: the async request would otherwise lose the user-gesture and get blocked.

## 6. Google Drive linking (web)

- **Decision**: `StoragePort.connectUrl('web')` → full-page navigation to Google; the API callback redirects to `/app/settings/storage?linked=1` or `?error=denied|failed`; the page reads the query once, shows the message, then replaces the URL. No Google script is loaded anywhere.
- **Tokens**: the uploader asks `StoragePort.uploadToken(scriptId)` for `{ accessToken, expiresAt, folderId }`, keeps it in memory only, refreshes 2 minutes before expiry or after a 401.

## 7. Uploading takes (resumable, browser → Drive)

- **Decision**: Google's resumable upload protocol over `fetch`:
  1. `RemoteTakesPort.register()` (limit checks, record `uploading`).
  2. `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` with metadata `{ name, parents: [folderId], mimeType }` → session URL (`Location`).
  3. `PUT` chunks of 8 MiB with `Content-Range`; `308` = continue at the `Range` offset; `200/201` = done, body has the file id.
  4. `RemoteTakesPort.update(id, { state: 'backed_up', providerFileId })`.
- **Queue**: `services/drive/queue.ts` persists one entry per take in IndexedDB (`takeId`, `remoteId`, `sessionUrl`, `offset`, `state: waiting | uploading | failed`, `error`). After a reload the session URL resumes from the server-reported offset (Google keeps sessions about a week); expired sessions restart.
- **One owner tab**: the queue runs only in the tab that holds the Web Lock `tilw-uploads` (`navigator.locks.request`, released on unload so another tab takes over). Progress is broadcast on a `BroadcastChannel('tilw-uploads')` so every tab shows the same badge (spec edge case "two tabs"). Browsers without Web Locks fall back to a BroadcastChannel leader election.
- **When uploads run**: `auto` mode enqueues on take save; `manual` on "نسخ إلى Google Drive"; nothing runs while the recording studio is in countdown or recording (constitution V). Sign-out stops the queue; entries stay for that account only (keyed by user id).
- **Never lose a take**: the device blob is untouched by the queue; a failure marks the entry `failed` with the mapped error (`storage_full`, `storage_not_linked`, network) and shows Retry.
- **Alternatives**: multipart single request (no resume for 1 GB takes); uploading through the Tilw API (forbidden by constitution IV); a Service Worker background upload (Background Fetch is not available in Safari/Firefox; uploads only while the app is open is an accepted assumption).

## 8. Takes from other devices (Drive only)

- **Decision**: the recordings page merges `TakesRepo.list()` (device) with `RemoteTakesPort.list()` by `clientId`. Remote-only entries render with the release-1 storage-status chip "في Drive فقط". Playback streams with `GET files/{id}?alt=media` using the access token into a Blob URL (`fetch` + `MediaSource` is not needed at this size; for > 200 MB we play from a progressive `Blob` after download with progress). Download saves the same blob with the original file name. A 404 from Drive → `RemoteTakesPort.update(id, { state: 'unreachable' })`.

## 9. Read-only scripts and history

- **Decision**: the editor reads `script.readOnly`; when true it renders the R2-3 banner, sets the canvas `contenteditable=false`, disables marks/undo tools and keeps rehearse, record, export, archive, delete and History. History opens `HistoryDrawer` (reading-settings drawer layout); restore calls `ScriptsPort.restoreVersion(id, versionId, baseVersion)` and reuses the release-1 conflict screen on `conflict`.

## 10. Mock adapter

- **Decision**: extend the in-browser mock with: plan catalogue and limits (editable from `/__mock`), effective-limit resolution and `limit_reached` on the same actions as the backend, subscription requests with a fixed reference pattern, a clock offset knob (to test "ending soon" / "ended"), versions with the 10-minute rule (honouring the clock knob), a fake Drive (`mock/drive.ts`) that stores uploaded blobs in a separate IndexedDB store, reports quota, and can be set to `full`, `revoked` or `slow`, devices and email change. The mock uploader implements the same queue interface so Playwright exercises the real queue code against the fake Drive.
- **Rationale**: every story testable without Google or the backend (spec FR-019).

## 11. Delete account copy

- **Decision**: the release-1 delete page keeps its form; on success it shows the R2-12 task card with `deletionDueAt` formatted in the person's locale, then signs out. After any sign-in, a `deletion_cancelled` notice shows once as a toast.

## 12. Settings structure

- **Decision**: settings index gets the two rows from R2-1 (`Plan & usage`, `Storage`) above the release-1 rows, in the existing row component; the account card shows the plan name. New pages `/app/settings/plan` and `/app/settings/storage` follow the settings page layout (R2-1, R2-5, R2-6 frames). The account page (release-1 T093) gains the email-change pending row and a Devices section.
