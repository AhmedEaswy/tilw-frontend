# Gaps and Figma frames: Admin console (web)

Figma file `t9xEIr22yKOj7o2Ft32hxb`, page **`10 · Release 2 · Admin console`** (`306:100`), drawn 2026-11-24 from page `01 · Design system` (Tilw / Studio colour variables, Tilw / Dimensions, IBM Plex Sans Arabic, the `Action`, `Glyph`, `Field`, `Switch` and signature components). Desktop first (1440 wide), Arabic RTL, with English LTR for the shell, dashboard and user detail. Frames are grouped in labelled rows on the page.

## Local components (page 10)

New admin-only components, all bound to the Studio variables (no raw colours). Holder frame `306:101`.

| Component | Node | Variants / properties |
|---|---|---|
| Admin / Rail item | `306:122` | Dir = AR / EN × State = Default / Active; `Label` |
| Admin / Chip | `306:138` | Tone = neutral / success / warning / error / info; `Label` |
| Admin / Button sm (36 px) | `306:147` | Tone = primary / secondary / danger / ghost; `Label` |
| Admin / Stat tile | `306:156` | Dir = AR / EN; `Label`, `Value`, `Note` |
| Admin / Input sm (36 px, search glyph) | `306:169` | Dir = AR / EN; `Placeholder` |

## Frames

| Row | Frame | Node | Spec | Tasks |
|---|---|---|---|---|
| D1 | Dashboard · AR (shell: rail, top bar with search and **Production** badge, period control, attention strip, people, sign-ups chart, revenue, AI, storage) | `308:404` | US1 | T016, T019 |
| D2 | Users list · AR (search, plan and status filters, dense table, load more) | `309:659` | US2 | T022 |
| D3 | User detail · AR (header chips and actions; plan and subscription history, effective limits with override, recent admin activity; side: credits, storage, sessions and devices, scripts, AI this month) | `309:1100` | US2 | T023 |
| D4 | User action dialogs · AR: suspend (reason + type the email, matched), schedule deletion (email not matched → button disabled), change plan, grant/correct credits, override, and the disabled-action reasons (own account, admin target, last-admin refusal) | `310:674` | US2 | T024 |
| D5 | Waitlist · AR (search, All / Not invited / Invited, has-account chip, invite, remove) | `310:974` | US3 | T026 |
| D5 | Invitations · AR (states, resend, withdraw, invite in header) | `310:1219` | US3 | T026 |
| D6 | Plans & quotas · AR (Free/Pro cards: names, prices in USD, active switch disabled on Free; limit matrix with set/default and a focused cell) | `311:1131` | US4 | T029 |
| D7 | Subscriptions · AR (tab, filters state/plan/source/person, edit end, end early) | `311:1459` | US4 | T030 |
| D7 | Upgrade requests · AR (tab, search, state, Mark paid / Reject, confirm-payment dialog) | `311:1800` | US4 | T030 |
| D7 | Payments · AR (date range, count/total/average for the range, deleted person row) | `311:2092` | US4 | T031 |
| D8 | AI usage · AR (period, totals, group tabs, provider table, per-day chart, top people) | `312:1564` | US5 | T033 |
| D8 | AI calls · failures · AR (All / Failed, provider, capability, person, reason codes) | `312:1878` | US5 | T034 |
| D8 | Credit ledger · AR (filters, kinds, by-admin column, grant dialog with person picker) | `312:2183` | US5 | T035 |
| D9 | Audit log · AR (filters, expanded before/after details, deleted admin, action filter menu grouped by target) | `313:1849` | US7 | T043 |
| D10 | Settings · AR (sign-up mode with confirm dialog, platform keys stored/env with replace form, feature flags with add row) | `313:2122` | US6 | T037 |
| D11 | Sign up (open) · AR, with email-taken error | `314:100` | US6 | T038 |
| D11 | Sign up (invite only) · AR | `314:132` | US6 | T038 |
| D11 | Sign in · account suspended · AR (banner with support email) | `314:157` | US8 | T041 |
| D11 | Landing join section · open vs invite-only · AR | `317:2418` | US6 | T039 |
| D12 | Dashboard · EN (LTR shell, **Staging** badge) | `316:2114` | US1, FR-023 | T019 |
| D13 | User detail · EN | `316:2555` | US2, FR-023 | T023 |
| D14 | Narrow 1024 · icon rail with tooltip · AR | `317:2221` | Edge cases, R16 | T016, T046 |
| D14 | Narrow 900 · drawer open · AR | `317:2318` | Edge cases, R16 | T016, T046 |

