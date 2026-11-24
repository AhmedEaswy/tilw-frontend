# Implementation Plan: Web app — accounts, plans & storage (release 2)

**Branch**: `002-accounts-plans-storage` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md); backend contract `backend/specs/002-accounts-plans-storage/contracts/openapi.yaml` and its [research](../../../backend/specs/002-accounts-plans-storage/research.md); Figma frames in [gaps.md](./gaps.md).

## Summary

Add the release-2 screens to the existing Nuxt studio without changing release-1 layouts: Plan & usage and Storage settings pages, two new settings rows, the plans poster (home-page design) on the landing and in an upgrade dialog, limit-reached handling, read-only scripts, a History drawer, Drive status on recordings and take review, email change, devices and the 14-day deletion copy. Data stays behind ports (constitution III): new `PlanPort`, `StoragePort` and `RemoteTakesPort`, plus methods on `ScriptsPort`, `AccountPort` and `AuthPort`; the mock adapter simulates plans, requests, a fake Google Drive and devices; the HTTP adapter maps the backend 002 routes. Takes upload **from the browser straight to Google Drive** with resumable uploads driven by a small queue that one tab owns at a time. The recording cap and every price and limit come from the service. Decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5, Nuxt 4.6 — unchanged

**Primary Dependencies**: existing (`pinia`, `@nuxtjs/i18n`, `idb-keyval`, `zod`, `@vueuse/core`); **no new packages**. Google Drive is called with `fetch` (resumable upload protocol, files.get/delete); no Google JS SDK, no `gapi` script (privacy promise: no third-party scripts)

**Storage**: release-1 IndexedDB take store gains an upload-queue store (`tilw:upload:<takeId>`) with the resumable session URL and byte offset; plan data is server state only (Pinia cache, refetched on focus)

**Testing**: Vitest for stores, ports (mock and HTTP adapters share one contract suite, as in release 1), the upload queue (fake Drive endpoint), limit-error mapping; Playwright flows per user story against the mock adapter; `test:live` runs the HTTP adapter against backend 002 with `STORAGE_FAKE=true`

**Target Platform**: evergreen browsers, desktop and phone (320 px up); Web Locks API (all evergreen browsers) for the single upload owner, with a BroadcastChannel fallback

**Project Type**: web application (static Nuxt build) — frontend repository only

**Performance Goals**: Plan & usage visible < 1 s after navigation on a warm cache; recordings list shows Drive-only takes within 5 s of opening (SC-005); uploads use 8 MiB chunks and never block the UI thread

**Constraints**: release-1 frames unchanged except the additions in [gaps.md](./gaps.md); take bytes go only to `www.googleapis.com` (never to the Tilw API); no hard-coded price or limit except the landing's build-time fallback; Arabic and English for every new string

**Scale/Scope**: 6 new routes / states (`/app/settings/plan`, `/app/settings/storage`, `/confirm-email`, upgrade dialog, History drawer, limit dialog), ~13 changed components, 3 new stores, 3 new ports

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1.* Constitution v1.1.0.

| Principle | How the plan satisfies it | Result |
|---|---|---|
| I. Arabic-first, bilingual | New copy only in `i18n/locales/{ar,en}.json`; logical CSS; prices use Western digits and `$` in both locales, as the reader does | Pass |
| II. Figma is the source of truth | Every screen cites its frame in [gaps.md](./gaps.md); existing pages are built from the copied release-1 frames with additions only; plans use the home-page poster component | Pass |
| III. Swappable data port | All new data goes through `PlanPort`, `StoragePort`, `RemoteTakesPort` and new methods on existing ports; components never call `fetch` — the Drive upload lives in `services/drive/` behind `StoragePort.uploader()` | Pass |
| IV. Recordings never touch Tilw's servers | Upload target is Google's resumable endpoint with a short-lived token; `RemoteTakesPort` sends metadata only; sync defaults to `off`; failed uploads never delete the device copy (queue keeps the blob reference until `backed_up`) | Pass |
| V. Calm reading surfaces | No banners, badges or upload toasts on rehearsal or recording stages; uploads start only after the studio returns to setup | Pass |
| VI. Accessible and testable | Each story has a Playwright flow on the mock; dialogs/drawer reuse `UiDialog` focus handling; meters expose `role="meter"` with value text | Pass |

