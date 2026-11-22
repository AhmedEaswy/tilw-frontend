---
description: "Task list for Web app — accounts, plans & storage (release 2)"
---

# Tasks: Web app — accounts, plans & storage (release 2)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md), Figma frames in [gaps.md](./gaps.md). Backend counterpart: `backend/specs/002-accounts-plans-storage/tasks.md`.

**Tests**: Included (constitution VI). Each story: Vitest for ports/stores (mock and HTTP adapters share the contract suite), Playwright flow on the mock adapter. Write them first and see them fail.

Format: `[ID] [P?] [Story] Description`. `[P]` = parallelisable. Figma frame ids in brackets (page `07 · Release 2`, file `t9xEIr22yKOj7o2Ft32hxb`). Paths are relative to `frontend/`. **Existing pages change only by the additions listed in gaps.md** — no restyling. Each screen task ends with a visual check against its frame in Arabic, plus English via locale files.

## Phase 1: Setup

- [ ] T001 Add i18n key groups `plan.*`, `upgrade.*`, `limits.*`, `storage.*`, `uploads.*`, `history.*`, `email.*`, `devices.*`, `deletion.*` to `i18n/locales/ar.json` and `i18n/locales/en.json` (each story fills its keys)
- [ ] T002 [P] Add runtime config `public.apiBase` reuse check and `public.landingPlansFallback` (Free 0, Pro 800/7700 cents) in `nuxt.config.ts`; allow `https://www.googleapis.com` in any CSP/`connect-src` setting the app ships

## Phase 2: Foundation (blocks all stories)

- [ ] T003 Extend `app/services/types.ts` with every type in data-model.md (`LimitValue`, `Plan`, `MyPlan`, `UpgradeRequest`, `StorageStatus`, `RemoteTake`, `ScriptVersionSummary`, `ScriptVersion`, `Device`, `PendingEmail`), `Script.readOnly` / `readOnlyReason`, `PortErrorCode` + `limit_reached`, `storage_full`, `storage_not_linked`, and `PortError.limit`
- [ ] T004 Extend `app/services/ports.ts` with `PlanPort`, `StoragePort` (+ `DriveUploader` interface), `RemoteTakesPort`, and the new methods on `ScriptsPort`, `AccountPort`, `AuthPort` exactly as contracts/ports.md; add them to `Services`
- [ ] T005 Map the new codes in `app/services/http/client.ts` (403 `limit_reached` with `limit`, 409 `storage_not_linked`, 507 `storage_full`) and add them to `app/composables/useErrorText.ts` fallbacks
- [ ] T006 [P] Add mock clock offset and plan catalogue to `app/services/mock/db.ts` and `app/services/mock/seed.ts` (limit definitions, Free/Pro starting values, signed-in person on Free)
- [ ] T007 Implement `PlanPort` in the mock (`app/services/mock/index.ts`): `listPlans`, `myPlan` with effective-limit resolution (override → plan → Free → default) and usage; shared helper `mockLimits(user)` used by later stories
- [ ] T008 Create `app/stores/plan.ts` (plans, my, `limit(key)`, `load()` after sign-in, refetch on focus ≤ 60 s, after any `limit_reached`, `consumeNotice()`)
- [ ] T009 [P] Extend `tests/unit/mock-services.test.ts` and `tests/unit/http-services.test.ts` contract suites with a `PlanPort` block (list, myPlan, limit resolution) run against both adapters
- [ ] T010 [P] Add `/__mock` sections in `app/pages/__mock.vue`: plan switch, limit editor, override, clock offset (days/minutes)

**Checkpoint**: typecheck passes; contract suites pass on mock; `/__mock` switches plan.

---

## Phase 3: User Story 1 - Know my plan and why something was refused (P1) 🎯 MVP

**Goal**: Plan & usage page, limit-reached dialog, read-only scripts, plan-based recording cap, settings rows.
**Independent Test**: quickstart scenarios 1–2.

### Tests

