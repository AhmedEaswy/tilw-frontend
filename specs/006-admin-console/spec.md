# Feature Specification: Web app — Admin console (release 2)

**Feature Branch**: `claude/006-admin-console-cb0ee6` (the backend feature is `005-admin-console`; frontend specs are numbered on their own)

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Frontend feature 006-admin-console: the web admin console for backend feature 005. Pages under /admin with their own `admin` layout (fixed side rail, top bar with search and environment badge, dense data tables, paper/ink tokens): dashboard, users (search, filter by plan/status), user detail with actions (suspend, reset password, change plan, grant credits, make admin, delete/cancel deletion, overrides), waitlist, invitations, plans and quotas, subscriptions and upgrade requests and payments, AI usage (per provider/capability/day/user, failures), credit ledger and grants, audit log, system settings (signup mode, platform AI keys, feature flags). Replaces specs/002-admin-pages and folds in the existing /app/admin waitlist and invitations pages. Also the public sign-up page when signupMode is open, and the account_suspended / signup_closed errors."

## Context

This is the screen side of backend feature `005-admin-console`. Every rule about who may do what, what each figure counts and what each action does is defined there ([spec](../../../backend/specs/005-admin-console/spec.md), [HTTP contract](../../../backend/specs/005-admin-console/contracts/openapi.yaml); read with `git -C ../backend show origin/005-admin-console:specs/005-admin-console/<file>` until it merges, then `origin/main`). This spec says what admins see and do in the web app, and keeps the two adapters (in-browser mock and real service) in step.

**Replaces `specs/002-admin-pages/`.** That folder only holds the release-1 mockups for two admin pages (waitlist, invitations) inside the studio layout. Those two pages were built under `/app/admin` and `/app/admin/invitations` with the studio's `app` layout. This feature moves them into the new console (`/admin/waitlist`, `/admin/invitations`), keeps what they already do, and adds the rest. The old addresses forward to the new ones. The mockups stay in the repository as history; they are no longer a design source.

**What exists today (inventory, 2026-11-24)**: `AdminPort` (waitlist, invitations, invite, resend, withdraw), `useAdminStore`, the `admin` route middleware (non-admins go to the library), `AdminFrame` and `InviteDialog` components, the two pages, the "Admin" item in the studio rail for admins, and the shared `admin-table.css`. Plans and quotas, and subscriptions and requests, have backend routes since 002 but no web pages yet: they are built here.

**Design source**: Figma has no frames for the console. Under constitution principle II they are drawn on a new page `10 · Release 2 · Admin console` from the design-system page, desktop first (the console is a desktop tool), Arabic RTL then English LTR, before the screens are built. Each frame is listed in `gaps.md`.

**Privacy and secrets**: the console never shows a password, token, own AI key or storage token; the service never sends them. Platform AI keys are typed once and never shown again (only "set", where it comes from, the last four characters and when it changed). The console keeps no admin data in the browser beyond the current page's memory.

## Clarifications

### Session 2026-11-24

Answered from the backend 005 contract, the release-2 plan and the existing app patterns:

- Q: Where does the console live? → A: At `/admin` (not under `/app`), with its own `admin` layout. Only admins can open it. Anyone else who opens an `/admin` address goes to the library (signed in) or the sign-in page (signed out), as today. The studio's account menu and rail keep an "Admin console" item for admins.
- Q: What happens to the old `/app/admin` addresses? → A: They forward to `/admin/waitlist` and `/admin/invitations`, so old links and bookmarks keep working.
- Q: Are there admin roles? → A: No. All admins are equal (backend 005). Every admin sees every page and action.
- Q: How does the console handle the people list being an array with the next page in a header? → A: That is a transport detail; the console shows "Load more" on every long list, the same way for all of them.
- Q: What is the environment badge? → A: A small label in the top bar naming where the console is connected: **Local**, **Staging** or **Production**, set at build time, plus **Demo data** when the in-browser mock is in use. Production uses the strongest tone, so an admin always knows when a change is real.
- Q: What does a non-admin see if the service answers "not found" for an admin route? → A: The same as any not-found address. The console never says "you are not an admin".

Owner decisions (2026-11-24):

