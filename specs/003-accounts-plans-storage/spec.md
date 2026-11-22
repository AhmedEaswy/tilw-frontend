# Feature Specification: Web app — accounts, plans & storage (release 2)

**Feature Branch**: `002-accounts-plans-storage` (same branch name as the backend; the spec folder is `003` because `specs/002-admin-pages` already holds the admin mockups)

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Web app side of release-2 feature 'accounts, plans & storage'. Backend spec: `backend/specs/002-accounts-plans-storage/spec.md`; owner decisions: `release-2-plan.md`. Landing plans read from the service with USD prices and a monthly/yearly switch, 'Tilw Plus' renamed 'Tilw Pro'; in-app Plan & usage page with limit messages and read-only over-limit scripts; plan-based take length; Upgrade to Pro through WhatsApp with request reference and plan banners; Storage settings with Google Drive link, sync off / manual / auto, Drive space, per-take backup and sync states, takes from other devices; script history; email change, devices, 14-day deletion; new port methods and error kinds in contract, mock and HTTP adapters."

## Context

This is the screen side of backend feature `002-accounts-plans-storage`. Every rule about plans, limits, subscriptions, storage, history, email change, devices and deletion is defined there. This spec says what people see and do in the web app, and keeps the app's two adapters (in-browser mock and real service) in step.

Constitution principle IV was amended to v1.1.0. Recordings never touch Tilw's servers: takes stay in the browser and, only if the person chooses, also go straight from the browser to their own Google Drive. Sync is off by default.

**Design source**: Figma `t9xEIr22yKOj7o2Ft32hxb`, page `07 · Release 2 · Plans & storage` (`249:100`), desktop Arabic light frames drawn 2026-11-22 from the design-system page. The frame for each screen is listed in [gaps.md](gaps.md); phone, dark and English layouts follow from them as in release 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know my plan and why something was refused (Priority: P1)

A signed-in person opens **Settings → Plan & usage** and sees their plan, its end date, and a row for each limit with a meter (for example "Active scripts 14 of 20"). Whenever the app refuses an action because of a limit, it says which limit was hit and offers the way forward: archive something, or upgrade. Scripts over the limit open read-only with a calm banner instead of an error.

**Why this priority**: People will hit limits as soon as release 2 ships. A refusal they can't understand looks like a bug.

**Independent Test**: In the mock, set the Free active-script limit to 2 with 2 active scripts. Try to create a third and see the limit message with "Archive a script" and "Upgrade to Pro". Lower the limit to 1 and confirm the older script opens read-only while it can still be rehearsed.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** they open Plan & usage, **Then** they see the plan name, its period and end date (Pro), and one row per known limit. Each row shows its value ("Unlimited" when uncapped) and, for counted limits, a usage meter that turns to the warning colour at 80 % and above.
2. **Given** a refused action (create or restore a script, save over the word limit, switch sync to auto, back up a take longer than allowed), **When** the service answers "limit reached", **Then** the app shows a message naming the limit, its value and current usage, with the action that helps (archive, shorten, upgrade). It never shows the generic error text.
3. **Given** a script that is read-only because of a lowered limit, **When** it is opened, **Then** the editor shows a banner explaining why and how to unlock it. Text, title and marks can't be edited. Rehearse, record, export, archive and delete still work.
4. **Given** the recording studio, **When** a take starts, **Then** the take's maximum length comes from the person's plan (10 min Free, 60 min Pro at start). The "Maximum N minutes" label, last-minute countdown and auto-stop use that value instead of a fixed 10 minutes.
5. **Given** a limit kind the app does not know yet, **When** the plan is read, **Then** it is not shown and nothing breaks. Limits for features not built yet (AI credits, phone link) stay hidden until those features ship.

---

### User Story 2 - Upgrade to Pro through WhatsApp (Priority: P1)

A Free person taps **Upgrade to Pro** from Plan & usage, a limit message, or the account menu. A sheet compares Free and Pro, lets them pick monthly or yearly, and shows the price in US dollars. **Continue on WhatsApp** opens WhatsApp with the message already written. Back in the app, they see that their request is pending, with its reference. They can copy the reference or cancel. When an admin activates Pro, the app says so. Before Pro ends, the app reminds them; when it ends, the app says they are back on Free and nothing was deleted.

