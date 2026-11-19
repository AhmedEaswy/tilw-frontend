# Implementation Plan: Tilw Prompter Studio — Frontend (Phase 1)

**Branch**: `main` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Summary

Build the authenticated studio app in the existing Nuxt 4 project next to the landing page. All data goes
through typed ports with a mock adapter (browser persistence, seeded data, simulated latency/errors) so the
Laravel API can be plugged in later. Recordings use MediaRecorder + IndexedDB and never leave the device.
Screens are implemented group by group from Figma, in the owner's order (★ in [screens.md](./screens.md)),
after the design-system tokens and app shell.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5, Nuxt 4.6

**Primary Dependencies**: `pinia` + `@pinia/nuxt` (state), `@nuxtjs/i18n` (ar default RTL, en),
`idb-keyval` (IndexedDB for takes), `zod` (form + port payload validation), `@vueuse/core` (keyboard,
media, storage helpers). No UI framework; plain CSS with tokens.

**Storage**: Mock server state in `localStorage` (namespaced `tilw:mock:*`); takes in IndexedDB;
UI prefs (theme, locale) in a cookie so SSR pages render the right theme/locale.

**Testing**: Vitest + `@nuxt/test-utils` for stores, ports and components; Playwright for the user-story
flows against the mock adapter.

**Target Platform**: Evergreen browsers (Chrome/Edge/Safari/Firefox, last 2), desktop and mobile, 320 px up.
Installable later as PWA (out of scope now).

**Delivery**: Static site. `nuxt generate` (Nitro `static` preset) outputs plain HTML/JS/CSS to
`.output/public`, deployable to any static host. No server routes, no SSR at runtime: marketing and legal
pages are prerendered; `/app/**` pages are prerendered as client-rendered shells. Dynamic segments
(`/app/scripts/:id`, `/invite/:token`) resolve on the client, so the host needs an SPA fallback to
`200.html` (or `404.html`) for unknown paths.

**Deferred (owner, 2026-11-19)**: phone remote (G3) and Tilw Plus (G6) — no code paths, no in-app entry points.

**Project Type**: Web application, frontend only (backend repo exists but is not touched in Phase 1).

**Performance Goals**: Reader 60 fps; first app route interactive < 2.5 s on 4G; autosave ≤ 2 s.

**Constraints**: Recording ≤ 10 min per take; no trackers; RTL-correct; reduced motion respected.

**Scale/Scope**: ~30 routes/states for Phase 1, ~95 Figma frames incl. responsive and English variants.

## Constitution Check

| Principle | How the plan satisfies it |
|---|---|
| I. Arabic-first bilingual | `@nuxtjs/i18n` with `ar` default (`dir=rtl`), all copy in `i18n/locales/{ar,en}.json`, logical CSS only |
| II. Figma is source of truth | Tokens from page `01 · Design system` → `tokens.css`; each screen task cites its node id; gaps logged |
| III. Swappable data port | `app/services/ports/*.ts` interfaces; `mock/` adapter now, `http/` adapter later; provided via a Nuxt plugin |
| IV. Recordings stay on device | `useTakesStore` writes only to IndexedDB; no upload code path exists |
| V. Calm reading surface | Reader uses `transform` scrolling on rAF, keyboard map, no layout shift, `prefers-reduced-motion` |
| VI. Accessible & testable | Each story has a Playwright spec; axe check in CI on key routes |

**Result**: PASS — no violations.

## Architecture

```text
Pages (routes)  ──►  Feature components  ──►  Pinia stores  ──►  Ports (interfaces)
                                                                   ├── mock adapter (Phase 1)
                                                                   └── http adapter  (Laravel, later)
Media: composables (useMediaDevices, useRecorder, useLevelMeter) ──► takes store ──► IndexedDB
```

- **Auth**: `useAuthStore` (user, status). Global route middleware `auth` guards `/app/**`; `guest`
  middleware bounces signed-in users from auth pages. Mock issues a session in `localStorage`; HTTP will use
  Sanctum cookies (`/sanctum/csrf-cookie`, then `/login`).
- **Rendering**: `routeRules: { '/app/**': { ssr: false } }`; marketing and legal pages prerendered;
  whole site built with `nuxt generate` (static, no backend).
- **Mock adapter**: seeded user `layan@example.com` / `password123`, three scripts from Figma
  ("افتتاحية الحلقة", "وراء الكواليس", "رسالة إلى المستمع"), one legacy browser script set, a dev-only
  `/__mock` panel to toggle latency, failures, conflicts, expired tokens, and to print the last "email"
  (reset/invite links) since no mail is sent.
