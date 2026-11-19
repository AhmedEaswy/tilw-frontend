# Requirements Review Checklist: Tilw Prompter Studio — Frontend (Phase 1)

**Purpose**: Unit tests for the requirements themselves — are the spec, plan, data model and contracts complete, clear, consistent and measurable across UX & accessibility, recording & on-device data, account & security, and the backend handoff? Not a test of the built app.
**Created**: 2026-11-19
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md) · [contracts/ports.md](../contracts/ports.md) · [gaps.md](../gaps.md)
**Depth**: Standard (reviewer, before Phase 11 and the Laravel handoff)

## Requirement Completeness

- [ ] CHK001 - Is the password policy fully specified (length, character rules, reuse, breached-password check), or is "minimum 8" confirmed as final? [Gap, Spec §FR-007]
- [ ] CHK002 - Are reset-link and invitation lifetimes (1 hour / 7 days in the UI copy) stated as requirements rather than only in copy? [Gap, Spec §FR-002, §FR-004]
- [ ] CHK003 - Is "other sessions are considered revoked" after a password reset defined (which sessions, when, how the user learns of it)? [Clarity, Spec §US1 AS4]
- [ ] CHK004 - Are requirements defined for what happens to other signed-in devices after a password change or account deletion? [Gap, Spec §FR-006, §FR-008]
- [ ] CHK005 - Is the content and schema of the account export (`tilw-account-v1.json`) specified — which fields, archived scripts, marks, reading settings, versioning of the format? [Gap, Spec §FR-006]
- [ ] CHK006 - Are star and delete for takes moved from [NEEDS CLARIFICATION] to stated requirements, matching what G8 now describes? [Gap, Spec §FR-032]
- [ ] CHK007 - Are the old app's browser keys and data format documented so the legacy scan can be specified beyond the Phase 1 samples? [Gap, Dependency, Spec §US8]
- [ ] CHK008 - Are limits for scripts stated in the spec (title 120 chars, body 200k chars, import 1 MB) rather than only in data-model.md? [Completeness, data-model §Validation]
- [ ] CHK009 - Are system states (offline, save failed, session expired, 404, generic error) specified with their behaviour, not only listed as G10? [Gap, Spec §Edge Cases]
- [ ] CHK010 - Are requirements for the public reader demo (6:6–6:17) defined beyond a frame reference — script source, which settings are available, what is disabled without an account? [Gap, Spec §US9]
- [ ] CHK011 - Is the contact form's behaviour in a static build (validate only, no sending) stated as an accepted Phase 1 limitation with the user-facing message? [Completeness, Spec §US9, G16]

## Requirement Clarity

- [ ] CHK012 - Is "settings persist per account" defined with save timing and what the user sees when the save fails? [Clarity, Spec §US5, §FR-021]
- [ ] CHK013 - Is "recover gracefully when the reading position cannot be saved" defined with the trigger, the screens (6:79 → 6:80) and when it stops reappearing? [Clarity, Spec §FR-023]
- [ ] CHK014 - Is "optimistic UI with rollback" defined per action (which actions are optimistic, what the user sees on rollback)? [Ambiguity, Spec §FR-010]
- [ ] CHK015 - Is "prompt to sign in, then resume save" for a session expiring mid-edit specified (where the prompt appears, whether the edit view is kept)? [Ambiguity, Spec §Edge Cases]
- [ ] CHK016 - Is "device selection" specified for when devices change or disappear during setup and during a take? [Clarity, Spec §FR-030]
- [ ] CHK017 - Is the meaning of "listed per script" for takes defined (grouping, order, what happens when the script is renamed or deleted)? [Clarity, Spec §FR-032]
- [ ] CHK018 - Is "matching phone, tablet and short-landscape frames" tied to explicit breakpoints and the frames that apply at each? [Clarity, Spec §FR-041]

## Requirement Consistency

- [ ] CHK019 - Do the countdown values agree: FR-021 says 0/3/5 s while Figma 6:30 and the data model allow 10 s? [Conflict, Spec §FR-021, data-model §ReadingSettings]
- [ ] CHK020 - Do the long-script thresholds agree: "> 20k words must scroll smoothly" (Edge Cases) vs "60 fps for a 5,000-word script" (SC-003)? [Conflict, Spec §Edge Cases, §SC-003]
- [ ] CHK021 - Is FR-021's list of account-wide settings consistent with the data model now that font size and line width are stored as steps mapped to px? [Consistency, data-model §ReadingSettings, gaps §US5]
- [ ] CHK022 - Are sign-out locations consistent between the spec (settings + phone), the desktop frame (none) and the account menu? [Consistency, Spec §FR-006, gaps §US8]
- [ ] CHK023 - Is the "Arabic-Indic vs Western digits" rule defined once and applied consistently (library uses ١٢٣, reader and recordings times use 123)? [Consistency, Gap]
- [ ] CHK024 - Do the recordings privacy statements (spec Assumptions, privacy page, studio help) all make the same promise about uploads and data clearing? [Consistency, Spec §Assumptions]