**Why this priority**: It is the only way to pay in release 2.

**Independent Test**: In the mock, request Pro yearly. Confirm a WhatsApp address with the plan, period, price and reference opens in a new tab, and Plan & usage shows "Request TLW-XXXX pending". Use the mock knob to activate it and see the Pro banner and Pro limits. Move the mock clock to 6 days before the end and see the "ending soon" banner.

**Acceptance Scenarios**:

1. **Given** a Free person, **When** they open the upgrade sheet, **Then** they see both plans side by side (limits from the service, not from the app), a monthly / yearly switch with the yearly saving shown, and the selected price in US dollars.
2. **Given** they choose **Continue on WhatsApp**, **When** the request succeeds, **Then** the WhatsApp link from the service opens in a new tab or the WhatsApp app. If the browser blocks the new tab, the sheet shows the link as a button and the reference with a copy control.
3. **Given** a pending request, **When** the person returns to Plan & usage, **Then** a panel shows "Request pending", the reference, the period and price, and "Open WhatsApp again" and "Cancel request" (with confirm).
4. **Given** Pro became active since the last visit, **When** the person opens the app, **Then** a one-time notice says Pro is active until its end date.
5. **Given** Pro ends within 7 days, **When** the person is in the app, **Then** Plan & usage and the library show a dismissible "Pro ends on DATE" banner with **Renew**, which opens the same WhatsApp flow. Dismissing it hides it for 24 hours.
6. **Given** Pro has ended, **When** the person next opens the app, **Then** a one-time notice says they are on Free, what changed (for example auto sync is now manual, and N scripts are read-only), and that nothing was deleted.
7. **Given** a Pro person, **When** they open the upgrade sheet, **Then** it shows their current period and offers **Renew** instead of **Upgrade**.

---

### User Story 3 - Keep my takes in my Google Drive (Priority: P1)

A person opens **Settings → Storage**, links Google Drive, and chooses **Off**, **Manual** or **Auto**. With Manual, each take in recordings has a **Back up to Drive** action. With Auto, new takes upload by themselves after saving. Each take shows where it is: on this device, waiting, uploading with progress, in Drive, failed (with retry), or in Drive only (made on another device). The settings show how full their Drive is and how much Tilw takes use. Unlinking is one confirmed action.

**Why this priority**: It is the headline change of release 2: takes that survive a cleared browser or a new computer.

**Independent Test**: In the mock (simulated Drive), link storage and set Manual. Back up one take and watch it move from uploading to "In Drive". Sign in from a second browser profile and see the take marked "In Drive only", playable and downloadable. Set the mock Drive to full and confirm a new backup fails with "Drive is full" while the take stays on the device.

**Acceptance Scenarios**:

