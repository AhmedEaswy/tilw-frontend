# Implementation Plan: Web app — Admin console (release 2)

**Branch**: `claude/006-admin-console-cb0ee6` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md); backend feature `backend/specs/005-admin-console` ([openapi.yaml](../../../backend/specs/005-admin-console/contracts/openapi.yaml)), on backend PR AhmedEaswy/tilw-backend#4; Figma frames on page `10 · Release 2 · Admin console`, listed in [gaps.md](./gaps.md). Replaces `specs/002-admin-pages/` (mockups only).

## Summary

The work builds an admin console at `/admin` with its own `admin` layout (side rail, top bar with people search and environment badge, dense tables), and moves the release-1 waitlist and invitations pages into it. The pages are: dashboard, users, user detail with every account action, waitlist, invitations, plans and quotas, subscriptions and requests, payments, AI usage, AI calls, credit ledger, audit log and settings. On the public side it adds `/signup` (only while sign-up is open), the landing's waitlist → Create account swap, and the `account_suspended` / `signup_closed` handling.

Data goes through the existing `AdminPort`, extended to every backend 005 admin route, plus a public `SettingsPort` and `AuthPort.signUp` (constitution III). The mock adapter gets a seeded admin and seeded admin data with `/__mock` knobs; the HTTP adapter follows the 005 contract. Decisions are in [research.md](./research.md); port contract in [contracts/ports.md](./contracts/ports.md).

**Coding waits** until PR #5 (AI writing tools, frontend) and backend #4 are merged: they touch the same core files. Phase 2 starts with `git merge origin/main`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5, Nuxt 4 (unchanged)

**Primary Dependencies**: existing only (`pinia`, `@nuxtjs/i18n`, `@vueuse/core`, `zod`). No chart or table library (research R9, R8).

**Storage**: server state only. Pinia for the admin store and the open person; paged lists are page-local. Mock: new KV key `tilw:mock:admin:v1` beside the existing mock state.

**Testing**:

- Vitest: the admin port contract suite against the mock and the HTTP adapter (fake fetch, including the `X-Next-Cursor` header and the integer audit cursor); `usePagedList` (stale answers dropped, load more, reset); `actionAvailability`; mock refusals and audit entries; money/bytes formatting; signup and suspended error mapping.
- Playwright (desktop project, Arabic and English): one spec per story (`admin-dashboard`, `admin-users`, `admin-joining`, `admin-money`, `admin-ai`, `admin-settings`, `admin-audit`, `suspended`), plus a keyboard-only run over users → detail → action dialog → settings.
- Port 3150 for e2e (`$env:E2E_PORT='3150'`).

**Target Platform**: evergreen desktop browsers, 1024 px and wider designed; narrower stays usable (R16).

**Project Type**: web application (static Nuxt build), frontend repository only.

**Performance Goals**: each console page shows content within 1 s of the API answer; the console code is a separate route chunk, so the studio bundle doesn't grow by more than 2 KB (the guard, the menu entry and the public settings composable).

**Constraints**:

- Never show or keep a secret: the key field is cleared after save and never stored in a store or the address (SC-004).
- Every string in Arabic and English; logical CSS only; rail on the inline-start side.
- Tokens from `assets/css/tokens.css` only; no new colour tokens.

**Scale/Scope**: 13 console pages, 1 public page, ~12 new components, 1 port extension (~45 methods), mock seed of ~40 people.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Arabic-first, bilingual | All copy in `ar.json`/`en.json` under `admin.*`, `signup.*`; logical properties; Figma frames in Arabic RTL and English LTR. | Pass |
| II. Figma is the source | Page `10 · Release 2 · Admin console` drawn before build from `01 · Design system`; deviations go in `gaps.md`. | Pass (frames drawn in phase 1) |
| III. Swappable data port | Everything through `AdminPort`, `SettingsPort`, `AuthPort`; mock + HTTP adapters; shared contract suite. | Pass |
| IV. Recordings never touch Tilw | The console reads take metadata totals only; no take bytes. | Pass |
| V. Calm reading surfaces | No change to rehearse/record pages. | Pass |
| VI. Accessible and testable | Keyboard-only e2e, focus-trapped dialogs, table captions, AA contrast; one e2e per story on the mock. | Pass |
| Tech constraints | No new dependencies; no trackers. | Pass |

Post-design re-check: no violations; no Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-console/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ports.md
├── gaps.md            # Figma node ids, deviations
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── layouts/admin.vue                      # rail, top bar, search, env badge, account menu, drawer < 1024 px
├── middleware/admin.ts                    # extended: signed out → /signin?next, non-admin → library
├── middleware/auth.global.ts              # /admin/** protected like /app/**
├── pages/
│   ├── admin/
│   │   ├── index.vue                      # dashboard
│   │   ├── users/index.vue  users/[id].vue
│   │   ├── waitlist.vue  invitations.vue  # moved from app/admin
│   │   ├── plans.vue
│   │   ├── subscriptions.vue              # tabs: Subscriptions · Requests
│   │   ├── payments.vue
│   │   ├── ai/usage.vue  ai/calls.vue  ai/ledger.vue
│   │   ├── audit.vue
│   │   └── settings.vue
│   ├── app/admin/index.vue  invitations.vue   # redirects only
│   └── signup.vue                          # public, auth layout
├── components/admin/
│   ├── AdminRail.vue  AdminTopBar.vue  EnvBadge.vue
│   ├── AdminTable.vue  LoadMore.vue  FilterBar.vue  StatTile.vue  AdminBarChart.vue  StatusChip.vue
│   ├── AdminConfirmDialog.vue  ChangePlanDialog.vue  CreditsDialog.vue  OverrideDialog.vue
│   ├── PlanEditor.vue  LimitCell.vue  AiKeyRow.vue  FlagRow.vue  AuditDiff.vue  PersonPicker.vue
│   └── InviteDialog.vue (existing)  AdminFrame.vue (removed after the move)
├── composables/usePagedList.ts  useQueryFilters.ts  usePublicSettings.ts
├── stores/admin.ts (extended)  adminUser.ts
├── utils/adminActions.ts  bytes.ts  money.ts (existing)
├── services/
│   ├── ports.ts  types.ts                 # AdminPort extension, SettingsPort, AuthPort.signUp, 2 error codes
│   ├── http/index.ts  http/client.ts       # admin routes; `raw` response option for X-Next-Cursor; 2 codes
│   └── mock/admin.ts  mock/index.ts  mock/seed.ts
├── plugins/services.ts                    # settings port; account_suspended handling; /admin redirect paths
└── assets/css/admin-table.css             # dense variant
i18n/locales/ar.json  en.json              # admin.*, signup.*, errors.accountSuspended, errors.signupClosed
nuxt.config.ts                             # routeRules '/admin/**' ssr:false; public.environment, public.supportEmail
tests/unit/admin-ports.test.ts  admin-paging.test.ts  admin-actions.test.ts  signup.test.ts
tests/e2e/admin-*.spec.ts  suspended.spec.ts  signup.spec.ts
```

**Structure Decision**: same single Nuxt app; the console is a new route group with its own layout, sharing ports, stores, tokens and UI primitives (`UiButton`, `UiBanner`, `UiSkeleton`, `UiEmptyState`, dialogs) with the studio.

## Phases

- **Phase 0** (done): [research.md](./research.md).
- **Phase 1** (done): [data-model.md](./data-model.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md); Figma page 10 and [gaps.md](./gaps.md).
- **Phase 2** (after the merges): [tasks.md](./tasks.md) via `/speckit-implement`.

## Complexity Tracking

None.
