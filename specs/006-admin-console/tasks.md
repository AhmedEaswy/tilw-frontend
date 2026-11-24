---
description: "Task list for Web app — Admin console (release 2)"
---

# Tasks: Web app — Admin console (release 2)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md), Figma frames in [gaps.md](./gaps.md). Backend counterpart: `backend/specs/005-admin-console` (PR AhmedEaswy/tilw-backend#4; `contracts/openapi.yaml` 5.0.0).

**Tests**: Included (constitution VI). Vitest for logic and one port contract suite (`tests/unit/admin-ports.test.ts`) against the mock and the HTTP adapter (fake fetch); a Playwright flow per story against the mock on port 3150.

**Conventions**:
- Format: `[ID] [P?] [Story] Description`. `[P]` = can run in parallel (different files, no unfinished dependency).
- Figma frames are named by their gaps.md row (D1–D14, page `10 · Release 2 · Admin console`, file `t9xEIr22yKOj7o2Ft32hxb`).
- Paths are relative to `frontend/`.
- **Start gate**: no task from T003 on starts before `origin/main` (with frontend PR #5 and backend #4 merged) is merged into this branch (T002).
- Reading surfaces, phone link and AI tool code are not changed.
- Each screen task ends with a visual check against its frame in Arabic, plus English.

## Phase 1: Setup

- [X] T001 Draw frames D1–D14 on Figma page `10 · Release 2 · Admin console` from page `01 · Design system` (desktop 1440, Arabic RTL first, English LTR for the frame shell, dashboard and user detail). Record node ids in `specs/006-admin-console/gaps.md`. *(Drawn on page `306:100`; node ids in gaps.md.)*
- [X] T002 Merge `origin/main` into the branch after frontend PR #5 and backend #4 are merged; re-read backend `specs/005-admin-console/contracts/openapi.yaml` on `origin/main` and note any change in gaps.md. Run vitest and typecheck on the merge before any change.
- [X] T003 [P] Add i18n groups `admin.*` (rail, topBar, env, dashboard, users, detail, actions, joining, plans, subscriptions, payments, ai, ledger, audit (with `admin.audit.action.*` for every action name in contracts/ports.md), settings, common table copy), `signup.*`, `errors.accountSuspended`, `errors.accountSuspendedContact`, `errors.signupClosed` to `i18n/locales/ar.json` and `en.json`. Stories fill their keys.
- [X] T004 [P] `nuxt.config.ts`: `routeRules['/admin/**'] = { ssr: false }`; runtime `public.environment` (`local`) and `public.supportEmail` (`''`).

## Phase 2: Foundation (blocks all stories)

- [X] T005 Types from data-model.md in `app/services/types.ts` (Feature 006 banner); `account_suspended` and `signup_closed` in `PortErrorCode`.
- [X] T006 `app/services/ports.ts`: extend `AdminPort` (contracts/ports.md), add `SettingsPort`, `AuthPort.signUp`, `settings` in `Services`.
- [X] T007 `app/services/http/client.ts`: the two codes in `CODES`; a `raw` request option that returns `{ body, headers }`. `app/composables/useErrorText.ts`: fallback texts for both codes.
- [X] T008 `app/services/http/index.ts`: every admin route, `settings.public`, `auth.signUp` (CSRF as login); users page from array + `X-Next-Cursor`; list envelopes → `Page`; audit integer cursor; query builder that drops empty values and sends `Z` times.
- [X] T009 Mock admin backend `app/services/mock/admin.ts` (KV `tilw:mock:admin:v1`, research R12): seeded admin and ~40 people across plans, statuses and dates; last active; suspensions; settings (mode, flags, key states with last4 only); audit writer with backend action names; every refusal in contracts/ports.md; dashboard, usage and ledger figures computed from mock state (people, subscriptions, requests, takes, 005-AI mock calls and ledger).
- [X] T010 Wire `admin`, `settings`, `auth.signUp` in `app/services/mock/index.ts` (sign-in, reset and invite accept refuse suspended people with `account_suspended`; sign-up refuses with `signup_closed` while invite-only; seeded admin sign-in) and `app/services/mock/seed.ts`.
- [X] T011 `app/plugins/services.ts`: provide `settings` (not guarded); `guard` handles `account_suspended` (clear session → `/signin?suspended=1`); the unauthenticated redirect also applies on `/admin` paths.
- [X] T012 [P] Contract suite `tests/unit/admin-ports.test.ts` for both adapters: users paging (header cursor), detail, each action and its audit entry, refusals (self, admin target, last admin, already suspended, plan in force), waitlist filters/remove, subscriptions/payments totals, usage groups (day zeros), calls failures, ledger filter, settings key never echoed, flags, audit filters and action list, public settings, sign-up open/closed.
- [X] T013 [P] `app/composables/usePagedList.ts` and `useQueryFilters.ts` with `tests/unit/admin-paging.test.ts` (load more, reset on filter change, stale answer dropped, error then retry, filters ↔ query with debounce).
- [X] T014 [P] `app/utils/adminActions.ts` (`actionAvailability`, research R11) and `app/utils/bytes.ts` with `tests/unit/admin-actions.test.ts`.
- [X] T015 `app/middleware/admin.ts` (signed out → `/signin?next`, non-admin → `/app/scripts`) and `/admin/**` in `app/middleware/auth.global.ts`; `/signup` joins the guest-only pages.
- [X] T016 Admin layout `app/layouts/admin.vue` with `components/admin/AdminRail.vue`, `AdminTopBar.vue` (people search → `/admin/users?q=`, `EnvBadge.vue`, back to studio, account menu), drawer below 1024 px, icon rail 1024–1279 px (frame D1 shell, D14 narrow).
- [X] T017 [P] Shared admin components: `AdminTable.vue` (caption, sticky head, dense rows, skeleton, empty, error + Retry) and `assets/css/admin-table.css` dense variant, `LoadMore.vue`, `FilterBar.vue`, `StatTile.vue`, `StatusChip.vue`, `AdminBarChart.vue` (SVG + hidden table), `AdminConfirmDialog.vue` (reason, type-to-confirm), `PersonPicker.vue`.
- [X] T018 `/__mock` knobs in `app/pages/__mock.vue`: Sign in as admin, Sign-up mode, Suspend current person, Admin lists fail, Empty dashboard, Admin seed summary.

**Checkpoint**: ports, adapters, guards, layout and shared components are tested; no console page yet.

## Phase 3: User Story 1 — Console frame and dashboard (P1) 🎯 MVP

- [X] T019 [US1] `app/pages/admin/index.vue`: period picker (7/30/90/365 in `?days=`), stat groups, sign-ups chart, attention strip linking to filtered pages (frame D1).
- [X] T020 [US1] Studio entry: "Admin console" in the account menu / rail for admins only (`app/layouts/app.vue`), pointing to `/admin`.
- [X] T021 [US1] e2e `tests/e2e/admin-dashboard.spec.ts`: admin opens `/admin`, figures match the seed for 30 and 7 days, attention links, empty-dashboard knob shows zeros, non-admin and signed-out redirects, Arabic and English.

## Phase 4: User Story 2 — Find a person and act (P1)

- [X] T022 [US2] `app/pages/admin/users/index.vue`: search, plan filter (from `admin.plans()`), status filter, dense table, Load more (frame D2).
- [X] T023 [US2] `app/stores/adminUser.ts` (detail, busy, gone) and `app/pages/admin/users/[id].vue`: header with status and actions, panels (plan with subscription history from `userSubscriptions`, limits/overrides, credits, storage, sessions/devices, scripts, AI, recent audit) (frame D3).
- [X] T024 [US2] Action dialogs: suspend and schedule deletion (`AdminConfirmDialog` with reason + type email), unsuspend, password reset, make/stop admin, cancel deletion (plain confirm); `ChangePlanDialog.vue`, `CreditsDialog.vue`, `OverrideDialog.vue` (frame D4). Disabled actions show their reason; service refusals show the message and reload the person.
- [X] T025 [US2] e2e `tests/e2e/admin-users.spec.ts`: filters and load more, open a person, every action and its audit entry, self actions disabled, admin-target refusal, `not_found` after deletion shows the gone state.

## Phase 5: User Story 3 — Waitlist and invitations in the console (P1)

- [X] T026 [US3] Move the pages to `app/pages/admin/waitlist.vue` (search, invited filter, has-account mark, remove with confirm) and `app/pages/admin/invitations.vue` (invite button in the header); extend `app/stores/admin.ts` (`removeWaitlist`, filters); remove `AdminFrame.vue` (frame D5).
- [X] T027 [US3] `app/pages/app/admin/index.vue` and `invitations.vue` become redirects to the new pages.
- [X] T028 [US3] e2e `tests/e2e/admin-joining.spec.ts`: old addresses forward, filters, invite, remove, resend, withdraw (replaces any skipped mock-mode admin tests).

## Phase 6: User Story 4 — Plans, subscriptions, payments (P2)

- [X] T029 [US4] `app/pages/admin/plans.vue` with `PlanEditor.vue` and `LimitCell.vue`: names, prices (dollars ↔ cents), active (Free disabled), order, limit values set/default, add plan, add limit kind (frame D6).
- [X] T030 [US4] `app/pages/admin/subscriptions.vue`: tabs Subscriptions (filters state/plan/source/person, move end, end early) and Requests (search, state, Mark paid, Reject) (frame D7).
- [X] T031 [US4] `app/pages/admin/payments.vue`: date range, count and total for the range, Load more (frame D7).
- [X] T032 [US4] e2e `tests/e2e/admin-money.spec.ts`: price change seen in Plan & usage, limit set/default, fulfil a request → subscription + payment, filters, end early, payment total for a range.

## Phase 7: User Story 5 — AI usage, calls, ledger (P2)

- [X] T033 [P] [US5] `app/pages/admin/ai/usage.vue`: period, grouping tabs, totals, day chart, person groups linking to the detail (frame D8).
- [X] T034 [P] [US5] `app/pages/admin/ai/calls.vue`: filters, Failures shortcut, failure reason (frame D8).
- [X] T035 [P] [US5] `app/pages/admin/ai/ledger.vue`: filters, creating admin, Grant credits via `PersonPicker` + `CreditsDialog` (frame D8).
- [X] T036 [US5] e2e `tests/e2e/admin-ai.spec.ts`: groupings against the seed, failures filter, ledger filter, grant from the ledger.

## Phase 8: User Story 6 — Joining mode, keys, flags, sign-up (P2)

- [X] T037 [US6] `app/pages/admin/settings.vue` with `AiKeyRow.vue` (password field cleared after save, Replace, Remove, source/last4/updated) and `FlagRow.vue` (add, switch, remove); sign-up mode switch with confirm (frame D10).
- [X] T038 [US6] `app/composables/usePublicSettings.ts`; `app/pages/signup.vue` (auth layout; form while open, invite-only message + waitlist link otherwise; email-taken on the field; `signup_closed` on submit shows the message) (frame D11).
- [X] T039 [US6] Landing join section swaps the waitlist form for a Create account button while open; sign-in page links to `/signup` only while open.
- [X] T040 [US6] e2e `tests/e2e/admin-settings.spec.ts` + `tests/e2e/signup.spec.ts`: mode switch, sign up while open lands in the studio, closed message, landing swap both ways, key saved never shown (search the page text and storage for the key, SC-004), remove key, flags.

## Phase 9: User Story 8 — Suspended and closed, everywhere (P2)

- [X] T041 [US8] Sign-in, reset-password and invite pages show the suspended copy (with the support email when set) for `account_suspended`; the sign-in page also shows it for `?suspended=1` (frame D11).
- [X] T042 [US8] e2e `tests/e2e/suspended.spec.ts` and unit cases in `tests/unit/signup.test.ts` (error mapping, guard redirect).

## Phase 10: User Story 7 — Audit log (P3)

- [X] T043 [US7] `app/pages/admin/audit.vue` with `AuditDiff.vue`: filters (admin, action from the cached list grouped by target, person, date range), Details before/after, deleted-admin label; the detail's recent-activity panel reuses it with `targetId` (frame D9).
- [X] T044 [US7] e2e `tests/e2e/admin-audit.spec.ts`: three actions found, filters, details, link from the user detail.

## Phase 11: Polish

- [X] T045 [P] Keyboard-only e2e `tests/e2e/admin-keyboard.spec.ts`: rail, search, users → detail → suspend dialog (focus trap, Esc) → settings key form (SC-006).
- [X] T046 [P] Layout check at 1024, 1280 and 1440 px in Arabic and English for every console page (SC-005); fix overflow; narrow rail and drawer (frame D14).
- [X] T047 [P] Bundle check: studio entry chunk grows ≤ 2 KB; console pages in their own chunks. *(Pages are separate chunks. After review: the mock is loaded only in mock mode and the admin strings are a separate lazy file; the entry is 57.3 KB gzip against 72.8 KB on main. See G-D10.)*
- [X] T048 Mark `specs/002-admin-pages/` as replaced (README pointing here); update `README.md` admin section; record final deviations in gaps.md.
- [X] T049 Full run: `npx vitest run`, `npx nuxi typecheck`, `$env:E2E_PORT='3150'; $env:NUXT_PUBLIC_SERVICES_MODE='mock'; npx playwright test` all green; quickstart walked through in the mock.
- [X] T050 Open a PR → `main` (not merged); leave a hand-over note in the shared notes folder.

## Dependencies

- T001 before every screen task (T016, T019, T022–T024, T026, T029–T031, T033–T035, T037–T038, T041, T043).
- T002 before T003 onward. Phase 2 before every story. T017 before story pages. T023 before T024.
- Stories after Phase 2 are independent, except: US2 detail's audit panel reuses T043's component (ship it with a simple list first, swap in T043); US3 depends on T016 only; US8 depends on T010/T011.
- Polish after all stories.

## Parallel opportunities

- T003, T004 together. T012, T013, T014 together after T011. US5 pages T033–T035 together. Polish T045–T047 together.

## MVP

Phases 1–5 (frame, dashboard, users with actions, waitlist and invitations moved): the console replaces the release-1 admin pages and handles support work. US4–US8 add money, AI, settings, suspended handling and the audit page.