- Q: When sign-up is Open, what does the landing page do with its "Join the waitlist" form? → A: It swaps to a **Create account** button that opens `/signup`; the waitlist form comes back when the mode is Invite only.
- Q: What contact does the suspended message give? → A: A support email, set at build time like the sales WhatsApp number: "This account is suspended. Contact support at <email>." With no address configured, the sentence ends at "suspended".
- Q: How strong is the confirmation for the strongest actions? → A: Scheduling deletion and suspending need the person's email typed to enable the button (plus the reason). Every other action that signs someone out or removes access uses a normal confirm dialog.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the console and see how Tilw is doing (Priority: P1)

An admin opens **Admin console** from the studio account menu. The console opens on its dashboard, in its own frame: a fixed side rail with the sections (Overview; People: Users, Waitlist, Invitations; Money: Plans & quotas, Subscriptions, Payments; AI: Usage, Calls, Credit ledger; System: Audit log, Settings) and a top bar with a search box, the environment badge, a link back to the studio and the admin's own menu. The dashboard shows, for the last 30 days (they can pick 7, 30, 90 or 365): sign-ups with a day-by-day bar chart, people active in the last day, week and month, totals of people (admins, suspended, deletion scheduled), storage (linked drives, takes, bytes, bytes in the period), AI (credits used in the period and this month, calls, failed calls, own-key calls), revenue (MRR, paying subscriptions, payments in the period and their total), and an **attention** strip (pending upgrade requests, waitlist not invited) whose items link to the pages that handle them.

**Why this priority**: It is the console's front door and the frame every other page sits in.

**Independent Test**: In the mock, sign in as the seeded admin, open `/admin`, check every figure against the seeded data for 30 days, switch to 7 days and check again; open the attention links. Sign in as a non-admin and open `/admin`: the library opens.

**Acceptance Scenarios**:

1. **Given** a signed-in admin, **When** they open `/admin`, **Then** the dashboard opens in the admin layout with the rail, the top bar and the environment badge.
2. **Given** the dashboard, **When** the admin picks another period, **Then** every period figure and the chart reload for that period; the choice shows in the address so it can be shared or reloaded.
3. **Given** a period with no data, **When** the dashboard loads, **Then** every figure shows 0 and the chart shows empty days, never a blank or an error.
4. **Given** attention items, **When** the admin clicks "pending upgrade requests" or "waitlist not invited", **Then** the matching page opens with the matching filter.
5. **Given** a signed-in non-admin (or a signed-out visitor), **When** they open any `/admin` address, **Then** they go to the library (or the sign-in page, then back only if they are an admin).
6. **Given** the old `/app/admin` or `/app/admin/invitations` address, **When** an admin opens it, **Then** the matching console page opens.

---

### User Story 2 - Find a person and act on their account (Priority: P1)

The admin types an email or name in the top-bar search (or on the Users page) and gets the people list: newest first, 50 at a time with **Load more**, one dense row each (name, email, plan, status, admin mark, signed up, last active, pending request). They filter by plan (from the plan catalogue) and status (active, suspended, deletion scheduled, admin). They open a person: a header with name, email, status and the actions; then panels for plan and subscription (in force, scheduled, pending request), effective limits with usage and overrides, credits, storage, sessions and devices, scripts, this month's AI use, and that person's recent audit entries.

From the header they can: suspend (reason required) or unsuspend; send a password reset; change the plan (plan, monthly / yearly / custom end date, note); grant credits or correct the month (amount, optional end, reason); make or stop making them an admin; schedule deletion (reason required) or cancel it. From the limits panel they set or remove an override. Each action that signs the person out or removes access asks for confirmation and says what will happen. Actions that the service will refuse (their own account, an admin target, the last admin) are shown disabled with the reason, and if the service still refuses, its message is shown.

**Why this priority**: Support work happens here ("I can't sign in", "I paid, give me Pro", "this account is abusing the AI").

**Independent Test**: In the mock, filter people by each plan and status; open a person; run every action and check the detail updates, the toast, and an audit entry appears; check the refusals for self, another admin and the last admin.

**Acceptance Scenarios**:

1. **Given** many people, **When** the admin opens Users, **Then** the first 50 show newest first; **Load more** adds the next page until there are no more.
2. **Given** a search or filters, **When** the admin changes them, **Then** the list restarts from the first page with those filters, and the filters show in the address.
3. **Given** a person, **When** the admin opens them, **Then** every panel listed above shows, and nothing secret appears.
4. **Given** an active person, **When** the admin suspends them with a reason and types their email to confirm, **Then** the status becomes Suspended with who, when and why, and the toast says the person was signed out everywhere.
5. **Given** a person, **When** the admin sends a password reset and confirms, **Then** the toast names the email it went to and says the person was signed out everywhere.
6. **Given** a person on Free, **When** the admin changes the plan to Pro yearly with a note, **Then** the plan panel shows Pro in force from now; choosing the plan already in force is not offered.
7. **Given** a person, **When** the admin grants 50 credits with a reason, **Then** the credits panel shows the new balance and the entry.
8. **Given** a person, **When** the admin makes them an admin, **Then** the admin mark shows; stopping it is refused for the admin themself and for the last admin.
9. **Given** a person, **When** the admin schedules deletion with a reason and types their email to confirm, **Then** the status becomes Deletion scheduled with the date; **Cancel deletion** restores it.
10. **Given** a limit, **When** the admin sets an override with an end date and note, **Then** the limit shows the override value and "overridden"; removing it shows the plan value again.
11. **Given** the admin's own detail page, **When** it opens, **Then** suspend, reset, delete and stop-admin are disabled with "Use your own account settings".

---

### User Story 3 - Waitlist and invitations, inside the console (Priority: P1)

The two existing admin pages move into the console unchanged in what they do, with the new filters: the waitlist can be searched and filtered (all / not invited / invited), each row shows whether the email already has an account, a pending invite action, and a **Remove** action (with confirmation). Invitations keep invite, resend and withdraw, plus an **Invite** button in the page header.

**Why this priority**: It is how people join today; moving it is required so there is one admin area, not two.

**Independent Test**: In the mock, filter the waitlist, invite from a row, remove an entry, resend and withdraw an invitation; open the old addresses and land on the new pages.

**Acceptance Scenarios**:

1. **Given** the waitlist, **When** the admin types part of an email or picks "Not invited", **Then** the list narrows.
2. **Given** a waitlist entry with no invitation and no account, **When** the admin presses Invite, **Then** an invitation is sent and the row shows "Invited".
3. **Given** an entry that already has an account, **When** the list shows, **Then** the row says "Has an account" and offers no invite.
4. **Given** an entry, **When** the admin removes it and confirms, **Then** it disappears.
5. **Given** a pending invitation, **When** the admin resends or withdraws it, **Then** the row updates as today.

---

### User Story 4 - Plans, quotas, subscriptions and payments (Priority: P2)

The admin edits the plan catalogue: each plan's names (Arabic, English), monthly and yearly prices in US dollars, active flag and order; each plan's value for each limit kind (a number or "unlimited", on/off, or a list), or back to the default; and adds a new plan or a new limit kind. They work the upgrade requests (pending first; search by reference or email; **Mark paid** with optional start, end and note; **Reject** with a note). They see every subscription (filter by state, plan, source, person; move the end; end early with a reason) and every payment for a date range with the count and total for the whole range.

**Why this priority**: Revenue and the plans promise "limits are data, not code"; today an admin needs a database client for this.

**Independent Test**: In the mock, change Pro's monthly price and a limit and see it in Plan & usage; fulfil a pending request and see the subscription and the payment; filter subscriptions by each state; set a date range on payments and check the total.

**Acceptance Scenarios**:

1. **Given** the plan catalogue, **When** the admin changes a price or name and saves, **Then** the plan shows the new value; the Free plan cannot be deactivated (the control is disabled with the reason).
2. **Given** a limit cell, **When** the admin sets "unlimited", a number, on/off or a list, or resets to default, **Then** the cell shows the new value and whether it is set or default.
3. **Given** a pending request, **When** the admin marks it paid, **Then** the request shows Fulfilled, a subscription exists for the person, and it is listed under Payments.
4. **Given** subscriptions, **When** the admin filters by state, plan or source, **Then** the list shows only matches, 50 at a time with Load more.
5. **Given** a date range, **When** the admin lists payments, **Then** the page shows the count and total for the whole range, not just the rows loaded.
6. **Given** an active subscription, **When** the admin ends it early with a reason, **Then** it shows Ended with the reason.

---

### User Story 5 - AI usage, failures and the credit ledger (Priority: P2)

The admin opens AI **Usage** for a period (default the last 30 days) and switches the grouping: by provider, by capability, by day (a chart and a table) or by person (top 100 by credits, each linking to the person). Totals for the period sit above. **Calls** lists AI calls newest first and filters by status (a "Failures" shortcut), person, provider and capability, showing the failure reason. **Credit ledger** lists every credit entry across everyone, filters by person, kind and period, and shows the admin who made each grant or correction; a **Grant credits** button asks for a person (search by email) and opens the same grant form as the user detail.

