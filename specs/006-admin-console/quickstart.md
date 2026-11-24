# Quickstart: Admin console (web)

## Mock (no backend)

```powershell
$env:NUXT_PUBLIC_SERVICES_MODE='mock'; npx nuxt dev --port 3150
```

Sign in as the seeded admin `admin@example.com` (password in `services/mock/seed.ts`), or on `/__mock` press **Sign in as admin**. The top bar badge says **Demo data**.

1. **Dashboard** (`/admin`): check the figures against `/__mock` → *Admin seed summary*; switch to 7 days (`?days=7`). Attention links open Subscriptions → Requests (pending) and Waitlist (not invited).
2. **Users**: type `example.com` in the top-bar search → Users list → filter Pro, then Suspended → **Load more**. Open a person: every panel shows.
3. **Actions**: on a non-admin person, suspend (reason, type the email), unsuspend, send reset (toast names the email; `/__mock` outbox shows the mail), change plan to Pro yearly, grant 50 credits, set an override on `scripts.max_active`, schedule deletion (type the email), cancel it. Open your own detail: the self actions are disabled with the reason. Audit log lists each action once.
4. **Waitlist and invitations**: `/app/admin` forwards to `/admin/waitlist`. Filter *Not invited*, invite a row, remove another; resend and withdraw an invitation.
5. **Money**: Plans & quotas → change Pro monthly price → open the studio's Plan & usage in another tab and see it. Subscriptions → Requests → **Mark paid** on a pending one → it is listed under Payments with the total for the range.
6. **AI**: Usage by provider, capability, day, person; Calls → **Failures**; Credit ledger → filter by a person and *grant*; **Grant credits** from the ledger.
7. **Settings**: switch sign-up to **Open** (confirm) → sign out → the landing shows **Create account** → `/signup` creates an account and opens the studio. Back to **Invite only**: `/signup` shows the invite-only message. Store an Anthropic key → the field clears, the row shows `…last4`; remove it. Add flag `studio.new_editor`, switch it off, remove it.
8. **Suspended**: `/__mock` → *Suspend current person* while signed in as the seeded person in another tab; act in the studio → sign-in page with the suspended message. Sign in again → the same message.

`/__mock` admin knobs: *Sign in as admin*, *Sign-up mode*, *Suspend current person*, *Admin lists fail*, *Empty dashboard*.

## Against the backend

Run backend branch `005-admin-console` (or `main` once merged) with the seeded admin (backend `specs/005-admin-console/quickstart.md`), then:

```powershell
$env:NUXT_PUBLIC_SERVICES_MODE='http'; $env:NUXT_PUBLIC_ENVIRONMENT='local'; npx nuxt dev --port 3150
```

Optional: `NUXT_PUBLIC_SUPPORT_EMAIL` for the suspended message.

## Tests

```powershell
npx vitest run
```

```powershell
npx nuxi typecheck
```

```powershell
$env:E2E_PORT='3150'; $env:NUXT_PUBLIC_SERVICES_MODE='mock'; npx playwright test
```

Never run `nuxt dev` and `nuxt generate` at the same time in this folder.
