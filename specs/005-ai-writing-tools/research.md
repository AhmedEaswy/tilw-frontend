# Research: Web app — AI writing tools

## R1. Uploading to Deepgram from the browser

- **Decision**: `fetch(upload.url, { method: 'POST', headers: upload.headers, body: blob })` with `Content-Type` = the blob's type, from `services/ai/speech.ts`. No SDK. Progress is "sending" / "writing text" (fetch has no upload progress); an `AbortController` cancels.
- **Rationale**: device-flows §1 gives the URL and headers ready to use; the Deepgram SDK would add weight for one request. The query string is not touched (it carries the tag, model, language and privacy opt-out).
- **Alternatives**: `XMLHttpRequest` for upload progress (rejected for now: dictation clips are small; a 200 MB file shows an indeterminate bar); Deepgram JS SDK (rejected: size, and it wants a key).

## R2. The fake provider (backend `AI_FAKE=true` and the mock)

- **Decision**: when `upload.provider === 'fake'`, `SpeechPort.send` doesn't upload. It returns a fake answer built by `fakeSpeech(seconds, purpose, language)`: request id `fake-<seconds>`, a fixed bilingual transcript, and words spaced over the length for captions. The mock adapter uses the same fake; its knobs can turn the id into `fake-failed`, an empty transcript, or an overrun (`fake-<3 × seconds>`).
- **Rationale**: one code path for tests against the mock, the backend in fake mode, and the real provider.

## R3. Measuring audio length

- **Decision**: `useAudioLength(blob)` loads the blob in a detached `<audio>` (`preload=metadata`) and reads `duration`. For `Infinity` (MediaRecorder WebM without duration) it seeks to a large time to force the browser to compute it; on failure it falls back to the recorder's own clock (dictation) or refuses ("can't read this file's length") for uploaded files. Seconds are rounded **up**.
- **Rationale**: device-flows §1 asks for the device's length rounded up; overruns are charged in full, so honest measurement matters.

## R4. Where the text goes

- **Decision**: dictation inserts at the editor's caret (replacing a selection) through `editor.setContent` as one undo step, with a newline between paragraphs. New from audio shows the text in the dialog and creates a script only on **Save as new script** (`ScriptsPort.create`). Nothing else is sent to Tilw.
- **Rationale**: device-flows §1 "only if the person saves it".

## R5. Captions

- **Decision**: `buildCues(words, { maxChars: 42, maxLines: 2, maxSeconds: 7, minSeconds: 1, maxGap: 1 }, utteranceBreaks, audioEnd)` in `services/ai/captions.ts`, then `toSrt` / `toVtt`. Lines are balanced at the space nearest the middle that keeps both ≤ 42; a single long word gets its own line. Downloads go through `downloadBlob` with `text/plain` (SRT, `application/x-subrip` is unreliable) and `text/vtt`.
- **Rationale**: the rules are in device-flows §2; the browser builds them because the service never sees text.

## R6. Errors

- **Decision**: `PortError` gains an optional `info` (`balance`, `cost`, `reason`, `retryAfter`). `toPortError` reads them from the body and the `Retry-After` header. `services/ai/errors.ts` maps an error to `{ title, text, params, actions }`: `limit_reached` (credits → cost/balance and links; `byok.allowed`; `ai.audio_max_minutes`), `own_key_refused`, `ai_unavailable` (`changed_words` vs others), `rate_limited`, `conflict`, `not_found` (suggestion gone).
- **Rationale**: keeps components simple and the mapping unit-tested, as `utils/limits.ts` does for plan limits.

## R7. Formatting while away

- **Decision**: the store keeps `formatting[scriptId]` while the request runs (the promise survives closing the drawer). On opening the editor, `ai.loadSuggestion(id)` asks `GET …/format`; a 404 means none. The writing tools show "Suggestion waiting" when one exists.
- **Rationale**: device-flows §3 "let the person leave the page".

## R8. Credits freshness

- **Decision**: every charging answer carries `balance` (suggestion, permission); the store updates the balance from it at once and refreshes `credits()` in the background after settlement. AI & credits always loads fresh.
- **Rationale**: SC-004 without polling.

## R9. The mock formatter

- **Decision**: deterministic and word-preserving: one paragraph per two sentences, a `pause` (0.8 s) after each sentence end inside a paragraph, `emphasis` on the longest word of each paragraph, and a `note` ("slow down") on the first sentence. Knob `changed_words` makes it fail with `ai_unavailable/changed_words` (refunded), as the backend does.
- **Rationale**: the e2e checks words are the same and marks appear.

## R10. Dictation recorder

- **Decision**: `useDictation` reuses `useMediaDevices` (audio only) and `useRecorder` with the plan's `ai.audio_max_minutes` as the stop limit; the level meter reuses `useLevelMeter`. The e2e uses Chromium's fake media flags already used by recording tests.
- **Rationale**: no second recorder implementation; same messages for denied / missing microphones.