**Why this priority**: AI calls cost real money; failures need to be seen before people complain.

**Independent Test**: In the mock, check the grouped totals for each grouping against seeded calls; filter calls to failures; filter the ledger by person and kind; grant credits from the ledger and see the entry at the top.

**Acceptance Scenarios**:

1. **Given** AI calls in the period, **When** the admin groups by provider, capability, day or person, **Then** each group shows calls, succeeded, failed, credits, words, seconds and own-key calls; by day every day of the period shows, zeros included.
2. **Given** failed calls, **When** the admin picks Failures, **Then** only failed calls show, each with person, capability, provider, reason and time.
3. **Given** the ledger, **When** the admin filters by a person and "grant", **Then** only that person's grants show, each with the granting admin.
4. **Given** the ledger, **When** the admin grants credits to a found person, **Then** the new entry shows at the top.

---

### User Story 6 - Who can join, platform keys and feature flags (Priority: P2)

On **Settings**, the admin switches sign-up between **Invite only** and **Open** (with a confirmation that says what changes). They set the platform AI keys (Anthropic; Deepgram with its project id): each shows set / not set, the source (stored, environment, none), the last four characters and when it changed; **Replace** asks for a new key in a password-style field that is cleared after saving; **Remove** falls back to the environment value. They add, switch and remove feature flags (key, on/off, description).

When sign-up is **Open**, the public site offers a **Create account** page (`/signup`: name, email, password, with the release-1 password rules). It creates the account, signs the person in and opens the studio. While **Invite only**, `/signup` explains that Tilw is invite-only for now and points to the waitlist. The sign-in page links to sign-up only while it is open, and the landing page's waitlist form becomes a **Create account** button.

**Why this priority**: It is how release 2 opens to the public; the console can ship with invite-only first.

**Independent Test**: In the mock, switch to Open, sign out, create an account at `/signup` and land in the studio; switch back to Invite only and see `/signup` refuse. Store a key and check the page never shows it again; set and remove a flag.

**Acceptance Scenarios**:

1. **Given** Invite only, **When** someone opens `/signup`, **Then** they see the invite-only message with a link to the waitlist and no form.
2. **Given** Open, **When** someone signs up with a new email and a valid password, **Then** they are signed in and the studio opens; an email that already has an account shows an error on the email field.
3. **Given** the mode changed to Invite only while the form is open, **When** they submit, **Then** they see the invite-only message (`signup_closed`).
4. **Given** a key form, **When** the admin saves a key, **Then** the field clears, the row shows "Stored · …abcd · just now", and the key is not visible anywhere on the page.
5. **Given** a stored key, **When** the admin removes it and confirms, **Then** the row shows the environment source (or Not set).
6. **Given** flags, **When** the admin adds `studio.new_editor` on, **Then** it lists; switching it off or removing it updates the list at once.
7. **Given** Open, **When** someone opens the landing page, **Then** the waitlist form is replaced by a Create account button to `/signup`; back to Invite only, the waitlist form shows again.

---

### User Story 7 - The audit log (Priority: P3)

The admin opens **Audit log**: every admin change newest first, 50 at a time with Load more, filterable by admin, action (from the known action list, grouped by target), target person and date range. Each row shows when, who, the action in words, the target (linked to the person when it is one) and a **Details** toggle with the before and after values side by side. The user detail's "recent activity" panel is the same list filtered to that person.

**Why this priority**: The log exists since 002; this gives it a page.

**Independent Test**: In the mock, run three different actions, open the audit log and find each; filter by action and by person; open Details.

**Acceptance Scenarios**:

1. **Given** admin actions, **When** the audit log opens, **Then** each shows with time, admin email (or "deleted admin"), action label, target and details.
2. **Given** filters, **When** the admin picks an action and a date range, **Then** only matches show.
3. **Given** a user detail, **When** its activity panel loads, **Then** it shows that person's entries with a link to the full log filtered to them.

---

### User Story 8 - Suspended accounts and closed sign-up, everywhere (Priority: P2)

A suspended person who tries to sign in (or finish a password reset, or accept an invitation for an email that is now suspended) sees "This account is suspended. Contact support at <support email>." instead of a generic error. A person who is suspended while using the studio is signed out at their next request and sees the same message on the sign-in page. Closed sign-up shows its own message (US6).

