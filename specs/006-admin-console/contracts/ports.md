# Port contract: admin console (feature 006)

TypeScript-level contract between the UI/stores and the adapters (constitution III). The HTTP column maps each method to the backend 005 route ([openapi.yaml](../../../../backend/specs/005-admin-console/contracts/openapi.yaml)). Both adapters must pass the shared contract suite `tests/unit/admin-ports.test.ts`.

Errors: every method rejects with `PortError`. Admin routes answer `not_found` for non-admins, `unauthenticated` when signed out, `conflict` with a message, `validation` with `fields`.

## `AdminPort` (extends the existing one)

| Method | Returns | HTTP |
|---|---|---|
| `waitlist(f?: { q?; invited? })` | `WaitlistEntry[]` | `GET /api/admin/waitlist` |
| `removeWaitlist(id)` | `void` | `DELETE /api/admin/waitlist/{id}` |
| `invitations()` · `invite({email})` · `resend(id)` · `withdraw(id)` | as today | `/api/admin/invitations*` |
| `dashboard(days)` | `AdminDashboard` | `GET /api/admin/dashboard?days=` |
| `users(f, cursor?, limit?)` | `Page<AdminUserRow>` | `GET /api/admin/users` (array + `X-Next-Cursor`) |
| `user(id)` | `AdminUserDetail` | `GET /api/admin/users/{id}` |
| `suspend(id, reason)` · `unsuspend(id)` | `AdminUserDetail` | `POST …/suspend` · `…/unsuspend` |
| `sendPasswordReset(id)` | `{ sentTo }` | `POST …/password-reset` (202) |
| `changePlan(id, input)` | `AdminUserDetail` | `PUT …/plan` |
| `grantAdmin(id)` · `revokeAdmin(id)` | `AdminUserDetail` | `POST` · `DELETE …/admin` |
| `scheduleDeletion(id, reason)` · `cancelDeletion(id)` | `AdminUserDetail` | `DELETE /api/admin/users/{id}` (body) · `POST …/restore` |
| `userCredits(id)` | `Credits` | `GET …/credits` |
| `addCredits(id, input, idempotencyKey?)` | `CreditEntry` | `POST …/credits` with header `Idempotency-Key` (one UUID per form open; a repeat returns the first entry, reuse for a different change is `conflict`) |
| `setOverride(id, key, input)` · `removeOverride(id, key)` | `AdminOverride` · `void` | `PUT` · `DELETE …/overrides/{key}` |
| `userSubscriptions(id)` | `AdminSubscription[]` | `GET …/subscriptions` |
| `grantSubscription(id, input)` | `AdminSubscription` | `POST …/subscriptions` |
| `plans()` · `createPlan(input)` · `updatePlan(id, input)` | `AdminPlan[]` · `AdminPlan` | `/api/admin/plans*` |
| `setPlanLimit(id, key, value)` · `unsetPlanLimit(id, key)` | `PlanLimitValue` · `void` | `PUT` · `DELETE /api/admin/plans/{id}/limits/{key}` |
| `limitDefinitions()` · `defineLimit(input)` | `LimitDefinition[]` · `LimitDefinition` | `/api/admin/limit-definitions` |
| `subscriptions(f, cursor?)` | `Page<AdminSubscriptionRow>` | `GET /api/admin/subscriptions` |
| `updateSubscription(id, patch)` | `AdminSubscription` | `PATCH /api/admin/subscriptions/{id}` |
| `requests(f?)` | `AdminUpgradeRequest[]` | `GET /api/admin/subscription-requests` |
| `fulfilRequest(id, input?)` · `rejectRequest(id, note?)` | `AdminSubscription` · `AdminUpgradeRequest` | `POST …/fulfil` · `…/reject` |
| `payments(f, cursor?)` | `Page<Payment> & { count; totalCents; currency }` | `GET /api/admin/payments` |
| `aiUsage(period, groupBy)` | `AiUsage` | `GET /api/admin/ai/usage` |
| `aiCalls(f, cursor?)` | `Page<AdminAiCall>` | `GET /api/admin/ai/calls` |
| `ledger(f, cursor?)` | `Page<LedgerEntry>` | `GET /api/admin/credits/ledger` |
| `settings()` · `setSignupMode(mode)` | `AdminSettings` | `GET` · `PATCH /api/admin/settings` |
| `setAiKey(provider, {key, project?})` · `removeAiKey(provider)` | `AiKeyState` | `PUT` · `DELETE /api/admin/settings/ai-keys/{provider}` |
| `setFlag(key, {enabled, description?})` · `removeFlag(key)` | `FeatureFlag` · `void` | `PUT` · `DELETE /api/admin/feature-flags/{key}` |
| `auditLog(f, cursor?)` | `Page<AuditEntry>` | `GET /api/admin/audit-log` (integer cursor) |
| `auditActions()` | `AuditAction[]` | `GET /api/admin/audit-log/actions` |

Rules both adapters keep:

- Query parameters are omitted when empty; times are sent with `Z`; booleans as `true`/`false`.
- `limit` defaults to 50; the UI never asks for more than 100.
- `setAiKey` never echoes the key; the mock stores only `last4` and a flag (it never needs the key).
- The mock writes one audit entry per successful write with the backend action names (`user.suspend`, `user.unsuspend`, `user.password_reset`, `user.plan_change`, `user.admin_grant`, `user.admin_revoke`, `user.delete_schedule`, `user.delete_cancel`, `credits.grant`, `credits.correct`, `override.set`, `override.remove`, `subscription.grant`, `subscription.update`, `subscription.end`, `request.fulfil`, `request.reject`, `plan.create`, `plan.update`, `limit.set`, `limit.unset`, `limit.define`, `waitlist.remove`, `invitation.create`, `invitation.resend`, `invitation.withdraw`, `settings.signup_mode`, `settings.ai_key_set`, `settings.ai_key_remove`, `flag.set`, `flag.remove`) and none for a refused one.
- The mock enforces the same refusals as the backend: own account, admin target, last admin, already suspended/not suspended, deletion already scheduled/none scheduled, plan already in force, Free can't be deactivated.

## `SettingsPort` (new, public)

| Method | Returns | HTTP |
|---|---|---|
| `public()` | `PublicSettings` | `GET /api/settings` (no sign-in) |

## `AuthPort` additions

| Method | Returns | HTTP |
|---|---|---|
| `signUp({ name, email, password, locale })` | `User` | `POST /register` (CSRF as `/login`); `signup_closed` 403, `validation` (email taken → `fields.email`), `rate_limited` |

`signIn`, `resetPassword` and `acceptInvite` may now reject with `account_suspended`.

## Services plugin

- `admin` stays wrapped by `guard`; `settings` is not (public).
- `guard` also handles `account_suspended` on `/app` and `/admin` paths: clear the session, go to `/signin?suspended=1`.
