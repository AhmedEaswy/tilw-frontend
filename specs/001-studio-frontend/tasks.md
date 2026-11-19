---
description: "Task list for Tilw Prompter Studio frontend (Phase 1)"
---

# Tasks: Tilw Prompter Studio — Frontend (Phase 1)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md),
[contracts/ports.md](./contracts/ports.md), [screens.md](./screens.md)

Format: `[ID] [P?] [Story] Description` — `[P]` = parallelisable. Figma node ids in brackets.
Paths are relative to `frontend/`. Each screen task ends with a visual check against its frame in ar (and en
where a frame exists).

## Phase 1: Setup
- [x] T001 Add deps: `@pinia/nuxt pinia @nuxtjs/i18n idb-keyval zod @vueuse/core @vueuse/nuxt`; dev: `vitest @nuxt/test-utils @vue/test-utils happy-dom @playwright/test`
- [x] T002 Configure `nuxt.config.ts`: modules, i18n (ar default rtl, en ltr, cookie strategy), `routeRules` (`/app/**` ssr:false; legal prerender), runtime config `servicesMode: 'mock'|'http'`, `nitro.preset: 'static'`, `public.contactEmail` (placeholder `contact@example.com`, G16); npm script `generate` verified to output a working static site with SPA fallback
- [x] T003 [P] `vitest.config.ts`, `playwright.config.ts`, npm scripts `test`, `test:e2e`, `typecheck`
- [x] T004 [P] `i18n/locales/ar.json`, `en.json` skeletons (common, nav, legal, auth, errors; each phase adds its own keys)

## Phase 2: Foundation (blocks all stories)
- [x] T010 Extract tokens from Figma `01 · Design system` [0:1] → `app/assets/css/tokens.css` (light/dark), `base.css`
- [x] T011 [P] UI kit in `app/components/ui/`: UiButton (5 Figma tones + icon), UiField (incl. password reveal, field icons), UiDialog (bottom sheet on phones), UiPills (filter tabs), UiSegmented, UiSwitch, UiStepper (replaces Slider, per Figma), UiToast + useToast, UiBanner, UiEmptyState, UiSkeleton, UiGlyph (33 Figma glyphs), BrandSignature, LocaleSwitch
- [x] T012 [P] Layouts: `auth`, `app` (top nav desktop / tab bar phone [6:18, 6:20]), `reader` (full-bleed)
- [x] T013 Ports + types `app/services/ports.ts`, `app/services/types.ts`; `PortError`
- [x] T014 Mock adapter `app/services/mock/` (db on localStorage, seed from Figma copy, latency/failure knobs, outbox)
- [x] T015 `app/plugins/services.ts` providing ports by runtime config
- [x] T016 Stores `auth`, `prefs`; `middleware/auth.global.ts` (auth + guest-only in one guard); theme + locale applied to `<html>`; Arabic default, English only by user choice (`plugins/locale.client.ts`)
- [x] T017 [P] `/__mock` panel page — kept in the static build (noindex) because it is the only way to receive reset/invite links in Phase 1
- [x] T018 [P] Utils: `text.ts` (words, paragraphs, duration), `files.ts` (TXT import/export), `mime.ts`

**Checkpoint**: shell renders, guarded routes redirect, locale/theme switch works. ✅ 2026-11-19 — verified on the static build (desktop + 375 px, ar, light/dark); 20 unit tests pass; e2e specs written, browsers not installed yet (`npx playwright install chromium`).

## Phase 3: US1 Auth & reset (P1) 🎯
- [x] T020 [US1] `/signin` [6:62, 6:100] with errors, return-path redirect
- [x] T021 [US1] `/forgot-password` [6:101] and `/forgot-password/sent` [6:102]
- [x] T022 [US1] `/reset-password?token=` new + confirm password, success → signed in, invalid/expired-link state with "request a new link" — **G2, approved: build from AuthFrame [6:62 / 6:100]**
- [x] T023 [P] [US1] `/waitlist` [6:63], `/waitlist/confirmed` [6:64]; wire landing join form to WaitlistPort
- [x] T024 [P] [US1] `/privacy` [6:81], `/terms` [6:82] — contact address from `public.contactEmail`, not the personal email in Figma (G16)
- [x] T025 [US1] Sign out (settings + phone) and 401 handling → sign-in with return path
- [x] T026 [US1] e2e (written in tests/e2e/auth.spec.ts; not run yet — needs `npx playwright install chromium`) `tests/e2e/auth.spec.ts`: sign in, wrong password, reset round-trip via outbox (valid + expired token), guard redirect

## Phase 4: US2 Invitation (P1) — G1 approved, built from AuthFrame