**Why this priority**: Suspension without a clear message produces support requests.

**Independent Test**: In the mock, suspend a seeded person, then sign in as them: the suspended message shows. While they are signed in in another tab, suspend them and act in the studio: they land on sign-in with the message.

**Acceptance Scenarios**:

1. **Given** a suspended account, **When** its owner signs in, **Then** the sign-in form shows the suspended message (not "wrong email or password").
2. **Given** a suspended account, **When** its owner finishes a password reset, **Then** the reset page shows the suspended message.
3. **Given** a signed-in person who gets suspended, **When** the studio's next call is refused, **Then** they go to the sign-in page with the suspended message.

### Edge Cases

- Two admins act on the same person at once: each action answers with the person's current state, and the detail always shows the latest answer. A refusal (e.g. already suspended) shows the service's message and reloads the person.
- The person is deleted while the admin has their page open: the next action answers "not found"; the page says the person no longer exists and offers the Users list.
- An audit entry whose admin was deleted shows "deleted admin" for the email; a ledger or payment row whose person was deleted shows "deleted person".
- Very long lists: Load more stops when there is no next page; the page never loads all rows at once.
- The service is unreachable: each page shows its load error with Retry; actions show the error in a toast and leave the form filled in.
- A change-plan date that overlaps a scheduled subscription: the service's message shows on the end-date field, with a hint to end the scheduled one from Subscriptions.
- The top-bar search with an empty query opens Users unfiltered; with text it opens Users filtered by that text.
- A deep link to a console page with filters in the address restores the filters.
- Admin on a narrow window (under 1024 px): the rail collapses to icons with labels on hover/focus; tables scroll sideways inside their card; the console is not designed for phones but stays usable.
- The mock (demo data) has a seeded admin; the badge says **Demo data**, so screenshots are never mistaken for real figures.
- Money is always shown in US dollars from cents; byte counts in KB/MB/GB; times in the admin's locale and time zone, with the full UTC time on hover.

## Requirements *(mandatory)*

### Functional Requirements

**Console frame**

- **FR-001**: The console MUST live at `/admin/**` with its own layout: a fixed side rail with the sections in US1, a top bar with a people search, the environment badge, a link back to the studio and the admin's account menu. It MUST follow the reading direction (rail on the right in Arabic, on the left in English).
- **FR-002**: Every console page MUST be reachable only by a signed-in admin; anyone else is sent to the library (signed in) or to sign-in (signed out). The studio MUST show an "Admin console" entry only for admins.
- **FR-003**: `/app/admin` and `/app/admin/invitations` MUST forward to `/admin/waitlist` and `/admin/invitations`.
- **FR-004**: The environment badge MUST show Local, Staging or Production (set at build time) and Demo data when the in-browser mock is used.
- **FR-005**: Lists MUST be dense tables (row height and type smaller than the studio) built from the existing paper/ink tokens, with sticky headers, a loading skeleton, an empty state, a load error with Retry, and **Load more** for paged lists.
- **FR-006**: Filters, search text, period and grouping MUST be kept in the page address so a reload or shared link restores them.

**Dashboard**

- **FR-007**: The dashboard MUST show every figure of the backend dashboard for a period of 7, 30 (default), 90 or 365 days, a day-by-day sign-up chart, and attention items that link to the matching filtered page.

**People**

- **FR-008**: The Users page MUST search by email or name, filter by plan key and status, and page 50 at a time newest first, showing the row fields in US2.
- **FR-009**: The user detail MUST show the panels in US2 and run every action in US2: suspend/unsuspend, password reset, change plan, grant/correct credits, make/stop admin, schedule/cancel deletion, set/remove override. Actions that sign the person out or remove access MUST ask for confirmation; suspend and schedule deletion MUST also require the person's email typed exactly; reasons are required where the service requires them.
- **FR-010**: Actions the service always refuses (own account, admin target, last admin, plan already in force) MUST be shown disabled with the reason; any refusal the service still sends MUST show its message.
- **FR-011**: The waitlist and invitations pages MUST keep today's behaviour and add the waitlist search, invited filter, "has an account" mark and remove action.

**Money**