**Result**: PASS, no violations. Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-accounts-plans-storage/
├── spec.md, gaps.md, checklists/
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: client-side shapes and stores
├── contracts/ports.md   # Phase 1: port delta over 001's contracts/ports.md
├── quickstart.md        # Phase 1
└── tasks.md             # /speckit-tasks
```

### Source Code (changes in `frontend/`)

```text
app/
├── services/
│   ├── ports.ts                 # + PlanPort, StoragePort, RemoteTakesPort; + methods on Scripts/Account/Auth ports
│   ├── types.ts                 # + Plan, LimitValue, MyPlan, UpgradeRequest, StorageStatus, RemoteTake,
│   │                            #   ScriptVersion*, Device, PendingEmail; PortErrorCode + 3 codes; Script.readOnly
│   ├── takes.ts                 # TakeMeta + remote?: { id, state, providerFileId }; endedBy limit uses plan cap
│   ├── drive/
│   │   ├── uploader.ts          # resumable upload (init, PUT chunks, resume via 308 Range) over fetch
│   │   └── queue.ts             # IndexedDB upload queue + single-owner lock + progress events
│   ├── mock/
│   │   ├── index.ts             # + plans, requests, versions, storage, takes, devices, email change
│   │   ├── drive.ts             # fake Drive: link, quota, upload (stores to IndexedDB "cloud"), full/revoked/slow
│   │   └── seed.ts              # + Free/Pro catalogue, a pending-request scenario
│   └── http/
│       ├── client.ts            # + new codes, limit payload, 403/409/507 mapping
│       └── index.ts             # + new routes
├── stores/
│   ├── plan.ts                  # plans, myPlan, request, notices, `limit(key)` getter
│   ├── storage.ts               # status, sync mode, link/unlink
│   └── uploads.ts               # queue state per take, progress, retry
├── composables/
│   ├── useLimitError.ts         # maps limit_reached → dialog content + action
│   └── useUpgrade.ts            # open dialog, request, open WhatsApp with popup-blocked fallback
├── components/
│   ├── plans/PlansPoster.vue    # extracted from pages/index.vue #plans; props: plans, period, mode (landing | upgrade)
│   ├── plans/UpgradeDialog.vue  # poster in UiDialog (R2-4)
│   ├── plans/LimitDialog.vue    # release-1 dialog layout (R2-2)
│   ├── plans/UsageMeter.vue, PlanCard.vue, RequestPanel.vue
│   ├── storage/LinkCard.vue, SyncModeControl.vue, SpaceMeters.vue
│   ├── recordings/TakeStorageStatus.vue   # wraps release-1 storage-status chip variants
│   └── editor/HistoryDrawer.vue           # reading-settings drawer layout
├── pages/
│   ├── index.vue                # #plans → <PlansPoster> fed by usePublicPlans()
│   ├── confirm-email.vue        # task-card layout (6:66)
│   └── app/settings/{index,plan,storage,account,delete}.vue  # index + account + delete changed; plan, storage new
├── utils/media.ts               # RECORD_LIMIT_MS removed → recordLimitMs(planMinutes)
└── pages/__mock.vue             # + plan, limits, request, clock, Drive knobs
i18n/locales/{ar,en}.json        # + plan.*, storage.*, upgrade.*, history.*, devices.*, email.*
tests/unit/**, tests/e2e/**      # per story
```

**Structure Decision**: keep the release-1 layering (ports → stores → pages/components). The only new layer is `services/drive/`, a browser-side client for Google's upload endpoint; it sits behind `StoragePort` so the mock can replace it with a fake Drive and components never see tokens. `PlansPoster` is extracted from the landing page so the landing and the upgrade dialog render the same home-page design (owner rule).

## Complexity Tracking

No constitution violations. One release-1 behaviour changes on purpose: `AccountPort.deleteAccount` now resolves to `{ deletionDueAt }` and the delete page shows the 14-day copy (backend 002 FR-026).