- [ ] T011 [P] [US1] `tests/unit/limits.test.ts`: mock raises `limit_reached` on create/duplicate/unarchive at `scripts.max_active`, on save over `scripts.max_words`, on edit of read-only scripts; `readOnly` ranking by `updatedAt`; `useLimitError()` maps known keys to actions and unknown keys to the generic message
- [ ] T012 [P] [US1] `tests/unit/media.test.ts`: `recordLimitMs(minutes)` and `mustStop` use the plan value; unknown plan → 10 min
- [ ] T013 [P] [US1] `tests/e2e/plan.spec.ts`: Plan & usage shows plan, meters (warning ≥ 80 %), unknown keys hidden; new script at limit → dialog with Archive / Upgrade; lowered limit → read-only banner, rehearse and record still open; axe check on `/app/settings/plan`

### Implementation

- [ ] T014 [US1] Mock: enforce script limits and compute `readOnly`/`readOnlyReason` in `app/services/mock/index.ts` (`create`, `duplicate`, `update`, `list`, `get`)
- [ ] T015 [US1] HTTP adapter: `PlanPort` routes and `readOnly` fields in `app/services/http/index.ts`
- [ ] T016 [P] [US1] `app/composables/useLimitError.ts` per research §2
- [ ] T017 [P] [US1] `app/components/plans/LimitDialog.vue` built from the release-1 New-script dialog layout [R2-2 `262:790`, dialog from `6:23`]; wire into `app/pages/app/scripts/index.vue` (create, duplicate, unarchive) and the scripts store error path; add "N من M نصاً نشطاً" next to Import [R2-2]
- [ ] T018 [P] [US1] `app/components/plans/UsageMeter.vue` (`role="meter"`, warning at ≥ 80 %) and `app/components/plans/PlanCard.vue` (account-card style) [R2-1 `252:179`]
- [ ] T019 [US1] `app/pages/app/settings/plan.vue` (Plan & usage, Free and Pro states) [R2-1 `252:179`, R2-5 `252:381`]
- [ ] T020 [US1] Settings index: add rows "الخطة والاستخدام" and "التخزين" above the release-1 rows with the existing row component, plan name in the account card, in `app/pages/app/settings/index.vue` [R2-1 `264:1017`]
- [ ] T021 [US1] Read-only editor: banner, `contenteditable=false`, dim Marks and Undo, keep Search/Download/History in `app/pages/app/scripts/[id]/index.vue` and `app/components/editor/` (canvas + writing tools); status chip "للقراءة فقط" [R2-3 `262:893`]
- [ ] T022 [US1] Replace `RECORD_LIMIT_MS` with `recordLimitMs(minutes)` in `app/utils/media.ts`; use `plan.limit('takes.max_minutes')` in `app/pages/app/scripts/[id]/record.vue` and the setup footer copy [R2-6 `264:798`, `264:885`, `264:972`]

**Checkpoint**: US1 unit and e2e tests pass on the mock.

---

## Phase 4: User Story 2 - Upgrade to Pro through WhatsApp (P1)

**Goal**: Plans poster component, upgrade dialog, pending request, Pro notices and banners.
**Independent Test**: quickstart scenario 3.

### Tests

- [ ] T023 [P] [US2] `tests/unit/upgrade.test.ts`: mock `requestUpgrade` returns the same `TLW-XXXX` twice, WhatsApp text has plan/period/price/reference and no email or name; cancel; notices `pro_started` / `pro_ended` once; contract block for both adapters
- [ ] T024 [P] [US2] `tests/e2e/upgrade.spec.ts`: dialog shows the home-page poster with "خطتك الحالية" and "متابعة على واتساب"; yearly/monthly switch; popup blocked (stub `window.open` → null) shows reference + copy + link; pending panel and cancel; clock knob → ending banner (dismiss 24 h) → back-on-Free notice

### Implementation

