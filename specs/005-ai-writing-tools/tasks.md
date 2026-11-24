---
description: "Task list for Web app — AI writing tools (release 2)"
---

# Tasks: Web app — AI writing tools (release 2)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ports.md](./contracts/ports.md), [quickstart.md](./quickstart.md), Figma frames in [gaps.md](./gaps.md). Backend counterpart: `backend/specs/004-ai-writing-tools` (merged; `contracts/openapi.yaml` 4.0.0 and `contracts/device-flows.md`).

**Tests**: Included (constitution VI). Vitest for the framework-free logic and one port contract suite (`tests/unit/ai-ports.test.ts`) run against the mock and the HTTP adapter (fake fetch); a Playwright flow per story against the mock.

**Conventions**:
- Format: `[ID] [P?] [Story] Description`. `[P]` means the task can run in parallel.
- Figma frames are named by their gaps.md row (A1–A7, page `09 · Release 2 · AI writing tools`, file `t9xEIr22yKOj7o2Ft32hxb`).
- Paths are relative to `frontend/`.
- **Phone-link code (`services/link/*`, `components/link/*`, `pages/remote.vue`) is not changed.** Reading surfaces (rehearse, record) are not changed.
- Each screen task ends with a visual check against its frame in Arabic, plus English via the locale files.

## Phase 1: Setup

- [X] T001 Draw frames A1–A7 on a new Figma page `09 · Release 2 · AI writing tools`, from page `01 · Design system` and matching pages 07–08 (Arabic desktop light first, then phone A7). Record each node id in `specs/005-ai-writing-tools/gaps.md`. **No screen task (T020 onward) starts before its frame exists** (constitution II). *(Drawn on page `292:100`; node ids in gaps.md.)*
- [ ] T002 [P] Add the i18n group `ai.*` (format, credits, key, speech, captions, errors) and `limits.dialog.credits*`, `limits.dialog.byok*`, `limits.dialog.audio*` to `i18n/locales/ar.json` and `i18n/locales/en.json` (each story fills its keys).

## Phase 2: Foundation (blocks all stories)