Not drawn (trivial states reusing existing parts, constitution II): loading skeletons, empty tables, load errors with Retry, toasts, the Demo-data badge on every frame (it is shown on D2–D11), the English versions of the remaining pages (same layout mirrored, copy from the locale files).

## Gaps and decisions

| # | Gap | Proposed resolution | Status |
|---|---|---|---|
| G-D1 | The design-system `Glyph` set has no icons for people, chart, coins/credits, payments, audit. The rail uses stand-ins (privacy, expand, sun, pin, check, keyboard, archive, edit). | Add `users`, `chart`, `coins`, `receipt`, `history` glyphs to `UiGlyph` and the Figma `Glyph` set during T016; until then use the stand-ins. | Open (design) |
| G-D2 | The studio's `Action` (48 px) is too tall for dense tables and toolbars. | New local `Admin / Button sm` (36 px) and `Admin / Input sm`; the studio keeps its 44 px minimum targets, the console uses 36 px controls with ≥ 24 px hit areas (WCAG 2.2 AA 2.5.8). | Decided |
| G-D3 | `--tilw-surface-white` resolves to ivory, so cards on paper have low contrast. | Cards keep the `border/subtle` 1 px line; tables use `surface/quiet` headers. No new token. | Decided |
| G-D4 | Mixed Arabic/Latin values (plan names, emails, references) reorder in RTL text runs. | Wrap Latin values (emails, references, keys, numbers with units) in `<bdi>` / `dir="ltr"` spans; code blocks (audit before/after JSON) are always `dir="ltr"`. | Decided |
| G-D5 | Digits: the frames use Latin digits in Arabic. | Keep Latin digits (`Intl.NumberFormat('ar-u-nu-latn')`), as the studio does. | Decided |
| G-D6 | The period control is drawn with 4 fixed periods; the AI usage and payments pages use a from/to range. | Dashboard: 7/30/90/365 (backend `days`); AI usage, calls, ledger, payments, audit: from/to pickers (default last 30 days). | Decided |
| G-D7 | Landing join section (D11) is drawn as a simple card pair, not the exact landing artwork (`app/landing/join.js`). | Implement the swap inside the existing landing section's markup and styles; the frame only fixes copy and states. | Decided |
| G-D8 | D4 shows the "last admin" refusal as a service message only (the console doesn't know the admin count). | As research R11: no extra call; show the service's `conflict` message. | Decided |
| G-D9 | Backend PR #4 changed in review (merged `dad3062`): `account_suspended` can come from any signed-in route (the session is already ended); `UserDetail.deletionBy` (an admin's deletion can't be cancelled by signing in); `Idempotency-Key` header on `POST …/credits` (repeat → 200 with the first entry, reuse for another change → `conflict`). | Handled in T010/T011 (guard treats `account_suspended` as signed out on every port), T023 (detail says "scheduled by an admin, signing in won't cancel it"), T024/T035 (credits form makes one key per open). | Resolved (T002) |
| G-D10 | The studio's entry chunk grew about 25 KB gzip, over the plan's 2 KB target. Causes: the services plugin imported the mock statically, and the admin strings sat in the studio locale files. | Fixed after review: the plugin imports the mock (`await import`) only in mock mode, and the admin strings moved to `i18n/admin/{ar,en}.json`, which the admin middleware loads before an admin page renders (both languages, merged again after a language switch). Measured on `nuxt generate`: the entry chunk is 57.3 KB gzip (162.7 KB raw) here, against 72.8 KB gzip (208.1 KB raw) on `origin/main` (855f2e8). That is 15.5 KB smaller than before this feature, because no mock code ships in the entry any more. | Resolved |
| G-D11 | The landing's join section is Arabic-only static markup, like the rest of the landing. | The Create account swap is Arabic too, matching it. | Decided |