1. **Given** no linked storage, **When** the person taps **Link Google Drive**, **Then** they go to Google's consent page and come back to Storage settings. The page shows "Linked as <google email>", or a clear message if they declined. Before linking, the page explains in plain words that Tilw can see only files it creates.
2. **Given** linked storage, **When** the person picks a sync mode, **Then** it is saved to the account. On Free, **Auto** shows a lock and "Pro" tag, and choosing it opens the upgrade sheet instead of saving.
3. **Given** sync **Manual**, **When** they tap **Back up to Drive** on a take (in the list or in take review), **Then** the take uploads with visible progress. Afterwards it shows "In Drive" and the service has a record of it.
4. **Given** sync **Auto**, **When** a take is saved in the studio, **Then** it starts uploading in the background without blocking the next take. If the tab closes mid-upload, the upload resumes the next time the app is open. Takes waiting to upload show "Waiting to upload".
5. **Given** any upload, **When** it fails (Drive full, link revoked, network lost), **Then** the take stays on the device, shows "Backup failed" with the reason and **Retry**, and is never deleted from the device because of the failure. "Drive is full" links to the Drive space figures; "Drive not linked" links to Storage settings.
6. **Given** takes backed up from another device, **When** recordings is listed, **Then** they appear with an "In Drive only" badge. They can be played (streamed from Drive) and downloaded as the original file, starred, renamed and deleted.
7. **Given** a take that is both on the device and in Drive, **When** it is deleted, **Then** the confirm dialog offers "Delete from this device", "Delete from Drive too" and "Cancel".
8. **Given** linked storage, **When** Storage settings opens, **Then** it shows Drive used and free space (Google's figures), the space used by Tilw takes, and the number of takes in Drive.
9. **Given** linked storage, **When** the person unlinks and confirms, **Then** the page returns to not-linked. Takes made on this device stay. Takes that were in Drive only are marked "Not reachable", and the dialog says the files stay in their Drive.
10. **Given** sync **Off**, **Then** the app sends nothing about takes to the service (release-1 behaviour).

---

### User Story 4 - See current plans on the landing page (Priority: P2)

A visitor reads the plans section and sees Free and Tilw Pro with today's prices and what each includes, switches between monthly and yearly, and follows a working link to get Pro.

**Why this priority**: The landing page currently advertises a plan that doesn't exist ("Tilw Plus") and links to nothing. That is wrong, but it doesn't block anyone already using the app.

**Independent Test**: Change Pro's price in the mock (or service) and reload the landing page to see the new price. Toggle yearly. Follow "Get Tilw Pro" signed out and land on sign-in; follow it signed in and land on the upgrade sheet.

**Acceptance Scenarios**:

1. **Given** the plans section, **When** it loads, **Then** prices and limit lines come from the service. If the service can't be reached, it shows the prices baked in at build time without a broken state.
2. **Given** the monthly / yearly switch, **When** it is toggled, **Then** Pro's price and the yearly saving update without a reload.
3. **Given** the Pro card, **Then** it is titled "Tilw Pro" and its feature lines match Pro's limits (AI credits wording stays as a future line until feature 004 ships).
4. **Given** the "Get Tilw Pro" button, **When** a signed-out visitor follows it, **Then** they reach sign-in, which returns to the upgrade sheet after sign-in. **When** a signed-in person follows it, **Then** the upgrade sheet opens.

---

### User Story 5 - Go back to an earlier version of my script (Priority: P2)

In the editor, the person opens **History** from the writing tools, sees earlier versions with time, word count and reason, previews one side by side with nothing changed yet, and restores it after confirming.

**Why this priority**: It is a safety net that people value only once they need it. The core editor works without it.

**Independent Test**: In the mock, edit a script across three sessions, open History, preview the first version, restore it, and confirm the editor shows that text and History now lists a "Before restore" version.

**Acceptance Scenarios**:

1. **Given** the editor, **When** History is opened, **Then** a side panel (bottom sheet on phones) lists versions newest first with relative time, word count and reason ("Edit", "Before restore", "AI change" later). A line explains how far back the plan keeps history, with an upgrade hint on Free.
2. **Given** a version, **When** it is selected, **Then** its full text with marks is shown read-only in the panel, and the editor's text stays unchanged.
3. **Given** a previewed version, **When** **Restore this version** is confirmed, **Then** the editor shows the restored text, a toast says it was restored and that the previous text is in History, and a version conflict uses the release-1 conflict screen.
4. **Given** a read-only script, **Then** History can be viewed but not restored.

---

### User Story 6 - Manage my email, my devices and account deletion (Priority: P3)

On the account page, a person changes their email, sees "Waiting for confirmation at new@…", and confirms from the email link. A **Devices** section lists phones signed in to their account, with a **Sign out** on each. Deleting the account now explains the 14-day window. Signing back in during that window cancels it, and the app says so.

**Why this priority**: It completes account control. Few people will use it in the first weeks.

**Independent Test**: In the mock, change the email and see the pending state. Open the confirm link and see success. Sign in with the new email. Revoke a mock phone device and see it leave the list. Delete the account, see the 14-day done screen, sign in again and see "Deletion cancelled".

**Acceptance Scenarios**:

1. **Given** the account page, **When** the person enters a new email and their current password, **Then** the page shows "Waiting for confirmation at <new email>", with **Resend** and **Cancel**. Sign-in still uses the old email until confirmed.
2. **Given** the confirmation link, **When** it opens `/confirm-email`, **Then** the page shows success (and updates the signed-in profile if signed in), or an "expired" or "invalid" state with a way to request a new link from the account page.
3. **Given** the Devices section, **Then** it lists each mobile device's name, platform, sign-in date and last use, and marks the current browser as "This browser". **Sign out** on a device asks for confirmation and removes it.
4. **Given** account deletion, **When** it is confirmed with the password, **Then** the done screen says the account will be deleted on DATE (14 days ahead), that signing in before then cancels it, and that files in their Drive stay. Then it signs out.
5. **Given** an account whose deletion was cancelled by signing in, **When** the app opens after sign-in, **Then** a one-time notice says "Your account deletion was cancelled".

---

### Edge Cases

- **Service doesn't know the plan yet** (first load, offline): Plan & usage shows a skeleton, then the release-1 offline notice. Limit checks never run on the device alone: the service decides.
- **Pending request when Pro is activated in another tab**: the next plan read replaces the pending panel with the Pro notice.
- **WhatsApp not installed on desktop**: the link opens WhatsApp Web, so no special handling is needed.
- **Google consent cancelled or the wrong Google account picked**: the person comes back to Storage with a clear message. Linking again is allowed, and unlinking first is offered if they want to switch account.
- **Upload in progress when the person signs out**: the upload stops, and the take stays on the device as "Waiting to upload" for that account only.
- **A take recorded while signed out of the service is impossible** (the app requires sign-in), so every take has an owner.
- **Two tabs uploading the same take**: one tab owns the upload, and the other shows its progress.
- **Very large takes (up to about 1 GB)**: progress is shown in percent and size, and a broken upload resumes instead of restarting.
- **Private browsing or storage cleared after backup**: the take becomes "In Drive only" and still plays.
- **Arabic and English**: every new screen exists in both, and prices use Western digits with "$" in both languages, as the reader does for numbers.
- **Mock adapter**: the mock simulates plans, limits, requests, a fake Drive (link, quota, full, revoked, slow upload) and devices, with `/__mock` knobs to switch plan, change limits, activate a request, move the clock and make Drive fail.

## Requirements *(mandatory)*

### Functional Requirements

**Plans, limits and upgrade**

- **FR-001**: The app MUST read plans and the person's effective limits and usage from the service and MUST NOT hard-code any price or limit. It may only keep build-time fallback prices for the landing page.
- **FR-002**: The app MUST provide a Plan & usage page under settings, showing the plan, period, end date, known limits with values and usage meters, and any pending request.
- **FR-003**: The app MUST handle the new "limit reached" error everywhere an action can be refused. It MUST show the limit's name, value and usage with a relevant next step (archive, shorten, upgrade).
- **FR-004**: The app MUST open scripts that the service marks read-only in a read-only editor with an explanation, and keep rehearse, record, export, archive and delete available.
- **FR-005**: The recording studio MUST take its maximum take length from the person's effective limit.
- **FR-006**: The app MUST offer an upgrade sheet with a Free / Pro comparison, a monthly / yearly choice and the US-dollar price. It MUST create the request through the service, open the returned WhatsApp link, and fall back to a visible link and copyable reference when a new window is blocked.
- **FR-007**: The app MUST show pending-request, Pro-activated, Pro-ending (7 days) and back-on-Free states as described in User Story 2, and MUST let the person cancel a pending request.
- **FR-008**: The landing page MUST show Free and Tilw Pro from the service with a monthly / yearly switch, MUST replace every "Tilw Plus" mention with "Tilw Pro", and MUST point "Get Tilw Pro" to the upgrade sheet (through sign-in when signed out).

**Storage**

- **FR-009**: The app MUST provide Storage settings to link and unlink Google Drive, choose sync off / manual / auto (auto gated by plan), and show Drive and Tilw space figures.
- **FR-010**: The app MUST upload takes from the browser directly to the person's Drive, using the short-lived permission the service gives. It MUST resume interrupted uploads, and MUST NOT send take content to the Tilw service.
- **FR-011**: The app MUST show each take's place and sync state (on this device, waiting, uploading with progress, in Drive, in Drive only, backup failed, not reachable) in the recordings list and take review.
- **FR-012**: The app MUST list, play, download, star, rename and delete takes that exist only in Drive. It MUST offer device-only or device-and-Drive deletion for takes in both places.
- **FR-013**: The app MUST handle the new "storage full" and "storage not linked" errors by keeping the take on the device and explaining the next step. A failed upload MUST NOT remove a take from the device.

**History and account**

- **FR-014**: The editor MUST offer a History panel to list versions, preview one read-only, and restore it after confirming, using the release-1 conflict handling.
- **FR-015**: The account page MUST let a person request an email change with their password, see the pending state, resend or cancel it. A `/confirm-email` page MUST handle success, expired and invalid links.
- **FR-016**: The account page MUST list signed-in devices and let the person sign out any of them.
- **FR-017**: Account deletion MUST explain and confirm the 14-day window, and the app MUST tell a person once when signing in cancelled a pending deletion.

**Contract and adapters**

- **FR-018**: The service contract (`specs/001-studio-frontend/contracts/ports.md`) MUST gain a plan port, a storage port, take-record methods, history methods, email-change and device methods. It MUST gain the error kinds `limit_reached` (with limit key, value and usage), `storage_full` and `storage_not_linked`. Existing methods and error kinds MUST stay unchanged.
- **FR-019**: The mock adapter and the HTTP adapter MUST both implement every new method. The mock MUST simulate Drive and expose `/__mock` knobs (plan, limits, request activation, clock, Drive failures) so every story here is testable without the real service or Google.
- **FR-020**: Every new screen and message MUST exist in Arabic and English, follow the design-system tokens in light and dark themes, and meet WCAG 2.2 AA contrast and keyboard reachability.
- **FR-021**: Privacy and terms pages MUST be updated to say that takes can be copied to the person's own Drive when they choose, that Tilw sees only files it creates there, and that Tilw never stores recordings.

### Key Entities

- **Plan view**: a plan's name, prices in US dollars per period, and its limits as the app shows them.
- **Effective limits**: the person's limit value and usage for each limit kind, plus their plan, period and end date.
- **Upgrade request view**: reference, plan, period, price, state, WhatsApp link.
- **Storage link view**: provider, linked Google email, state, sync mode, Drive space figures, Tilw space used.
- **Take (extended)**: the release-1 device take, plus its record in the service (when backed up) and a sync state. A take may exist on the device, in Drive, or both.
- **Upload job**: one take's pending or running upload with progress, owned by one tab and resumable.
- **Script version view**: time, reason, word count, and full content when opened.
- **Device view**: name, platform, signed-in and last-used times, current flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Free person can go from a limit message to a ready-to-send WhatsApp message in 3 taps or fewer and under 30 seconds.
- **SC-002**: 100 % of "limit reached" refusals show the specific limit message. None shows the generic error.
- **SC-003**: A person can link Google Drive and back up their first take in under 2 minutes.
- **SC-004**: 0 takes are removed from the device by any upload failure. This is verified with full, revoked and offline cases in the mock.
- **SC-005**: A take backed up in one browser appears in another signed-in browser's recordings list within 5 seconds of opening recordings.
- **SC-006**: A price or limit changed by an admin shows on the landing page and in Plan & usage on the next page load, with no new web release.
- **SC-007**: A person can find and restore an earlier version of a script in under 1 minute, and the replaced text is always listed in History afterwards.
- **SC-008**: Every story in this spec passes its acceptance test against the mock adapter, and against the real service once backend 002 is deployed.

## Assumptions

- **Backend dependency.** Backend feature `002-accounts-plans-storage` provides every rule and action. This spec builds the screens first against the mock and then switches to the real service, as release 1 did.
- **Figma.** Desktop Arabic frames for all 13 screens are on Figma page `07 · Release 2 · Plans & storage`, listed in [gaps.md](gaps.md). Phone, dark and English layouts are derived from them in build, as in release 1.
- **Plans.** There are two plans only, Free and Pro. The app lays out exactly two cards. A third plan would need a design change, not just data.
- **Google sign-in.** Linking uses Google's own consent page with a redirect back to Storage settings. No Google script is loaded on other pages (the privacy promise of essential cookies only stays true).
- **Uploads only while the app is open.** There is no background upload after all Tilw tabs are closed. Uploads resume when the app is next open.
- **Landing language.** The landing page stays Arabic-only (release-1 decision). Only the plans section is changed.
- **Out of scope.** The admin console (005), phone link (003), AI tools and credits (004) and the mobile app are not part of this spec. Limit rows for AI credits and phone link stay hidden until those features ship.
