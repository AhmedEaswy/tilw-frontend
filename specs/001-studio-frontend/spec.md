# Feature Specification: Tilw Prompter Studio — Frontend (Phase 1)

**Feature Branch**: `main` (single branch per owner's choice)

**Created**: 2026-11-19

**Status**: Draft — awaiting owner review

**Input**: "Implement the Tilw Prompter web app as frontend only for now, with full auth and password reset,
from the Figma 'Studio redesign' screens. After implementing, validate the idea and list what is missing
to close the cycle."

**Design source**: Figma `t9xEIr22yKOj7o2Ft32hxb`, page `02 · Prototype`. Screen inventory and route map:
[screens.md](./screens.md). App flow: [flow.md](./flow.md). Missing pieces: [gaps.md](./gaps.md).

## Product in one line

A browser teleprompter for Arabic-first creators: **write → rehearse → record → keep the original**,
with scripts synced to an account and recordings kept on the device.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sign in, and recover a forgotten password (Priority: P1)

An existing member signs in with email and password. A member who forgot their password requests a reset
link, opens it, sets a new password and lands signed in. A visitor without an account joins the waitlist.

**Why this priority**: Nothing else is reachable without a session; registration is invitation-only.

**Independent Test**: Against the mock adapter, sign in with the seeded user, sign out, request a reset,
open the mock reset link, set a new password, sign in with it.

**Acceptance Scenarios**:
1. **Given** a seeded account, **When** valid credentials are submitted, **Then** the user lands on
   `/app/scripts` (or the page they were sent away from).
2. **Given** wrong credentials, **When** submitted, **Then** an inline, non-enumerating error is shown
   ("البريد أو كلمة المرور غير صحيحة") and the password field is cleared.
3. **Given** any email, **When** a reset is requested, **Then** the "check your email" screen is shown
   regardless of whether the account exists.
4. **Given** a valid reset token, **When** a new password meeting the policy is set, **Then** the user is
   signed in and other sessions are considered revoked. *(no Figma frame — G2, approved: built from AuthFrame, T022)*
5. **Given** an expired/used token, **When** the link is opened, **Then** an explanatory state offers a new
   request. *(no Figma frame — G2, approved: built from AuthFrame, T022)*
6. **Given** a visitor, **When** they submit the waitlist form, **Then** the confirmed screen shows their email.
7. **Given** a signed-out visitor, **When** they open any `/app/**` URL, **Then** they are redirected to
   sign-in with a return path.

### User Story 2 — Accept an invitation and create the account (Priority: P1)

A waitlisted person receives an invitation link, sets their name and password, and starts in an empty library.

**Why this priority**: Without it the waitlist never converts; the cycle is open. *(no Figma frame — G1, approved: built from AuthFrame, T030–T033)*

**Independent Test**: Generate a mock invite token, open `/invite/:token`, complete the form, land on the
empty library.

**Acceptance Scenarios**:
1. **Given** a valid invite, **When** name + password are set and terms accepted, **Then** the account exists
   and the user is signed in.
2. **Given** an expired or already-used invite, **Then** the user sees an explanation and a sign-in link.

### User Story 3 — Script library (Priority: P1)

The member sees their scripts, the last opened one highlighted, can search, filter (all / pinned /
archived), sort (newest / title), create a blank script, import a `.txt` file, and act on a script
(rename, duplicate, download TXT, pin, archive).

**Independent Test**: With seeded scripts, every filter/sort/search combination returns the expected list;
creating and importing add a script; archiving moves it to the archived filter.

**Acceptance Scenarios**:
1. **Given** no scripts, **Then** the empty library (6:22) offers "new" and "import".
2. **Given** scripts, **When** typing in search, **Then** results filter by title and body as you type.
3. **Given** a script, **When** "نقل إلى الأرشيف" is chosen, **Then** it leaves "الكل" and appears under "المؤرشفة".
4. **Given** a `.txt` file, **When** imported, **Then** a script is created with the file name as title and
   paragraphs split on blank lines.

### User Story 4 — Write and prepare a script (Priority: P1)

The member edits title and body with autosave to their account, sees live word/paragraph count and estimated
duration, adds delivery marks (emphasis, pause, note), searches in text, undoes/redoes, and downloads TXT.

**Acceptance Scenarios**:
1. **Given** an edit, **When** the user pauses typing, **Then** the status shows "حُفظ في حسابك" within 2 s.
2. **Given** the account copy changed elsewhere, **When** saving, **Then** the conflict screen (6:72) compares
   both copies and the user chooses one (6:73 confirms replacement).
3. **Given** selected words, **When** "تأكيد" is applied, **Then** they render highlighted in editor and reader.

### User Story 5 — Rehearse with the reader (Priority: P1)

The member opens rehearsal: the text scrolls at a constant WPM or advances manually, with play/pause,
paragraph position ("الفقرة 2 من 3"), font size, mirror, line width, text direction, countdown, and keyboard
shortcuts (Space play/pause, Esc close settings). Settings persist per account.

**Acceptance Scenarios**:
1. **Given** constant mode at 120 WPM, **When** playing, **Then** scroll speed matches WPM ±5%.
2. **Given** manual mode, **When** pressing next/previous, **Then** the reader moves one paragraph.
3. **Given** the reading position could not be saved, **Then** the recovery screen (6:79) lets the user continue
   or pick a paragraph (6:80).

### User Story 6 — Record a take and keep the original (Priority: P2)

From a script the member opens the recording studio, chooses audio or video+audio, grants permission, checks
framing and level, picks devices, starts (3-2-1 countdown), reads with the prompter overlaid, stops & saves
(max 10 min), reviews the take, and downloads the original file. They can also "practise without recording".

**Acceptance Scenarios**:
1. **Given** permission denied, **Then** the denied state (6:78) offers retry help or rehearsal without recording.
2. **Given** a recording reaches 10:00, **Then** it stops and saves automatically. *(state missing — G8)*
3. **Given** a saved take, **When** "download original" is pressed, **Then** the browser download starts with the
   original container (WebM/MP4) and the confirmation state (6:48 / 6:60) is shown.

### User Story 7 — Recordings library (Priority: P2)

The member sees all takes stored in this browser, grouped by script, with type and duration; can review,
download, and (gap) delete or star the best take. First visit shows the explanatory empty state (6:77).

### User Story 8 — Preferences and account data (Priority: P2)

Language (ar/en), appearance (system/light/dark), account identity, reading defaults, export account data
as JSON after password confirmation (6:66 → 6:67), recover legacy browser scripts with explicit consent
(6:68 → 6:71), privacy, terms, sign out.

### User Story 9 — Public pages (Priority: P3)

Landing (done), privacy and terms full Arabic documents (6:81, 6:82), contact (6:5), and the public
reader demo without an account (6:6–6:17).

### Edge Cases
- Session expires mid-edit → keep the unsaved buffer locally, prompt to sign in, then resume save.
- Offline → editor keeps a local draft and shows a non-blocking "not saved yet" status. *(G10)*
- Browser storage quota exceeded while recording → stop safely, keep what was captured, warn. *(G8)*
- Tab hidden / device unplugged during recording → stop and save the partial take. *(G8)*
- Import of non-text, empty or >1 MB file → inline error in the import dialog. *(G11)*
- Very long scripts (> 20k words) must still scroll smoothly in the reader.
- RTL script read in an English UI, and vice versa (direction is a per-script setting).

## Requirements *(mandatory)*

### Functional Requirements

**Auth & account**
- **FR-001**: Users MUST sign in with email + password; errors MUST NOT reveal whether the email exists.
- **FR-002**: Users MUST be able to request a password reset link and set a new password from it.
- **FR-003**: Visitors MUST be able to join the waitlist with an email.
- **FR-004**: Invited users MUST be able to create their account from an invitation link.
- **FR-005**: All `/app/**` routes MUST require a session; signed-in users visiting auth pages go to the app.
- **FR-006**: Users MUST be able to sign out, export account data (after password confirmation), and
  delete their account after password confirmation (G4, T094). Browser recordings are not deleted by this
  and the confirm screen says so.
- **FR-008**: Users MUST be able to edit their name and change their password (current + new) from
  settings (G5, T093). Email stays read-only until the backend exists.
- **FR-009**: Screens with no Figma frame (invite, set new password, account edit, delete account) are
  built from the existing auth frame (6:62 / 6:100) and settings frames (6:65, 6:66 → 6:67) — owner approved
  2026-11-19.
- **FR-007**: Password policy: minimum 8 characters [NEEDS CLARIFICATION: any further rules?].

**Scripts**
- **FR-010**: CRUD scripts with title and body; autosave with visible status; optimistic UI with rollback.
- **FR-011**: Search, filter (all/pinned/archived), sort (newest/title), pin, archive/unarchive, duplicate,
  rename, download TXT, import TXT.
- **FR-012**: Delivery marks: emphasis, pause, note — stored with the script and rendered in reader/recording.
- **FR-013**: Detect edit conflicts (version mismatch) and offer compare + choose.
- **FR-014**: Estimate duration from word count at the user's WPM.

**Reader**
- **FR-020**: Constant-speed (60–220 WPM) and manual modes; play/pause; paragraph navigation.
- **FR-021**: Reading mode, WPM, font size, mirror, line width and countdown (0/3/5 s) are account-wide:
  a change in rehearsal or in settings updates the same values everywhere. Text direction is saved per
  script. (G15, decided 2026-11-19)
- **FR-022**: Keyboard shortcuts: Space, Esc, ←/→ (paragraph), ↑/↓ (speed).
- **FR-023**: Save last reading position per script; recover gracefully when it cannot be saved.

**Recording**
- **FR-030**: Audio-only and video+audio modes via the browser's media APIs; device selection; level meter.
- **FR-031**: Countdown, prompter overlay during capture, stop & save, 10-minute cap.
- **FR-032**: Takes stored only in this browser (IndexedDB), listed per script, reviewable, downloadable as
  the original file; [NEEDS CLARIFICATION: delete take and "best take" star — G8].

**Platform**
- **FR-040**: Arabic (RTL, default) and English (LTR) UI; theme system/light/dark.
- **FR-041**: Responsive from 320×568 up to desktop, matching phone, tablet and short-landscape frames.
- **FR-042**: All data access through service ports; Phase 1 uses a mock adapter with seeded data and a
  dev toolbar to simulate latency, errors, conflicts and expired tokens.
- **FR-043**: Phone remote control — **Deferred** to a later phase (owner decision 2026-11-19, G3).
- **FR-044**: Tilw Plus AI line breaks — **Deferred** to a later phase (owner decision 2026-11-19, G6).
- **FR-045**: Phase 1 ships as a static site (prebuilt HTML/JS/CSS, no server runtime); all data comes from
  the in-browser mock adapter.

### Key Entities
- **User** — id, name, email, locale, theme, readingDefaults.
- **Script** — id, title, body (paragraphs with marks), pinned, archived, updatedAt, version, lastPosition.
- **DeliveryMark** — type (emphasis | pause | note), range, value (pause seconds / note text).
- **ReadingSettings** — mode, wpm, fontSize, mirror, lineWidth, countdown (account-wide). Text direction lives on Script (G15).
- **Take** (device-only) — id, scriptId, kind (audio | video), mimeType, durationMs, sizeBytes, createdAt, blob.
- **WaitlistEntry**, **Invitation**, **PasswordResetToken** — server-side; mocked in Phase 1.

See [data-model.md](./data-model.md).

## Success Criteria *(mandatory)*

- **SC-001**: A new invited user goes from invitation link to first saved take in under 5 minutes.
- **SC-002**: Autosave status confirms within 2 s of the last keystroke on a normal connection.
- **SC-003**: Reader scroll runs at 60 fps on a mid-range laptop for a 5,000-word script.
- **SC-004**: Every Figma frame in scope has a matching route/state and passes visual review in ar and en.
- **SC-005**: Swapping the mock adapter for the HTTP adapter requires no component changes.

## Assumptions
- Public contact address is a placeholder (`contact@example.com`) from one config value until the owner supplies the real one (G16); replace before launch.
- Registration stays invitation-only; there is no open sign-up.
- Auth will later be Laravel Sanctum (cookie SPA auth); the mock mirrors its shape.
- Recordings are never uploaded (stated in privacy policy and FAQ).
- Only `.txt` import/export in Phase 1.
- Phone remote and Tilw Plus are out of Phase 1 (decided 2026-11-19). Landing links to them stay as
  marketing copy; in-app entry points are not built.
- Phase 1 is a static build with no backend; sessions, scripts and settings persist in the browser via the mock.