**Checkpoint US1+US2** ✅ 2026-11-19 — sign in (+ wrong password, return path), recovery → mock outbox → set new password → signed in, waitlist → confirmed, invite accept/invalid, sign out, legal pages; verified in the browser on the static build (desktop + 375 px, ar, light/dark). Landing "دخول", web-app and legal links now point to real routes; landing invite form posts to the waitlist port.
- [x] T030 [US2] Mock: `checkInvite` / `acceptInvite`, outbox entry when a waitlist email is "invited" from `/__mock`
- [x] T031 [US2] `/invite/[token]`: email shown read-only, name, password + confirm, terms/privacy checkbox → signed in → empty library [6:22] — **G1, AuthFrame [6:62 / 6:100]**
- [x] T032 [US2] Invalid / expired / already-used invite state with link to sign in and to the waitlist
- [x] T033 [US2] e2e (in tests/e2e/auth.spec.ts; not run yet): invite from `/__mock` → accept → empty library; expired invite

## Phase 5: US3 Library (P1) ★
- [x] T040 [US3] `scripts` store: list/filter/sort/search, optimistic pin/archive
- [x] T041 [US3] `/app/scripts` [6:18, 6:20, 6:83]: last-opened card, search, filter tabs, list
- [x] T042 [P] [US3] Empty library [6:22]
- [x] T043 [P] [US3] New script dialog [6:23, 6:84]
- [x] T044 [P] [US3] Import dialog [6:24, 6:85] incl. errors (G11)
- [x] T045 [P] [US3] Sort dialog [6:25]
- [x] T046 [US3] Actions sheet [6:108], rename [6:109], download TXT [6:110], duplicate; pinned [6:112], archived [6:111]
- [x] T047 [US3] e2e library flows (tests/e2e/library.spec.ts; not run yet)

**Checkpoint US3** ✅ 2026-11-19 — library verified on the static build at 1280 px and 375 px (ar, light): last-opened card, search (title + body, Arabic-normalised), filters, sort dialog, actions sheet (rename, duplicate, TXT download, pin, archive / restore), new and import dialogs, empty library. Decisions taken while building: row cover style is picked from the script id (scripts have no "subject" field yet); the actions sheet (6:108) is also used on desktop as a dialog; archived scripts get "إعادة من الأرشيف" (restore). Permanent delete (G9) is not built.

## Phase 6: US4 Editor (P1) ★
- [x] T050 [US4] `editor` store: working copy, debounced autosave, version, local draft, undo/redo
- [x] T051 [US4] `/app/scripts/[id]` [6:19, 6:21, 6:86]: title, body, live counts, duration, save status
- [x] T052 [US4] Writing tools: search in text, undo/redo, download
- [x] T053 [US4] Delivery marks (emphasis/pause/note) — **visual per G7, interim from landing style**
- [x] T054 [US4] Conflict compare [6:72] + confirm replacement [6:73]
- [x] T055 [US4] e2e: edit → saved; forced conflict → choose account copy (tests/e2e/editor.spec.ts; not run yet)

**Checkpoint US4** ✅ 2026-11-19 — editor verified on the static build (desktop + 375 px): typing autosaves ("حُفظ في حسابك"), current-paragraph highlight, word/paragraph count and reading time, delivery marks (emphasis, pause chip, note), search with match count, undo/redo, TXT download, local draft recovery, and both conflict paths (6:72 → use account copy via 6:73, or save my edits as a new script). Delivery-marks panel is an interim design (G7): emphasis = apricot highlight, pause = dashed "/ 2 ث" chip above the text, note = dotted underline with tooltip.

## Phase 7: US5 Rehearsal (P1) ★
- [x] T060 [US5] `useReaderEngine` (WPM scroll on rAF, manual stepping, measurement, position save)
- [x] T061 [US5] `/app/scripts/[id]/rehearse` paused/playing [6:26, 6:27, 6:31, 6:32, 6:87–6:90]
- [x] T062 [US5] Reading settings panel [6:28, 6:29] + phone sheet [6:33, 6:34] + tablet/landscape/320 [6:36, 6:37, 6:105, 6:106]
- [x] T063 [US5] More controls [6:30, 6:35, 6:107]: line width, countdown, shortcuts (save to account); text direction saves to the script (G15)
- [x] T064 [US5] `useShortcuts` Space / Esc / arrows
- [x] T065 [US5] Recovery [6:79] + choose paragraph [6:80]
- [x] T066 [US5] End-of-script state (G12)
- [x] T067 [US5] Unit tests for engine timing; e2e play/pause/settings persistence (tests/unit/reader.test.ts; tests/e2e/rehearsal.spec.ts written, not run yet)