- [ ] T003 Add the types in data-model.md to `app/services/types.ts`; add `own_key_refused` and `ai_unavailable` to `PortErrorCode`; give `PortError` a 5th `info` argument (`balance`, `cost`, `reason`, `retryAfter`).
- [ ] T004 Add `AiPort` and `SpeechPort` to `app/services/ports.ts` as in contracts/ports.md, and `ai`, `speech` to `Services`.
- [ ] T005 `app/services/http/client.ts`: the two new codes in `CODES`; `toPortError` reads `balance`, `cost`, `reason` from the body and `Retry-After` from the headers into `info`. Fallback texts in `app/composables/useErrorText.ts`.
- [ ] T006 [P] `app/services/ai/deepgram.ts`: parse a Deepgram answer (`metadata.request_id`, `metadata.duration`, paragraphs transcript with fallback, `detected_language`, words from utterances or the alternative, utterance boundaries). `app/services/ai/speech.ts`: `createSpeech({ fetch })` → `SpeechPort` (POST to `upload.url` with `upload.headers` and the blob's type; `fake` provider answers from `fakeSpeech()` without uploading, research R2).
- [ ] T007 [P] `app/services/ai/transcribe.ts`: `runTranscription({ ai, speech, blob, seconds, language, purpose, onStep, signal })` → `{ transcription, result }`; reports the request id with `complete`, calls `fail` on an upload/provider error and rethrows; refuses to upload after `upload.expiresAt` (calls `fail('expired')`, spec edge case). `app/services/ai/audio.ts`: `checkAudio(file, seconds, maxMinutes)` (audio or allowed video type, ≤ 200 MB, ≤ limit) and `creditsForSeconds`, `creditsForWords`.
- [ ] T008 [P] `app/services/ai/errors.ts`: `describeAiError(e)` → `{ kind, title, text, params }` for credits limit, byok limit, audio limit, own key refused, changed words, unavailable (with wait), rate limited, suggestion gone; `utils/limits.ts`: `ai.credits_monthly`, `byok.allowed` and `ai.audio_max_minutes` become known limits with their dialog copy.
- [ ] T009 Mock AI backend `app/services/mock/ai.ts` (KV `tilw:mock:ai:v1`): ledger with lazy month start, charges/refunds/own-key/overrun entries, balance (may be negative, refuses charges below cost), suggestions (one per script, 24 h, word-preserving fake formatter, research R9), apply through a versioned save hook, permissions (issue, complete with `fake-<n>`, `fake-failed`, refusal of untagged ids, fail = no refund, expiry settlement), own key (validation, refused knob, masked answers, 60 an hour), knobs and grant/setBalance controls. Add `ai.audio_max_minutes` (60/60) to `services/mock/plans.ts`.
- [ ] T010 Wire `ai` and `speech` in `app/services/mock/index.ts` (apply = versioned save that snapshots an `ai` version; read-only scripts refused; `MockBackend.ai` controls) and `app/services/http/index.ts` (routes in contracts/ports.md; `suggestion` maps 404 to null; `speech` = `createSpeech`).
- [ ] T011 [P] Contract suite `tests/unit/ai-ports.test.ts` for both adapters: estimate → format → suggestion → apply (history `ai`) / discard; conflict on apply; credits after charge and refund; key save masked, check, delete; transcription estimate → start → complete settles; untagged id refused; and **no request to the Tilw API carries audio or transcript text** (HTTP, SC-002).
- [ ] T012 [P] Unit tests `tests/unit/ai-logic.test.ts`: Deepgram parsing, `runTranscription` (ok, upload failure calls fail, empty transcript), `checkAudio`, `describeAiError`, mock ledger rules (month start, overrun below zero blocks charges, own key entry 0).
- [ ] T013 `app/stores/ai.ts` (data-model) and `/__mock` knobs in `app/pages/__mock.vue`: AI formatting mode, own key refused, speech mode, grant 50 credits, set balance, expire suggestion, and `ai.bumpScript(scriptId)` (an edit from another device, for the apply conflict).

**Checkpoint**: ports, adapters, logic and store are tested; no screen yet.

## Phase 3: User Story 1 — Format my script for reading aloud (P1) 🎯 MVP

- [ ] T014 [P] [US1] e2e `tests/e2e/ai-format.spec.ts`: cost shown, format, preview has the same words, apply → editor text, History "AI change", balance 18; discard leaves the script; changed words message; conflict on apply (`ai.bumpScript` mock control); empty script disabled; axe on the drawer.
- [ ] T015 [US1] `app/components/ai/MarkedPreview.vue`: paragraphs with pause, emphasis and note marks in the reader's look (A2 preview), direction per script.
- [ ] T016 [US1] `app/components/ai/FormatDrawer.vue` (A2): cost state (credits / own key / not enough / negative / read-only / empty), formatting progress (polite live region; may close), preview with Show original, Apply / Discard, conflict (Format again / Discard), every error of `describeAiError` with its actions (Use Tilw credits this time, Check my key, AI & credits, Upgrade).
- [ ] T017 [US1] `WritingTools.vue` + editor page (A1): "Format for reading" item with cost hint and "suggestion waiting" chip; editor loads the waiting suggestion on open; pending edits saved before format and apply; apply adopts the returned script like a restore.

## Phase 4: User Story 2 — See my credits and where they went (P1)

- [ ] T018 [P] [US2] e2e `tests/e2e/ai-credits.spec.ts`: balance 20, entries after a format and a refund, negative banner after a mock overrun, Settings row and Plan & usage rows; axe.
- [ ] T019 [US2] `CreditsCard.vue`, `CreditEntries.vue`, page `app/pages/app/settings/ai.vue` (A6): balance, monthly, granted, renewal, entries (kind, capability, amount, status, refund link, grant end), negative banner; Settings index row with the balance; Plan & usage shows `ai.credits_monthly`, `byok.allowed` and `ai.audio_max_minutes` as limits (remove "coming soon").

## Phase 5: User Story 3 — Turn speech into script text (P2)

- [ ] T020 [P] [US3] e2e `tests/e2e/ai-speech.spec.ts`: dictate with the fake microphone → cost → text inserted at the caret, balance reduced; new from audio with a generated WAV → Save as new script; a file too large refused before any call; speech failure message; axe.
- [ ] T021 [US3] `useAudioLength.ts`, `useDictation.ts` (research R3, R10) and `app/components/ai/TranscribePanel.vue` (cost, language, own-key note, steps, result/failure).
- [ ] T022 [US3] `DictateDialog.vue` (A3) in the editor (Dictate item hidden without MediaRecorder; insert at caret as one undo step) and `AudioImportDialog.vue` (A4) on the library page ("New from audio").

## Phase 6: User Story 4 — Use my own AI key (P2)

- [ ] T023 [P] [US4] e2e `tests/e2e/ai-key.spec.ts`: save → masked, key field cleared, never in storage; format uses own key (no credits, own-key entry); refused on save; refused on use → Use Tilw credits this time; delete → credits again; locked when `byok.allowed` is off; axe.
- [ ] T024 [US4] `app/components/ai/OwnKeyCard.vue` (A6 key states) on AI & credits: provider choice, password-type field, save/check/replace/delete (confirm), locked by plan, "not used on your plan".

## Phase 7: User Story 5 — Captions from a take (P3)

- [ ] T025 [P] [US5] Unit tests `tests/unit/ai-captions.test.ts` for `buildCues`, `toSrt`, `toVtt` (≤ 2 × 42, 1–7 s, gaps > 1 s, utterance breaks, long words, Arabic, no overlap, min-duration extension) and e2e step in `tests/e2e/ai-speech.spec.ts` (captions on a take, both downloads).
- [ ] T026 [US5] `app/services/ai/captions.ts` and `CaptionsDialog.vue` (A5) on `app/pages/app/recordings/[takeId].vue` (device or Drive take; length from the take; downloads named after the take).

## Phase 8: Polish

- [ ] T027 [P] Docs: README pointer to this feature, quickstart check, `specs/005-ai-writing-tools/gaps.md` final notes.
- [ ] T028 Run `npx vitest run`, `npx nuxi typecheck` and the full Playwright suite on port 3140; fix what fails.

## Dependencies

- T001 before T015 onward (frames first). T003–T005 before T006–T013. T009–T010 before T011. T013 before every story.
- US1 and US2 are independent after the foundation; US3 needs T007; US5 needs US3's `TranscribePanel` (T021); US4 is independent.
- Within a story, write the e2e first and see it fail.

## Parallel example

After T013: T014, T018, T020, T023 and T025 (tests) can be written together; T015 and T019 touch different files.

## Implementation strategy

MVP = Phases 1–3 (formatting with the cost line). Then US2 (credits), US4 (own key), US3 (speech), US5 (captions). Commit per user story.
