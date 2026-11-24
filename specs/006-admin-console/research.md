# Research: Web app — Admin console

Decisions for [plan.md](./plan.md). Backend source of truth: `backend/specs/005-admin-console/contracts/openapi.yaml` (PR AhmedEaswy/tilw-backend#4).

## R1. Where the console lives: `/admin`, its own layout, client-only

- **Decision**: Pages under `app/pages/admin/**` with `definePageMeta({ layout: 'admin', middleware: 'admin' })`. Add `'/admin/**': { ssr: false }` to `routeRules`, like `/app/**`. `app/pages/app/admin/index.vue` and `invitations.vue` become one-line redirects (`navigateTo('/admin/waitlist' | '/admin/invitations', { replace: true })`), so old links work (FR-003).
- **Rationale**: The release-2 plan asks for `/admin` with its own layout. Client-only rendering matches the studio: the console needs the session and never needs SEO.
- **Alternatives**: Keep `/app/admin/**` with a layout switch. Rejected: the studio's global auth middleware and rail assumptions are tied to `/app`, and the plan names `/admin`.

## R2. Auth guard

- **Decision**: Reuse `middleware/admin.ts`, extended: signed out → `/signin?next=<path>`; signed in non-admin → `/app/scripts`. The global `auth.global.ts` currently only guards `/app/**`, so `/admin/**` is added to its protected prefixes. The services plugin's `onUnauthenticated` redirect also applies on `/admin` paths (today it returns early unless the path starts with `/app`).
- **Rationale**: One rule for both areas. The backend answers `not_found` for non-admins, so the UI never has to explain admin status (spec clarification).

## R3. One `AdminPort`, extended (not a second port)

- **Decision**: Extend the existing `AdminPort` with every 005 route the console uses (see [contracts/ports.md](./contracts/ports.md)). Keep the five existing methods' names and shapes; `waitlist()` gains optional filters. Add a small `SettingsPort.public()` (no sign-in) for the sign-up mode and flags, and `AuthPort.signUp()` for `/signup`.
- **Rationale**: Constitution III. The admin area is one bounded context; one port keeps the mock and HTTP adapters symmetrical and the contract test simple.
- **Alternatives**: Split into `AdminUsersPort`, `AdminMoneyPort`… Rejected: more wiring in the services plugin and the guard, no benefit at this size.

## R4. Paging: one `Page<T>` shape for the UI

- **Decision**: Every paged port method returns `Page<T> = { items: T[]; nextCursor: string | null }` (plus extra totals where the API has them, e.g. payments). The HTTP adapter maps:
  - `GET /api/admin/users`: JSON array body + `X-Next-Cursor` header (absent → null). The HTTP client gains a `raw` option to read headers.
  - The other lists: `{subscriptions|payments|calls|entries, nextCursor}` → `items`.
  - Audit log: integer cursor, sent back as a number.
- A shared `usePagedList(fetcher, filters)` composable holds rows, `loading`, `error`, `hasMore`, `loadMore()`, `reset()`; it restarts on filter change and drops answers from an older filter (sequence number), so fast typing can't show stale rows.
- **Rationale**: The spec says paging is a transport detail (clarification); one composable gives every table the same Load more behaviour (FR-005).

## R5. Filters in the address

- **Decision**: Each list page reads its filters from `route.query` and writes them back with `router.replace` (debounced 250 ms for text). Times in query strings use `Z` (backend note: `+00:00` must be URL-encoded).
- **Rationale**: FR-006: reload and shared links restore the view.

## R6. Environment badge

- **Decision**: New public runtime config `environment` (`NUXT_PUBLIC_ENVIRONMENT`: `local` default, `staging`, `production`). In mock mode the badge reads **Demo data** whatever the environment. Production uses the danger tone; staging the warning tone; local and demo the quiet tone.
- **Rationale**: Build-time value, no API call (spec clarification).

## R7. Support email for the suspended message

- **Decision**: New public runtime config `supportEmail` (`NUXT_PUBLIC_SUPPORT_EMAIL`, empty by default). Two copy keys: with and without the address (owner decision).

## R8. Dense tables from existing tokens

- **Decision**: Extend `assets/css/admin-table.css` (already shared by the two release-1 admin pages) with a `.tbl--dense` variant: 36 px rows, `--tilw-type-meta` body, `--tilw-type-label` headers, sticky `thead`, numeric columns `tabular-nums` aligned to the inline end. The admin layout sets a denser spacing scale through local custom properties (`--adm-gap`, `--adm-pad`) derived from existing `--tilw-space-*` tokens; no new colour tokens.
- **Rationale**: Release-2 plan: "built from the existing paper/ink tokens so it reads as Tilw, but denser than the studio". Figma page 10 shows the measures.

## R9. Charts without a library

- **Decision**: A small `AdminBarChart.vue` that draws inline SVG bars from `{label, value}[]` with token colours, an accessible `<table>` fallback (visually hidden) and a `title` per bar. Used for sign-ups per day and AI usage per day.
- **Rationale**: Two simple bar charts don't justify a chart dependency; constitution forbids trackers, and bundle size matters.

## R10. Strong confirmation

- **Decision**: `AdminConfirmDialog.vue` with props `reasonRequired` and `typeToConfirm?: string`. Suspend and schedule deletion pass the person's email: the confirm button stays disabled until the typed text equals it (case-insensitive, trimmed). Others use the plain variant (owner decision).

## R11. Disabled actions with a reason

- **Decision**: A pure function `actionAvailability(detail, me, adminCount?)` in `utils/adminActions.ts` returns for each action `{ enabled, reasonKey }`: own account → "Use your own account settings"; target is admin → "Remove admin first"; already suspended → only Unsuspend shown; deletion scheduled → Cancel deletion shown; make admin disabled when suspended or deletion scheduled. The last-admin rule is left to the service (the console does not know the count without an extra call); its `conflict` message is shown.
- **Rationale**: FR-010; unit-testable.

## R12. Mock adapter: a seeded admin and admin data

- **Decision**: The mock gains a seeded admin (`admin@example.com`, `isAdmin: true`, seed password) and about 40 seeded people across Free/Pro and every status, created over the last 60 days with `lastActiveAt` spread out; subscriptions in each state and source; requests in each state; fulfilled requests are the payments; AI calls and ledger entries come from the 005-AI mock (`services/mock/ai.ts`), plus seeded calls for other people; audit entries are written by every mock admin write (same action names as the backend list). New mock state lives in `services/mock/admin.ts` with its own KV key `tilw:mock:admin:v1`, so the existing state version does not change.
- `/__mock` knobs: "Sign in as admin", "Sign-up mode", "Suspend current person" (to test US8), "Admin lists fail" (network error on admin reads), "Empty dashboard" (zeros).
- **Rationale**: Constitution VI: every story is tested against the mock. The old mock had no admins; e2e tests for waitlist/invitations were skipped in mock mode.

## R13. Suspended handling in the app

- **Decision**: `account_suspended` from `signIn`, `resetPassword` or `acceptInvite` shows the suspended copy on those pages. When any guarded call rejects with `account_suspended` (the backend signs the person out first), the services plugin treats it like `unauthenticated` but navigates to `/signin?suspended=1`, and the sign-in page shows the message.
- **Rationale**: US8. One path, same as session-ended.

## R14. Public settings and the landing swap

- **Decision**: `usePublicSettings()` composable fetches `SettingsPort.public()` once per page load (cached in a `useState`), defaults to `invite_only` on error. The landing's join section and the sign-in page read it client-side; the prerendered HTML shows the waitlist form (invite-only default) and swaps after hydration if open.
- **Rationale**: The landing is prerendered (static hosting); the mode can change without a deploy. Defaulting to invite-only never invites sign-ups that will be refused.

## R15. Top-bar people search

- **Decision**: The search box submits to `/admin/users?q=…`. No live dropdown in this feature.
- **Rationale**: Simple, keyboard-friendly, SC-001 met in two steps.

## R16. Responsiveness

- **Decision**: ≥ 1280 px full rail (240 px); 1024–1279 px icon rail (64 px) with labels as tooltips and `aria-label`; < 1024 px the rail becomes a drawer opened from the top bar. Tables scroll sideways in their card. No phone frames.
- **Rationale**: Desktop-first (spec assumption, edge cases).

## R17. Merge order with PR #5

- **Decision**: Phase 2 starts by merging `origin/main` after PR #5 (AI writing tools) and backend #4 are merged. `PortErrorCode` gets `account_suspended` and `signup_closed` after PR #5's `own_key_refused` and `ai_unavailable`. Ledger and AI-call types reuse PR #5's `CreditEntry`/`CreditKind` where they match.
- **Rationale**: Avoids conflicts in `ports.ts`, `types.ts`, both adapters, the services plugin and the locale files (coordinator instruction).