- [ ] T025 [US2] Mock: subscription requests (reference generator, 30-day expiry), fulfil/reject/expire knobs, subscription in force from the clock, notices, in `app/services/mock/index.ts` and `app/pages/__mock.vue`
- [ ] T026 [US2] HTTP adapter: `requestUpgrade`, `cancelRequest` in `app/services/http/index.ts`
- [ ] T027 [US2] Extract `app/components/plans/PlansPoster.vue` from `app/pages/index.vue` `#plans` (markup, styles, `app/landing/plans.js` animation) with props `plans`, `period`, `mode: 'landing' | 'upgrade'`; "Plus" → "Pro", price row with monthly/yearly switch [R2-13 `259:692`]
- [ ] T028 [US2] `app/composables/useUpgrade.ts`: open `about:blank` synchronously in the click, request, navigate it to `whatsappUrl`, fallback state when blocked or `whatsappUrl` null (research §5)
- [ ] T029 [US2] `app/components/plans/UpgradeDialog.vue` (poster in `UiDialog`, upgrade mode) and entry points: Plan & usage button, `LimitDialog` "Upgrade", account menu, `?upgrade=1` query [R2-4 `264:1321`]
- [ ] T030 [P] [US2] `app/components/plans/RequestPanel.vue` (reference with copy, period, price, sent date, reopen WhatsApp, cancel with confirm) in `app/pages/app/settings/plan.vue` [R2-5 `252:297`]
- [ ] T031 [US2] Pro-ending banner on Plan & usage and library (dismiss for 24 h in `localStorage`, try/catch) and one-time toasts for `pro_started` / `pro_ended` in `app/layouts/app.vue` [R2-5 `252:381`]

**Checkpoint**: US2 tests pass; WhatsApp link verified free of personal data.

---

## Phase 5: User Story 3 - Keep my takes in my Google Drive (P1)

**Goal**: Storage settings, sync modes, resumable uploads with a single-owner queue, Drive status on takes, Drive-only takes, delete choice.
**Independent Test**: quickstart scenarios 4–5.

### Tests

- [ ] T032 [P] [US3] `tests/unit/drive-uploader.test.ts`: resumable init → `Location`; 8 MiB chunks with `Content-Range`; `308` resumes from `Range`; `403 storageQuotaExceeded` → `storage_full`; `401` twice → `storage_not_linked`; token refreshed 2 min before expiry
- [ ] T033 [P] [US3] `tests/unit/upload-queue.test.ts`: enqueue per user; persists `sessionUrl`/`offset`; resumes after "reload"; only the lock holder uploads (two queue instances, fake `navigator.locks`); progress broadcast; failure keeps the device blob; retry; sign-out stops
- [ ] T034 [P] [US3] `tests/unit/storage-ports.test.ts`: contract blocks for `StoragePort` and `RemoteTakesPort` on both adapters (status, setSyncMode limits, register idempotency, max minutes, update, remove remote)
- [ ] T035 [P] [US3] `tests/e2e/storage.spec.ts`: link (mock redirect `?linked=1`), manual backup to "في Google Drive", Auto locked on Free opens upgrade, Drive `full` → failed + Retry, second tab shows progress, Drive-only take plays and downloads, delete dialog choices, unlink → "غير متاح"; network assertion: file body only to the Drive endpoint

### Implementation