- **Editor**: `contenteditable`-free approach — a `<textarea>`-backed model for body + a marks layer
  (ranges) rendered in preview/reader. Autosave debounced 800 ms with `version` for conflict detection.
- **Reader**: virtualised paragraph list, `translateY` driven by WPM × words-per-line measurement; manual
  mode snaps per paragraph; position saved every 5 s and on pause.
- **Recorder**: `getUserMedia` per mode, `MediaRecorder` with best supported mime
  (`video/mp4` on Safari, `video/webm;codecs=vp9,opus` elsewhere), chunks to memory then one Blob to IndexedDB,
  `navigator.storage.estimate()` for quota banner.

## Project Structure

### Documentation (this feature)

```text
specs/001-studio-frontend/
├── spec.md          # what & why
├── screens.md       # Figma frame → route/state map
├── flow.md          # app flow diagrams (mermaid)
├── gaps.md          # missing pieces & decisions needed
├── plan.md          # this file
├── data-model.md    # entities & state
├── contracts/ports.md   # service port contracts (mock + future HTTP)
└── tasks.md         # ordered, story-grouped tasks
```

### Source Code (frontend/)

```text
app/
├── app.vue
├── assets/css/
│   ├── tokens.css            # from Figma 01 · Design system
│   ├── base.css              # reset, typography, logical spacing
│   └── landing.css           # existing
├── components/
│   ├── ui/                   # Button, Field, Dialog, Sheet, Tabs, Segmented, Switch, Slider, Toast, Banner
│   ├── shell/                # AppTopNav, AppTabBar, BrandSignature
│   ├── auth/                 # AuthFrame, PasswordField
│   ├── scripts/              # ScriptCard, LastOpenedCard, FilterTabs, dialogs, ActionsSheet
│   ├── editor/               # EditorCanvas, WritingTools, MarksPopover, ConflictCompare
│   ├── reader/               # ReaderSurface, ReaderControls, SettingsPanel, MoreControls, RecoveryDialog
│   ├── studio/               # ModeSwitch, PermissionCard, DevicePicker, LevelMeter, Countdown, RecordBar
│   └── recordings/           # TakeList, TakePlayer, DownloadNotice
├── composables/              # useMediaDevices, useRecorder, useLevelMeter, useReaderEngine, useShortcuts
├── layouts/                  # default (marketing), auth, app, reader (full-bleed)
├── middleware/               # auth.global.ts, guest.ts
├── pages/
│   ├── index.vue, demo.vue, contact.vue, privacy.vue, terms.vue
│   ├── signin.vue, waitlist/{index,confirmed}.vue
│   ├── forgot-password/{index,sent}.vue, reset-password.vue, invite/[token].vue
│   └── app/
│       ├── index.vue                       # → /app/scripts
│       ├── scripts/index.vue
│       ├── scripts/[id]/index.vue          # editor
│       ├── scripts/[id]/rehearse.vue
│       ├── scripts/[id]/record.vue
│       ├── recordings/index.vue, recordings/[takeId].vue
│       └── settings/{index,export,recover,account,delete}.vue
├── plugins/services.ts       # provides ports (mock | http by runtime config)
├── services/
│   ├── ports/                # auth.ts, scripts.ts, account.ts, waitlist.ts, legacy.ts
│   ├── mock/                 # implementations + seed.ts + db.ts
│   └── http/                 # (later) Laravel adapter
├── stores/                   # auth, scripts, editor, reader, takes, prefs
└── utils/                    # text (words, paragraphs, duration), files (txt import/export), mime
i18n/locales/{ar,en}.json
tests/{unit,e2e}/
```

**Structure Decision**: Single Nuxt app in `frontend/` holding both marketing and studio; the landing's
existing `app/landing/*` scripts stay isolated to `pages/index.vue`.

## Phasing (delivery order)

0. Tokens + base components + layouts + i18n + ports/mock + auth middleware.
1. Auth (US1) incl. set-new-password (G2) + invite acceptance (US2, G1) + waitlist + legal.
2. Library (US3) ★ → Editor (US4) ★ incl. conflict.
3. Rehearsal + reading settings + recovery (US5) ★.
4. Studio camera/audio → review → download (US6) ★, recordings library (US7) ★.
5. Settings, export, legacy recovery (US8) ★, then account edit (G5) and delete account (G4).
6. Demo, contact, English pass, responsive pass (320 / phone / tablet / landscape).
7. Remaining gap screens once decided (G7–G16). G1, G2, G4, G5 are scheduled in steps 1 and 5; G3 and G6 are deferred.

## Complexity Tracking

None.
