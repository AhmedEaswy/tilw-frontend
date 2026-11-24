# Data model: Web app — Admin console

Shapes the web app holds, as the backend 005 contract sends them ([openapi.yaml](../../../backend/specs/005-admin-console/contracts/openapi.yaml), `components.schemas`). Field lists are not repeated here when they match the contract one for one; only frontend names, mappings and UI state are given. Types go in `app/services/types.ts` under a "Feature 006: admin console" banner.

## Shared

| Type | Notes |
|---|---|
| `Page<T>` | `{ items: T[]; nextCursor: string \| null }`. Payments add `count`, `totalCents`, `currency`. |
| `PersonRef` | `{ id, email \| null, name \| null }` (null = deleted person). |
| `AdminStatus` | `'active' \| 'suspended' \| 'deletion_scheduled'` (contract `Status`). |
| `UserStatusFilter` | `AdminStatus \| 'admin'`. |
| `Period` | `{ from?: string; to?: string }` ISO with `Z`. Default 30 days ending now. |
| `LimitValue` | already in release 2 (`number \| boolean \| string[] \| null`). |
| `PortErrorCode` | adds `account_suspended`, `signup_closed`. |

## Dashboard

`AdminDashboard` = contract `Dashboard` (period, users, signups.byDay, active, storage, ai, revenue, attention). UI state: `days ∈ {7, 30, 90, 365}` from `?days=`.

## People

- `AdminUserRow` = contract `UserRow` (`pendingRequest: PendingRequest | null`).
- `AdminUserDetail` = contract `UserDetail` (suspension, plan{subscription, upcoming, pendingRequest}, limits[], overrides[], storage, credits, sessions{web, devices[]}, scripts, ai{ownKey}).
- `AdminUserFilters` = `{ q?: string; plan?: string; status?: UserStatusFilter }`.
- Actions (all answer `AdminUserDetail`, except reset → `{ sentTo }`, credits → `CreditEntry`, override set → `AdminOverride`, override remove → void):
  - `suspend(id, reason)`, `unsuspend(id)`, `sendPasswordReset(id)`, `changePlan(id, { planId, period? | endsAt?, note })`, `grantAdmin(id)`, `revokeAdmin(id)`, `scheduleDeletion(id, reason)`, `cancelDeletion(id)`, `addCredits(id, { kind: 'grant' | 'correction', amount, endsAt?, reason })`, `setOverride(id, key, { value, endsAt?, note? })`, `removeOverride(id, key)`.
- Availability (`utils/adminActions.ts`): `ActionKey` → `{ enabled: boolean; reasonKey?: string }`; rules in research R11.

State transitions shown on the detail header:

```
active ──suspend──▶ suspended ──unsuspend──▶ active
active/suspended ──scheduleDeletion──▶ deletion_scheduled ──cancelDeletion──▶ (previous: active or suspended)
```
`deletion_scheduled` wins over `suspended` for the status chip; the suspension panel still shows when both apply.

## Joining

- `WaitlistEntry` gains `hasAccount: boolean` (005). Filters `{ q?: string; invited?: boolean }`.
- `Invitation` unchanged.
- `removeWaitlist(id)`.

## Money

- `AdminPlan`, `PlanInput`, `PlanLimitValue`, `LimitDefinition` = contract (002). `createPlan`, `updatePlan`, `setPlanLimit`, `unsetPlanLimit`, `defineLimit`.
- `AdminSubscription` = contract `Subscription`; `AdminSubscriptionRow` adds `user: PersonRef`. Filters `{ state?, plan?, source?, userId? }`. `updateSubscription(id, { endsAt, note? } | { endedReason, endedAt?, note? })`.
- `AdminUpgradeRequest` = contract `AdminSubscriptionRequest`. Filters `{ q?, state? }` (not paged, 200 newest). `fulfilRequest(id, { startsAt?, endsAt?, note? })` → `AdminSubscription`; `rejectRequest(id, note?)`.
- `Payment` = contract. `payments(filters: Period & { userId? }, cursor?)` → `Page<Payment> & { count, totalCents, currency }`.

## AI

- `AiUsage` = `{ from, to, groupBy, totals: UsageFigures, groups: UsageGroup[] }`; `groupBy ∈ provider | capability | day | user`.
- `AdminAiCall` = contract `AiCall`. Filters `{ status?, userId?, provider?, capability? } & Period`.
- `LedgerEntry` = PR #5 `CreditEntry` + `{ month, user: PersonRef, createdBy: PersonRef | null, aiCallId }`. Filters `{ userId?, kind? } & Period`.

## System

- `AdminSettings` = `{ signupMode, aiKeys: AiKeyState[], flags: FeatureFlag[] }`.
- `AiKeyState` = `{ provider: 'anthropic' | 'deepgram', set, source: 'stored' | 'env' | 'none', last4, updatedAt, project? }`.
- `FeatureFlag` = `{ key, enabled, description, updatedAt }`; key pattern `^[a-z][a-z0-9_.-]{0,63}$`, description ≤ 200.
- `PublicSettings` = `{ signupMode: 'invite_only' | 'open', flags: Record<string, boolean> }`.
- Writes: `setSignupMode(mode)`, `setAiKey(provider, { key, project? })`, `removeAiKey(provider)`, `setFlag(key, { enabled, description? })`, `removeFlag(key)`. The key string is passed straight to the port and never stored in a store, a ref after save, or the address.

## Audit

- `AuditEntry` = contract (integer `id`, `adminEmail | null`, `before`/`after` objects).
- `AuditAction` = `{ action, targetType }`, loaded once per session and cached in the admin store for the filter and labels.
- Filters `{ adminId?, action?, targetType?, targetId?, after?, before? }`; cursor is the integer id as a string in the UI and a number on the wire.
- Labels: `admin.audit.action.<action with dots → underscores>` copy keys, with the raw action name as fallback for unknown ones.

## Stores (Pinia)

| Store | Holds | Notes |
|---|---|---|
| `useAdminStore` (existing, extended) | waitlist, invitations (today), audit action list, plan catalogue (for filters), settings | Keeps `load/invite/resend/withdraw`; adds `removeWaitlist`, `loadPlans`, `loadActions`, `loadSettings`. |
| `useAdminUserStore` | the open person's detail, busy action, last error | Every action replaces `detail` with the answer; `not_found` sets `gone = true`. |
| Paged lists | page-local via `usePagedList` | Not in Pinia: each table owns its rows; nothing persists across pages. |

## Mock-only state (`services/mock/admin.ts`, KV `tilw:mock:admin:v1`)

`{ version: 1, signupMode, flags[], aiKeys{anthropic?, deepgram?}, suspensions{userId: {at, reason, byId}}, lastActive{userId: ms}, audit[], nextAuditId }`. People, plans, subscriptions, requests, waitlist and invitations stay in the existing mock state; AI calls and ledger stay in the 005-AI mock state. Seeded once when empty.