- **FR-012**: The Plans & quotas page MUST edit plan names, prices, active flag and order, each plan's limit values (set or default), and add plans and limit kinds. The Free plan's active switch MUST be disabled.
- **FR-013**: The Subscriptions page MUST list all subscriptions with the filters in US4, move an end date and end early with a reason; upgrade requests MUST be listed, searched, filtered by state, fulfilled and rejected.
- **FR-014**: The Payments page MUST list payments for a date range with the count and total for the whole range.

**AI**

- **FR-015**: The AI Usage page MUST show totals and groups for a period by provider, capability, day (with a chart) or person (linking to the person).
- **FR-016**: The AI Calls page MUST list calls with filters for status, person, provider, capability and period, and a Failures shortcut.
- **FR-017**: The Credit ledger page MUST list entries with filters for person, kind and period, show the creating admin, and grant credits to a person found by email.

**System**

- **FR-018**: The Settings page MUST switch the sign-up mode with a confirmation, set and remove the two platform keys (never showing a stored key; clearing the field after save), and create, switch and remove feature flags.
- **FR-019**: The Audit log page MUST list entries with filters for admin, action (from the action list), target person and date range, and show before/after details.

**Public and account side**

- **FR-020**: A public `/signup` page MUST create an account and sign in while sign-up is open, show an invite-only message linking to the waitlist while it is not, and show the email-taken error on the email field. The sign-in page MUST link to it, and the landing page MUST replace its waitlist form with a Create account button, only while sign-up is open. The app MUST read the sign-up mode from the public settings.
- **FR-021**: The app MUST handle the two new error codes: `account_suspended` (suspended message, with the build-time support email when set, on sign-in, reset and invite accept; signed-in sessions refused with it go to sign-in with the message) and `signup_closed` (invite-only message on `/signup`).

**Adapters and quality**

- **FR-022**: Every console call MUST go through the admin service port; the in-browser mock MUST implement every call with seed data (people across plans and statuses, subscriptions, requests, payments, AI calls, ledger entries, audit entries, settings) and a seeded admin, and the real-service adapter MUST follow the backend 005 contract.
- **FR-023**: All console copy MUST be in the Arabic and English locale files; layouts MUST use logical properties and render correctly in both directions.
- **FR-024**: Every interactive control MUST be reachable by keyboard with a visible focus ring; dialogs trap focus and close with Esc; tables have header cells and captions for screen readers; contrast meets WCAG 2.2 AA.

### Key Entities

- **Admin view of a person**: the row (list) and detail (panels) the service returns; never secrets.
- **Account action**: suspend, unsuspend, password reset, plan change, credit grant/correction, admin grant/revoke, deletion schedule/cancel, override set/remove; each answers the person's new state.
- **Dashboard figures**, **subscription row**, **upgrade request**, **payment**, **AI usage group**, **AI call**, **ledger entry**, **audit entry**, **admin settings** (sign-up mode, AI key states, flags) and **public settings** (sign-up mode, flags): read-only views from the service, except settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can find a person by email from any console page and reach their detail in two steps (search, open), in under 10 seconds.
- **SC-002**: Every dashboard figure in the mock matches a hand count of the seed data for the 7- and 30-day periods.
- **SC-003**: Every account action in US2 can be completed from the user detail without leaving the page, and each one appears in the audit log.
- **SC-004**: No full platform AI key, password or token appears in the page, the address or the browser's storage at any point (checked by a test that searches the page after saving a key).
- **SC-005**: Every console page renders without layout errors in Arabic and English at 1280 px and 1440 px wide, and stays usable at 1024 px.
- **SC-006**: Every console page and dialog can be operated by keyboard alone (checked by an end-to-end keyboard test on the users list, user detail actions and settings).
- **SC-007**: All existing studio tests (unit and end-to-end) still pass; the old admin page tests pass at the new addresses.

## Assumptions

- The backend 005 contract (PR AhmedEaswy/tilw-backend#4) is the source of truth; small fixes during its review are picked up before implementation.
- The console is desktop-first; phones are not designed for (the narrow-window rule in Edge Cases applies).
- Charts are simple bars drawn with the design tokens; no chart library is added.
- Times are shown in the admin's browser time zone; the dashboard's per-day buckets are UTC days, labelled as such.
- The top-bar search searches people only (the most common support task); other pages have their own filters.
- The public sign-up page follows the existing auth pages' look (auth layout); its copy is new.
- Mobile app sign-up opens the web `/signup` page (backend 005 assumption); nothing mobile is built here.
- Feature flags are read by the app from public settings but no studio feature is switched by a flag in this feature.