## Acceptance Criteria Quality

- [ ] CHK025 - Can SC-004 "passes visual review in ar and en" be judged objectively (who reviews, tolerance, which English frames exist per G13)? [Measurability, Spec §SC-004]
- [ ] CHK026 - Is SC-001 "under 5 minutes from invitation to first saved take" defined with start/end events and device assumptions? [Measurability, Spec §SC-001]
- [ ] CHK027 - Does SC-002 "within 2 s on a normal connection" define "normal connection" and the measured moment? [Clarity, Spec §SC-002]
- [ ] CHK028 - Is SC-005 "no component changes when swapping the adapter" backed by a list of what the HTTP adapter must handle (CSRF, 401/419, validation errors)? [Measurability, Spec §SC-005, contracts]
- [ ] CHK029 - Does each user story's "Independent Test" map to an automated spec, and is running those specs part of the done definition? [Traceability, tasks §Checkpoints]

## Scenario & Edge Case Coverage

- [ ] CHK030 - Are recording stop reasons (10-minute cap, device lost, tab hidden, storage full) each specified with the user-facing outcome rather than only "G8"? [Coverage, Spec §Edge Cases, §FR-031]
- [ ] CHK031 - Is the behaviour defined when saving a finished take to the browser fails (offer immediate download)? [Coverage, Exception Flow, Gap]
- [ ] CHK032 - Is "browser data cleared" addressed as a scenario — what the recordings and settings screens tell the user beforehand? [Coverage, Gap]
- [ ] CHK033 - Are permission-denied requirements defined for desktop as well as phone, including the help content? [Coverage, Spec §US6 AS1, G12]
- [ ] CHK034 - Are requirements defined for a recording started on one script being viewed after that script is archived or deleted? [Edge Case, Gap]
- [ ] CHK035 - Are waitlist duplicates and invites for an email that already has an account specified? [Edge Case, Spec §FR-003, §FR-004]
- [ ] CHK036 - Is mixed-direction text (RTL script in English UI and vice versa) specified for the editor, reader and recording prompter, not only as a per-script setting? [Coverage, Spec §Edge Cases]
- [ ] CHK037 - Are empty states specified for every list (library, pinned, archived, search, recordings, legacy scan)? [Coverage]

## Non-Functional Requirements

- [ ] CHK038 - Are accessibility requirements (WCAG 2.2 AA from the constitution, keyboard reachability, focus order, screen-reader labels for the reader and recorder) stated as functional requirements in the spec? [Gap, Constitution VI]
- [ ] CHK039 - Is reduced-motion behaviour specified per surface (reader scrolling, countdown, toasts, recording tally)? [Gap, Constitution V]
- [ ] CHK040 - Are browser support and the recording container per browser (WebM vs MP4/Safari) stated as requirements, with what happens on unsupported browsers? [Gap, plan §Technical Context]
- [ ] CHK041 - Are storage-quota thresholds (low-storage warning, safety stop) defined as numbers in the spec rather than only in code? [Clarity, Gap]
- [ ] CHK042 - Is the "no trackers / essential cookies only" constraint stated in the spec and linked to the cookies the app actually sets (locale, theme)? [Consistency, Constitution]

## Security & Privacy

- [ ] CHK043 - Is it decided whether the `/__mock` panel (which shows reset and invite links) is allowed in a public build, and how it is removed or locked before launch? [Risk, Gap, tasks T017]
- [ ] CHK044 - Are rate limiting / lockout requirements defined for sign-in, reset requests, invite checks and export (the `rate_limited` error exists without a rule)? [Gap, contracts §PortErrorCode]
- [ ] CHK045 - Is password re-confirmation required consistently for sensitive actions (export, delete, change password — and change email when it arrives)? [Consistency, Spec §FR-006, §FR-008]
- [ ] CHK046 - Is the legacy-scan consent requirement specific about what is read before and after consent on a shared computer? [Clarity, Spec §US8]

## Dependencies, Assumptions & Backend Handoff

- [ ] CHK047 - Does contracts/ports.md list every port method the UI now uses (including LegacyPort, savePosition, updateReading) with its HTTP endpoint and error codes? [Completeness, contracts]
- [ ] CHK048 - Is the Sanctum assumption (cookie auth, CSRF cookie, 419 handling) written as requirements for the HTTP adapter? [Assumption, Spec §Assumptions]
- [ ] CHK049 - Is conflict handling (version numbers, 409 with the server copy) specified on the API side so the editor's compare flow keeps working? [Dependency, Spec §FR-013]
- [ ] CHK050 - Are deferred items (phone remote G3, Tilw Plus G6) excluded explicitly from acceptance, including marketing links that still point to them? [Assumption, Spec §FR-043, §FR-044]

## Notes

- Check items off as `[x]` once the spec, plan, data model or contracts answer them; link the change.
- Items marked [Gap] need a new requirement or an explicit "out of scope" note; [Conflict] needs one source to change.
- `/speckit-implement` now checks this folder and will stop on unticked items before the next phase.