**Checkpoint US5** ✅ 2026-11-19 — rehearsal verified in the browser on the dev server (1280 px, 390 px, 320 px; ar, dark system theme): constant mode measured at 120.1 WPM in the page (target 120 ±5%), 3-2-1 countdown, Space play/pause, arrows step paragraphs (follow script direction), docked settings panel (6:28) and phone sheet (6:33), more controls (6:30), reading settings and direction persist after reload, position saved and restored, recovery (6:79 → 6:80) via the `/__mock` "Reading position saves fail" knob, end state (G12). Deviations logged in gaps.md. Not checked: tablet / landscape frames (6:36, 6:37) beyond the responsive CSS, English frames (6:87–6:99), light theme.

## Phase 8: US6 Recording (P2) ★
- [x] T070 [US6] Composables `useMediaDevices`, `useLevelMeter`, `useRecorder` (mime pick, 10-min cap, quota, interruption)
- [x] T071 [US6] Studio shell + mode switch; camera before permission [6:38, 6:40], audio before permission [6:50, 6:52]
- [x] T072 [US6] Camera preview + devices [6:39, 6:41]; audio sound check [6:51, 6:53]
- [x] T073 [US6] Permission denied [6:78] (+ desktop variant, G12)
- [x] T074 [US6] Countdown [6:42, 6:54, 6:43, 6:55]
- [x] T075 [US6] Recording with prompter overlay [6:44, 6:56, 6:45, 6:57]; auto-stop/partial states (G8)
- [x] T076 [US6] `takes` store on IndexedDB

**Checkpoint US6** ✅ 2026-11-19 — studio verified in the browser on the dev server (1280 px and 390 px, ar, dark system theme). Setup layout matches 6:38 to the pixel (viewfinder 690×391 at 54,210; side panel 451 px). Real camera access is blocked inside the Claude browser pane, so the denied state (6:78, desktop per G12) was checked with the real API, and preview → countdown → capture → save was checked with a synthetic canvas + oscillator stream: a 12 s video take saved as WebM (VP9/Opus, 1.4 MB) in IndexedDB; an audio take cut off by ending the track saved as a 2.5 s partial (`endedBy: interrupted`) with its toast. Not checked with a real camera, in Safari (MP4 path), or the 10-minute and storage-full stops beyond unit tests. e2e spec `tests/e2e/recording.spec.ts` uses Chromium's fake devices (not run yet). After saving, the studio goes to `/app/recordings`, which is still the placeholder until T080.

## Phase 9: US7 Recordings (P2) ★
- [ ] T080 [US7] `/app/recordings` [6:74, 6:103], first visit [6:77], quota banner (G8)
- [ ] T081 [US7] `/app/recordings/[takeId]` video review [6:46, 6:47], audio review [6:58, 6:75, 6:59]
- [ ] T082 [US7] Download original + confirmation states [6:48, 6:60, 6:76, 6:49, 6:61]
- [ ] T083 [US7] Take actions: star / delete (G8, pending design)

## Phase 10: US8 Settings (P2) ★
- [ ] T090 [US8] `/app/settings` [6:65, 6:104]: language, theme, account, reading settings (same account-wide values rehearsal edits, G15), links, sign out
- [ ] T091 [US8] Export: confirm password [6:66] → handoff [6:67]
- [ ] T092 [US8] Legacy recovery: consent [6:68] → choose [6:69] → confirm [6:70, 6:71]
- [ ] T093 [US8] `/app/settings/account`: edit name, change password (current + new + confirm) — **G5, approved: AuthFrame fields inside settings layout [6:65 / 6:104]**; email shown read-only until backend
- [ ] T094 [US8] Delete account: danger zone row in settings → `/app/settings/delete` confirm password + explain what is removed (account, scripts) and what stays (browser recordings) → done screen → signed out to landing — **G4, approved; follows export pattern [6:66 → 6:67]**
- [ ] T095 [US8] Mock: `changePassword`, `deleteAccount`; e2e for both flows

## Phase 11: US9 Public & polish (P3)
- [ ] T100 [P] `/demo` reader demo [6:6–6:17] reusing reader engine
- [ ] T101 [P] `/contact` [6:5] — shows `public.contactEmail` placeholder; form validates only (static build, no sending) (G16)
- [ ] T102 English pass across all routes; RTL/LTR mixed-text checks
- [ ] T103 Responsive pass (320, 390, 768, landscape, desktop); reduced-motion; axe checks
- [ ] T104 System states: offline, save failed, session expired, 404, error page (G10)
- [ ] T105 Landing CTAs point to `/signin`, `/waitlist`, `/demo`

## Dependencies
Setup → Foundation → US1 → (US3 → US4 → US5 → US6 → US7) ; US8 after US1 ; US9 after US5.
US2 after G1 decision. Phone remote (G3) and Tilw Plus (G6) are **deferred** (owner, 2026-11-19).
