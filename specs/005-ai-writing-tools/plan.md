# Implementation Plan: Web app — AI writing tools (release 2)

**Branch**: `005-ai-writing-tools` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md); backend feature `004-ai-writing-tools`, merged in the backend `main` ([openapi.yaml](../../../backend/specs/004-ai-writing-tools/contracts/openapi.yaml) 4.0.0, [device-flows.md](../../../backend/specs/004-ai-writing-tools/contracts/device-flows.md), [data-model.md](../../../backend/specs/004-ai-writing-tools/data-model.md)); Figma frames listed in [gaps.md](./gaps.md).

## Summary

The work adds the AI writing tools to the web app without changing the release-1 reading surfaces:

- **Format for reading** in the editor's writing tools: cost, progress, a preview drawer in the reader's look, apply (versioned save with an `ai` history version) and discard, with every error answer of the contract.
- **Dictate** in the editor and **New from audio** in the library: the browser records or reads an audio file, gets a paid permission, sends the audio **straight to the speech provider**, reports the request id, and puts the text in the editor or a new script.
- **Captions** on a take's page: the same permission flow with `purpose: captions`, then SRT and VTT built in the browser from word timings.
- **Settings → AI & credits**: balance (may be negative), monthly amount, grants, renewal, this month's entries, and the own text key (save, check, replace, delete, locked by plan).

Two new ports (constitution III): `AiPort` (every backend 004 route the owner calls) and `SpeechPort` (the browser → provider upload). The HTTP adapter maps the routes and uploads to Deepgram with `fetch`; the mock adapter keeps a ledger, suggestions and permissions in `localStorage` and answers speech with a fake transcript. Framework-free logic lives in `app/services/ai/`: the transcription run, the Deepgram answer parser, the caption builder and the error mapping. Decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5, Nuxt 4.6 (unchanged)

**Primary Dependencies**: existing only (`pinia`, `@nuxtjs/i18n`, `@vueuse/core`, `idb-keyval`). No new package: Deepgram is called with `fetch` (R1), captions are built by hand (R5).

**Storage**: server state only (Pinia). The speech language choice is kept in `localStorage['tilw:ai:language']`. Mock: KV key `tilw:mock:ai:v1` (ledger, suggestions, permissions, key, knobs). No audio, transcript or key is ever stored by the web app.

**Testing**:

- Vitest: caption builder (rules on Arabic and English word sets), Deepgram answer parsing, the transcription run (estimate → permission → upload → complete / fail) against a fake speech port, error mapping, the mock ledger rules (charge, refund, overrun, own key, month start), and one port contract suite run against the mock and the HTTP adapter (fake fetch). The HTTP suite asserts that no request to the Tilw API carries audio or transcript text (SC-002).
- Playwright flows per story against the mock (fake microphone flag for dictation, a generated WAV for file upload).
- `test:live` gains the AI routes when the backend runs with `AI_FAKE=true`.

**Target Platform**: evergreen browsers, desktop and phone. Dictation needs `MediaRecorder`; where it is missing the action is hidden and file upload stays.

**Project Type**: web application (static Nuxt build), frontend repository only

**Performance Goals**: the cost shows within 1 s of opening a panel (one estimate call); formatting shows progress immediately and lets the person leave; the preview drawer opens without layout shift in the editor; uploads report progress.

**Constraints**:

- No audio and no transcript text to the Tilw API (constitution IV, backend FR-008). Only `seconds`, `bytes`, `mimeType`, `language`, `purpose`, `requestId` and `reason` are sent.
- The key field is cleared after save and never kept in a store, the draft, or storage (SC-003).
- Reading surfaces (rehearse, record) don't change.
- Every new string in Arabic and English.

**Scale/Scope**: 1 new settings route (`/app/settings/ai`), 6 new components, 1 new store, 2 new ports, about 8 changed files (editor page, writing tools, library page, take page, settings index, plan page, `utils/limits.ts`, `/__mock`).

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1.* Constitution v1.1.0.