- [ ] T036 [US3] `app/services/mock/drive.ts`: fake Drive (link, quota, folders, resumable session emulation with `308`, blob store `tilw-mock-drive`, modes `ok`/`full`/`revoked`/`slow`); `StoragePort` + `RemoteTakesPort` in `app/services/mock/index.ts`; knobs in `app/pages/__mock.vue` (Drive mode, add remote-only take)
- [ ] T037 [US3] `app/services/drive/uploader.ts` (resumable upload, download, delete over `fetch`, error mapping) per research §7
- [ ] T038 [US3] `app/services/drive/queue.ts` (IndexedDB store `tilw-uploads`, Web Lock `tilw-uploads` with BroadcastChannel fallback, progress channel, pause during countdown/recording)
- [ ] T039 [US3] HTTP adapter: `StoragePort` and `RemoteTakesPort` routes in `app/services/http/index.ts`; `uploader()` returns the real Drive uploader
- [ ] T040 [P] [US3] Stores `app/stores/storage.ts` and `app/stores/uploads.ts`; extend `app/stores/takes.ts` with `remote`, merge by `clientId`, `TakeView` place derivation (data-model.md table)
- [ ] T041 [US3] `app/pages/app/settings/storage.vue` with `app/components/storage/LinkCard.vue`, `SyncModeControl.vue`, `SpaceMeters.vue`; handle `?linked=1` / `?error=` once [R2-6 `254:501`, `254:564`]
- [ ] T042 [US3] `app/components/recordings/TakeStorageStatus.vue` using the release-1 storage-status chip variants; add it plus "نسخ إلى Drive" and the storage-mode line to `app/pages/app/recordings/index.vue`, and Drive-only rows [R2-7 `262:1018`]
- [ ] T043 [US3] Take review: status chip, "نسخ إلى Google Drive" secondary action, "حذف المحاولة" link, Drive playback/download for Drive-only takes in `app/pages/app/recordings/[takeId].vue` [R2-7 `264:676`]
- [ ] T044 [US3] Delete dialog with device / device + Drive / cancel (release-1 dialog layout) in `app/components/recordings/` [R2-8 `264:732`]
- [ ] T045 [US3] Auto mode: enqueue on take save in `app/pages/app/scripts/[id]/record.vue` after the studio returns to setup; Pro setup hint copy [R2-6 `264:885`]

**Checkpoint**: US3 tests pass; constitution IV network check green.

---

## Phase 6: User Story 4 - See current plans on the landing page (P2)

**Goal**: Landing poster fed by the service with build-time fallback.
**Independent Test**: quickstart scenario 6.

### Tests

- [ ] T046 [P] [US4] `tests/e2e/public.spec.ts` additions: plans section shows mock prices; switch updates price and saving; changed price after reload; API down → fallback prices; "احصل على Tilw Pro" signed out → sign-in → upgrade dialog; signed in → upgrade dialog

### Implementation

- [ ] T047 [US4] `app/composables/usePublicPlans.ts` (client fetch after hydration, fallback from runtime config)
- [ ] T048 [US4] Use `<PlansPoster mode="landing">` in `app/pages/index.vue` `#plans`; CTA to `/app/settings/plan?upgrade=1` with sign-in redirect; remove the dead `href="#"`; Free list lines from limits [R2-13 `259:692`]

**Checkpoint**: landing prerenders; poster matches the frame.

---

## Phase 7: User Story 5 - Go back to an earlier version of my script (P2)

**Goal**: History drawer, preview, restore.
**Independent Test**: quickstart scenario 7.

### Tests

- [ ] T049 [P] [US5] `tests/unit/versions.test.ts`: mock 10-minute rule with the clock knob, list newest first, get, restore with base version → conflict on stale, `restore` version created; Free trims to 5; contract block on both adapters
- [ ] T050 [P] [US5] `tests/e2e/history.spec.ts`: open History from writing tools, preview (editor text unchanged), restore with confirm, toast, read-only script can view but not restore; axe on the drawer

### Implementation

- [ ] T051 [US5] Mock and HTTP `listVersions`, `getVersion`, `restoreVersion` in `app/services/mock/index.ts` and `app/services/http/index.ts`
- [ ] T052 [US5] `app/components/editor/HistoryDrawer.vue` in the reading-settings drawer layout; "السجل" item in writing tools; preview state chip "معاينة نسخة سابقة"; editor store `openHistory`, `preview`, `restore` in `app/stores/editor.ts` [R2-9 `262:954`]

**Checkpoint**: US5 tests pass; release-1 conflict screen reused.

---

## Phase 8: User Story 6 - Manage my email, my devices and account deletion (P3)

**Goal**: Email change + confirm page, devices list, 14-day deletion copy, cancelled notice.
**Independent Test**: quickstart scenario 8.

### Tests