| Principle | How the plan satisfies it | Result |
|---|---|---|
| I. Arabic-first, bilingual | All copy in `i18n/locales/{ar,en}.json` under `ai.*`; logical CSS; previews keep the script's direction; captions keep Arabic text as is (device-flows §2.5). | Pass |
| II. Figma is the source of truth | Frames for the format drawer, dictation, new from audio, captions and AI & credits are drawn on page `09 · Release 2 · AI writing tools` from the design system **before** any screen task (first tasks in tasks.md), listed with node ids in [gaps.md](./gaps.md). | Pass, with that task first |
| III. Swappable data port | `AiPort` and `SpeechPort` have mock and HTTP adapters and one contract suite. Stores and components never call `fetch`; only `services/http/index.ts` and `services/ai/speech.ts` do. | Pass |
| IV. Recordings never touch Tilw's servers | Dictation and take audio go from the browser to the speech provider with the service's permission; the Tilw API sees lengths and ids only. Microphone asked only on Dictate. Tested in the HTTP adapter suite. | Pass |
| V. Calm reading surfaces | Nothing changes on rehearse or record. Formatting happens in the editor; the preview is a drawer. | Pass |
| VI. Accessible and testable | Each story has a Playwright flow on the mock and axe on its screens; progress and results go through a polite live region; all actions keyboard-reachable. | Pass |

**Result**: PASS. Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/005-ai-writing-tools/
├── spec.md, checklists/
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: types, store, mock state
├── contracts/ports.md   # Phase 1: port delta (AiPort, SpeechPort)
├── quickstart.md        # Phase 1
├── gaps.md              # Figma frames + gaps found while building
└── tasks.md             # /speckit-tasks
```

### Source Code (changes in `frontend/`)

```text
app/
├── services/
│   ├── ports.ts                 # + AiPort, SpeechPort; Services + ai, speech
│   ├── types.ts                 # + FormatEstimate, Suggestion, Credits, CreditEntry, OwnKey, Permission, …;
│   │                            #   PortErrorCode + own_key_refused, ai_unavailable; PortError + info
│   ├── ai/
│   │   ├── captions.ts          # cue builder, SRT, VTT (device-flows §2)
│   │   ├── deepgram.ts          # answer parsing (transcript, language, words, request id)
│   │   ├── speech.ts            # SpeechPort over fetch (deepgram) and the fake provider
│   │   ├── transcribe.ts        # the run: estimate → permission → upload → complete / fail
│   │   ├── errors.ts            # PortError → what to say (i18n keys + params)
│   │   └── audio.ts             # file checks (type, size, length) before any call
│   ├── http/
│   │   ├── client.ts            # + new codes; PortError info (balance, cost, reason, Retry-After)
│   │   └── index.ts             # + ai routes, speech
│   └── mock/
│       ├── ai.ts                # ledger, suggestions, permissions, key, fake formatter, knobs
│       ├── plans.ts             # + ai.audio_max_minutes
│       └── index.ts             # + ai, speech; versioned apply with an `ai` version
├── stores/ai.ts                 # credits, key, estimates, suggestion per script, formatting state
├── composables/
│   ├── useAudioLength.ts        # duration of a Blob/File through an <audio> element
│   └── useDictation.ts          # microphone + recorder for dictation (reuses useMediaDevices/useRecorder)
├── components/ai/
│   ├── FormatDrawer.vue         # cost, progress, preview, conflict, errors
│   ├── MarkedPreview.vue        # paragraphs with pause / emphasis / note marks
│   ├── TranscribePanel.vue      # cost + language + progress + result (shared by dictate, file, captions)
│   ├── DictateDialog.vue
│   ├── AudioImportDialog.vue
│   ├── CaptionsDialog.vue
│   ├── CreditsCard.vue, CreditEntries.vue, OwnKeyCard.vue
├── pages/app/settings/ai.vue    # AI & credits
├── components/editor/WritingTools.vue   # + Format for reading, Dictate
├── pages/app/scripts/[id]/index.vue     # + drawer, dictate, insert at cursor
├── pages/app/scripts/index.vue          # + New from audio
├── pages/app/recordings/[takeId].vue    # + Captions
├── pages/app/settings/index.vue, plan.vue
├── utils/limits.ts              # ai.credits_monthly, byok.allowed, ai.audio_max_minutes become known
└── pages/__mock.vue             # + AI knobs
i18n/locales/{ar,en}.json        # + ai.*
tests/unit/ai-*.test.ts, tests/e2e/ai-*.spec.ts
```

**Structure Decision**: the existing single Nuxt app; the new area follows the phone-link layout (ports → adapters → `services/<area>/` → store → components).

## Complexity Tracking

No constitution violations.