- [ ] T053 [P] [US6] `tests/unit/account-r2.test.ts`: mock email change (pending, resend, cancel, confirm, expired, invalid), devices list/revoke, `deleteAccount` returns `deletionDueAt`, `lastNotice()` `deletion_cancelled` once; contract block on both adapters
- [ ] T054 [P] [US6] `tests/e2e/settings.spec.ts` additions: email change pending row, `/confirm-email` success and expired cards, devices revoke, delete → 14-day card → sign-in toast

### Implementation

- [ ] T055 [US6] Mock and HTTP account/auth additions (`requestEmailChange`, `pendingEmailChange`, `cancelEmailChange`, `resendEmailChange`, `listDevices`, `revokeDevice`, `confirmEmail`, `lastNotice`, changed `deleteAccount`) in `app/services/mock/index.ts`, `app/services/http/index.ts`; mock knob shows the email link token
- [ ] T056 [US6] Account page: email pending row and Devices section in `app/pages/app/settings/account.vue` (release-1 layout, additions only) [R2-10/11 `255:724`]
- [ ] T057 [P] [US6] `app/pages/confirm-email.vue` in the task-card layout, success and expired states [R2-10 `264:1125`, `264:1144`]
- [ ] T058 [US6] Delete flow: success state shows the 14-day task card with the date in `app/pages/app/settings/delete.vue`; `deletion_cancelled` toast after sign-in in `app/stores/auth.ts` [R2-12 `264:1106`]

**Checkpoint**: all story tests pass on the mock.

---

## Phase 9: Polish & cross-cutting

- [ ] T059 [P] Update privacy and terms copy (`app/pages/privacy.vue`, `app/pages/terms.vue`): takes may be copied to the person's own Drive when they choose; Tilw sees only files it creates; Tilw never stores recordings (FR-021)
- [ ] T060 [P] Phone layouts for the new pages and dialogs (bottom sheets via `UiDialog`), following the phone frames of the matching release-1 screens; dark theme check with existing tokens
- [ ] T061 [P] English review of every new string in the browser (`/en` locale)
- [ ] T062 [P] Extend `tests/unit/http-live.test.ts` with release-2 ports against backend 002 (`STORAGE_FAKE=true`)
- [ ] T063 Update `specs/001-studio-frontend/contracts/ports.md` header to link the release-2 delta, and `gaps.md` with anything found while building
- [ ] T064 Run `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run generate`, and quickstart scenarios 1–8; record results

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** sequential; Phase 2 blocks all stories (types, ports, plan store).
- **US1** needs Phase 2. **US2** needs US1's Plan & usage page (T019) and limit dialog (T017) for entry points. **US3** needs Phase 2 only (Auto lock links to the upgrade dialog if US2 is done; otherwise to Plan & usage). **US4** needs US2's `PlansPoster` (T027). **US5** needs US1's read-only editor work (T021, same files). **US6** independent after Phase 2.
- Backend dependencies for the live adapter: US1 ↔ backend US1/US3, US2 ↔ backend US2, US3 ↔ backend US4, US5 ↔ backend US6, US6 ↔ backend US5/US7. Mock-first means no story waits for the backend.

## Parallel Examples

- **Phase 2**: T006, T009, T010 together after T003–T005.
- **US1**: T011–T013 together; T016, T017, T018 together.
- **US3**: T032–T035 together; T037 and T040 together after T036.
- **Across stories** (two developers after US1): A takes US2 → US4; B takes US3; then US5 and US6 split.

## Implementation Strategy

- **MVP**: Phase 1, Phase 2, US1 — plan visible, limits explained, read-only scripts, plan-based recording cap.
- **Increment 2**: US2 + US4 — upgrade via WhatsApp, landing plans from the service.
- **Increment 3**: US3 — Drive backups (mock first, then live with backend `STORAGE_FAKE`, then real Google).
- **Increment 4**: US5, US6.
- Each increment keeps release-1 e2e flows green and existing frames unchanged except their listed additions.
