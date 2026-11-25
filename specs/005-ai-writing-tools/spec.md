# Feature Specification: Web app — AI writing tools (release 2)

**Feature Branch**: `005-ai-writing-tools` (the backend feature is `004-ai-writing-tools`; frontend specs are numbered on their own)

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Frontend feature 005-ai-writing-tools: the web side of backend feature 004 (AI writing tools). Formatting a script on Tilw credits or an own key (estimate, preview, apply, discard, conflict, own_key_refused, ai_unavailable/changed_words); dictation and audio-file transcription where the browser uploads audio straight to Deepgram with a short-lived grant and then reports the request id (never through Tilw); captions SRT/VTT from a take built on the device; credits balance, monthly amount, renewal, entries, negative balance after overrun blocking new charges; own text key (anthropic/openai) saved encrypted, masked last4, check, replace, delete, plan byok.allowed."

## Context

This is the screen side of backend feature `004-ai-writing-tools`. Every rule about costs, the ledger, suggestions, permissions, settlement and own keys is defined there ([spec](../../../backend/specs/004-ai-writing-tools/spec.md), [HTTP contract](../../../backend/specs/004-ai-writing-tools/contracts/openapi.yaml), [device flows](../../../backend/specs/004-ai-writing-tools/contracts/device-flows.md); read with `git -C ../backend show origin/main:specs/004-ai-writing-tools/<file>`). This spec says what people see and do in the web app and keeps the two adapters (in-browser mock and real service) in step.

It keeps the landing page's promise "the words stay your words" (release-1 gap G6) and replaces the "coming soon" line for AI credits on Plan & usage.

**Design source**: Figma has no frames for these tools. Under constitution principle II they are drawn on a new page `09 · Release 2 · AI writing tools` from the design-system page, Arabic desktop first and then phone, before the screens are built. Each frame is listed in `gaps.md`.

**Privacy**: constitution principle IV applies to dictation, transcription and captions. Audio goes from the browser straight to the speech provider with a short-lived permission the service pays for. The transcribed text comes back to the browser only, and reaches Tilw only if the person saves it into a script.

## Clarifications

### Session 2026-11-24

Answered from the backend 004 contract and the existing app patterns (no new product decision was needed from the owner):

- Q: Where do credits and the own key live? → A: A new Settings section **AI & credits** (`/app/settings/ai`), linked from the Settings list, Plan & usage and every "not enough credits" message.
- Q: How is the suggestion previewed? → A: In a side drawer (bottom sheet on phones) in the reader's look, with a **Show original** toggle to compare; the editor stays underneath, unchanged until Apply.
- Q: Where does "New from audio" text go? → A: It is shown for review in the dialog; **Save as new script** creates the script (title from the file name). Nothing reaches Tilw until then.
- Q: Language default for speech? → A: Auto, with Arabic and English to choose; the choice is remembered on this device.
- Q: What does a transcription failure say about credits? → A: It never promises a refund. It says credits for a failed upload are given back once the provider confirms the failure (the service settles from the provider's record, backend gaps 1–3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Format my script for reading aloud (Priority: P1)

In the editor, a person opens **Format for reading** in the writing tools. A small panel says what it will cost ("2 credits · you have 18") or that it will use their own key. They press **Format**. A progress state says it can take up to a minute and that they can leave: the suggestion waits for them for 24 hours. The preview shows the same words as their script, now in short paragraphs with pauses, emphasis and notes, in the normal reading look. They press **Apply** and the editor shows the new text and marks; the old text is in History as an "AI change". Or they press **Discard** and nothing changes.

**Why this priority**: It is the AI promise on the landing page and the main thing credits buy.

**Independent Test**: In the mock, open a 1,500-word script with 20 credits, open Format for reading, check it says 2 credits, format, check the preview has the same words, apply, and check the editor text, the marks, History and the balance (18). Repeat and discard: the script is unchanged.

**Acceptance Scenarios**:

1. **Given** a script, **When** the person opens Format for reading, **Then** they see the cost in credits (1 per started 1,000 words), their balance, and how it will be paid (Tilw credits or "your own key, no credits"), before anything is spent.
2. **Given** a balance below the cost (including a negative balance), **When** the panel opens, **Then** Format is disabled, the panel says why and links to AI & credits and, on Free, to upgrading. If the service still answers `limit_reached`, the person sees the limit dialog with the cost and balance.
3. **Given** enough credits, **When** the person formats, **Then** a progress state shows until the suggestion is ready (up to about 60 seconds), the person may close the panel and come back, and the balance shown drops by the cost.
4. **Given** a ready suggestion, **When** it is shown, **Then** the preview uses the reader's paragraphs and marks (pauses, emphasis, notes) with the script's text direction, says it was made from the person's own words, and shows when it expires.
5. **Given** a suggestion, **When** the person applies it, **Then** the editor shows the new text and marks, the save state is saved, and History has an "AI change" version with the previous text. Unsaved edits in the editor are saved first; if that save fails, Apply waits.
6. **Given** a suggestion made from an older version of the script, **When** the person applies it, **Then** they're told the script changed since the suggestion was made, and are offered **Format again** or **Discard**. Nothing is overwritten.
7. **Given** a suggestion, **When** the person discards it, **Then** the script is unchanged, the suggestion is gone, and they're told the credits stay spent.
8. **Given** the service rejects the suggestion because the formatter changed words, **When** the person sees the result, **Then** they read "The formatter tried to change your words, so we stopped it. Your credits were refunded." Other AI failures say "AI is unavailable right now. Try again" (with the wait when the service gives one) and also say the credits were refunded.
9. **Given** a script with a waiting suggestion, **When** the person opens the editor (on any device), **Then** the writing tools say a suggestion is waiting and open its preview.
10. **Given** a read-only script (plan limit), **When** the person looks at Format for reading, **Then** it is disabled like the other editing tools.

---

### User Story 2 - See my credits and where they went (Priority: P1)

In Settings, a person opens **AI & credits**. They see their balance, the plan's monthly amount, what's left of grants, when credits renew (the 1st of next month), and this month's entries, newest first: the monthly amount, grants, charges for formatting or transcription, refunds and own-key uses.

**Why this priority**: People have to see and trust credits or they'll think they were overcharged. Every other story shows the balance too.

**Independent Test**: In the mock with 20 credits, format two scripts and transcribe one clip; check the balance and the entries match each charge. Use the mock knob for an overrun and check the negative balance banner.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** they open AI & credits, **Then** they see the balance, the monthly amount, the remaining granted credits, the renewal date (local date for the 1st of next month UTC), and this month's entries newest first, each with what it was, the amount (+/−, or "own key"), its status and date.
2. **Given** a refund, **When** it is listed, **Then** it says which charge it gave back. **Given** a grant with an end date, **Then** the end date is shown.
3. **Given** a negative balance (audio longer than declared), **When** the person sees their credits, **Then** a banner explains that new AI actions are paused until the balance recovers, at the latest when credits renew, and every AI action shows as unavailable for that reason.
4. **Given** Settings, **When** the person opens it, **Then** an **AI & credits** row shows the balance. Plan & usage shows "Monthly AI credits" with its amount instead of "coming soon".

---

### User Story 3 - Turn speech into script text (Priority: P2)

In the editor, a person presses **Dictate**. The browser asks for the microphone (only now). They speak and the words appear as they talk, using the browser's own speech recognition (no AI service, no credits; G-A5). They press **Stop**, then **Insert**, and the text goes where the cursor was, ready to edit. From the library, **New from audio** takes an audio file (up to 60 minutes and 200 MB), shows the cost, transcribes it and shows the text, which they can save as a new script.

**Why this priority**: Many people think out loud better than they write, but formatting delivers the landing promise first.

**Independent Test**: In the mock, dictate with the fake recognizer, see the text appear live, insert it at the cursor, and see the balance unchanged. Upload an audio file from the library and save the text as a new script. Pick a file over 200 MB and see it refused before anything is spent.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the person presses Dictate, **Then** the microphone is asked for only then. If it is refused, they're told how to allow it, and writing goes on as before.
2. **Given** a recording, **When** they stop, **Then** they see its length, the cost (1 credit per started minute), their balance, the language (Auto, Arabic, English; default Auto), and that own keys don't apply to speech, before anything is spent. They can discard the recording without cost.
3. **Given** they confirm, **When** the transcription runs, **Then** the audio goes from the browser straight to the speech provider, the steps show (getting permission, sending audio, writing text), and the text is inserted at the cursor (or replaces the selection) as one undoable edit.
4. **Given** a file over 60 minutes or 200 MB, or a file that isn't audio, **When** it is picked, **Then** it is refused with the reason before any credit is spent.
5. **Given** the upload or the provider fails, **When** the person sees it, **Then** they are told it failed and that credits for a failed upload are given back once the provider confirms the failure (about 10 minutes). No text is inserted.
6. **Given** the provider returns no words, **When** the result comes back, **Then** they're told nothing was heard and nothing is inserted.
7. **Given** a balance below the cost, **When** the cost is shown, **Then** Transcribe is disabled with the reason.
8. **Given** a transcription, **When** it runs, **Then** no audio and no transcribed text is sent to Tilw. Only the length, size, type, language and the provider's request id are.

---

### User Story 4 - Use my own AI key for formatting (Priority: P2)

In AI & credits, a person saves their own key for text formatting (Anthropic or OpenAI). The app says Tilw checks it with the provider first and never shows it again. Once saved, they see "Anthropic · ••••1a2b · checked a minute ago", with **Check again**, **Replace** and **Delete**. Formatting now uses their key and no credits.

**Why this priority**: It lets heavy users go beyond their credits, but most people will use credits.

**Independent Test**: In the mock, save a key, see it masked with a passing check, format a script, and see no credits used and an "own key" entry. Save a key the mock refuses and see it not saved. Delete the key and see formatting cost credits again.

**Acceptance Scenarios**:

1. **Given** a plan that allows own keys, **When** the person saves a provider and key, **Then** the key field is cleared, the key is shown only as provider and last four characters with the check result and time, and never in full again.
2. **Given** a key the provider refuses, **When** it is saved, **Then** it isn't saved and the person is told the provider refused it.
3. **Given** a saved key, **When** they press Check again, **Then** the check result and time update; a failing check is shown as such and formatting warns before using it.
4. **Given** a saved key, **When** they format a script and the provider refuses the key, **Then** they're told their own key was refused, and offered **Use Tilw credits this time** (with the cost) and **Check my key**. Credits are never used without that choice.
5. **Given** many own-key calls in an hour, **When** the service answers rate limited, **Then** they're told to wait, with the time.
6. **Given** a saved key, **When** they delete it (after confirming), **Then** it is gone at once and formatting shows a credit cost again.
7. **Given** a plan without own keys, **When** they look at the own-key card, **Then** it is locked with the reason and the way to upgrade. A key saved before the plan changed is shown as "not used on your plan".
8. **Given** a saved key, **When** they dictate or transcribe, **Then** the cost says own keys don't apply to speech.

---

### User Story 5 - Captions from a take (Priority: P3)

On a take's page, the person presses **Captions**. The app shows the take's length, the cost and the language. They confirm; the take's audio is sent from the browser straight to the speech provider, and SRT and VTT files are offered for download.

**Why this priority**: It helps people who publish video, but builds on transcription and isn't needed for writing or reading.

**Independent Test**: In the mock, open a 3-minute take, ask for captions, check the cost is 3 credits, download SRT and VTT, and check the timed cues follow the caption rules.

**Acceptance Scenarios**:

1. **Given** a take on this device or in Drive, **When** the person asks for captions, **Then** they see its length, the cost in credits and the language, before anything is spent.
2. **Given** they confirm, **When** captions are made, **Then** the audio goes from the browser to the speech provider (a Drive-only take is first fetched to the browser), and SRT and VTT files are offered named after the take.
3. **Given** caption files, **When** they are built, **Then** each cue has at most 2 lines of 42 characters, lasts 1 to 7 seconds, doesn't cross a pause of more than 1 second, and cues never overlap.
4. **Given** a take longer than the plan's audio limit, **When** they ask for captions, **Then** it is refused with the reason before anything is spent.

---

### Edge Cases

- **Leaving during formatting**: the request keeps going on the service; when the person comes back, the waiting suggestion is shown (US1 #9). If the page was closed before the answer arrived, the suggestion is found on the next visit.
- **Two tabs**: a suggestion made in another tab replaces this one; Apply uses whatever suggestion the service has now.
- **Suggestion expired** (24 h) or already applied elsewhere: Apply and Discard say it's no longer available and return to the cost panel.
- **Editor has unsaved changes** when formatting starts: they're saved first so the suggestion is made from the current text.
- **Very short text**: still costs 1 credit; no minimum.
- **Empty script**: Format is disabled ("Write something first").
- **Dictation longer than the plan's audio limit**: the recording stops at the limit and says so.
- **Permission expires** before the upload starts (5 minutes): the app asks for a new permission only if the person retries, and says the first one's credits are settled by the service.
- **Microphone in use or missing**: same messages as the recording studio.
- **Browser without speech recognition** (Firefox, Brave, Opera, in-app browsers): Dictate shows disabled with a tooltip pointing to the keyboard's microphone or Chrome/Safari; upload still works.
- **Negative balance**: every AI action shows paused; own-key formatting still works (it costs no credits).
- **Own key saved, plan turns own keys off**: formatting uses credits and says why.
- **Mock adapter**: the in-browser mock never calls a real provider. It answers with a fake transcript and fake word timings, so all flows can be tested offline.

## Requirements *(mandatory)*

### Functional Requirements

**Formatting**

- **FR-001**: The editor's writing tools MUST offer Format for reading, showing the cost, the balance and how it will be paid before anything is spent, and disabling the action when the balance is short, the script is empty or read-only.
- **FR-002**: The app MUST show the waiting suggestion in a preview that uses the reader's paragraphs and marks, with Apply and Discard, and MUST show a waiting suggestion again when the editor is reopened.
- **FR-003**: Apply MUST be a versioned save: it replaces the editor content with the suggestion, keeps the previous content in History as an "AI change", and on a conflict offers Format again or Discard without overwriting anything.
- **FR-004**: The app MUST show distinct messages for: not enough credits (with cost and balance), own key refused (with Use Tilw credits this time and Check my key), changed words (refunded), AI unavailable (refunded, with the wait), and rate limited (with the wait).

**Credits**

- **FR-005**: Settings MUST have an AI & credits section showing balance, monthly amount, granted credits left, renewal date and this month's entries, newest first, each labelled by kind and capability.
- **FR-006**: The app MUST explain a negative balance and treat every credit-paid AI action as unavailable until the balance covers its cost.
- **FR-007**: Plan & usage MUST show the monthly AI credits and own-key limits as real limits once this feature ships.

**Transcription**

- **FR-008**: The editor MUST offer Dictate (record from the microphone, asked for only on that action) and insert the text at the cursor as one undoable edit. The library MUST offer New from audio (an audio file) and offer the text as a new script.
- **FR-009**: Before transcribing, the app MUST show the length, cost, balance and language, and that own keys don't apply to speech, and MUST refuse files over 60 minutes (or the plan's audio limit), over 200 MB, or not audio, before anything is spent.
- **FR-010**: Audio MUST go only from the browser to the speech provider, using the upload address and headers the service gives, before the permission expires. The app MUST report the provider's request id, or the failure, to the service, and MUST NOT send audio or transcribed text to Tilw.
- **FR-011**: The app MUST read the text from the provider's answer (paragraphs when present) and tell the person when nothing was heard.

**Captions**

- **FR-012**: A take's page MUST offer Captions for takes on the device or in Drive, with the cost before anything is spent, and offer SRT and VTT downloads built in the browser from the provider's word timings, following the contract's caption rules.

**Own keys**

- **FR-013**: AI & credits MUST let the person save, check, replace and delete one text-formatting key for Anthropic or OpenAI when the plan allows own keys, show it only as provider and last four characters with the check result, and clear the key field after saving.
- **FR-014**: The own-key card MUST be locked with the upgrade path on plans without own keys, and say when a saved key isn't used because of the plan.

**Adapters and quality**

- **FR-015**: All of this MUST go through service ports with a mock adapter (with knobs on `/__mock` for balance, overrun, refused key, provider failure, changed words and slow answers) and an HTTP adapter for the backend 004 routes. Screens MUST NOT call the speech provider or `fetch` directly.
- **FR-016**: Every new string MUST be in Arabic and English; Arabic is the default. Every new control MUST be keyboard-reachable and labelled, and progress and results MUST be announced politely.

### Key Entities

- **Format estimate**: words, cost, balance, how it would be paid, own-key state, whether the balance is enough.
- **Suggestion**: proposed text and marks for one script, the version it was made from, cost, how it was paid, expiry.
- **Credits**: balance (may be negative), monthly amount, monthly left, granted left, month, renewal time, entries.
- **Credit entry**: kind (monthly, plan change, grant, charge, refund, correction, own key, overrun), amount, capability, status, linked charge, grant end, date.
- **Transcription permission**: purpose (text or captions), language, declared seconds, cost, state, upload address and headers, token expiry.
- **Own key**: provider, last four characters, check result and time, usable, reason when not usable.
- **Caption cue**: start, end, one or two lines of text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can format a script and apply the suggestion in under 4 actions from the editor (open, format, apply), with the cost visible before the first credit is spent, in 100 % of runs of the e2e flow.
- **SC-002**: 0 bytes of audio and 0 characters of transcribed text are sent to the Tilw service during dictation, transcription and captions (checked in the HTTP adapter tests by inspecting every request to the service).
- **SC-003**: The full key is never shown after saving: 0 screens, answers kept in app state, or storage entries contain it (checked by e2e and unit tests).
- **SC-004**: The balance shown after each AI action matches the service's balance without a reload in 100 % of e2e runs.
- **SC-005**: Generated caption files follow the cue rules (≤ 2 × 42 characters, 1–7 s, no overlap) for 100 % of cues in the unit test set, in Arabic and English.
- **SC-006**: Every new screen passes axe with no serious or critical issues, in Arabic and English.

## Assumptions

- Backend 004 is merged and its routes are as in `openapi.yaml` (version 4.0.0) and `device-flows.md`. The mock follows the same rules.
- Dictation uses the browser's speech recognition with live words (G-A5); it never reaches Deepgram or Tilw.
- The editor's existing History, conflict and read-only behaviour (features 001 and 003) are reused.
- The speech provider is Deepgram; the web app uses the upload address, headers and answer format from `device-flows.md` and nothing provider-specific beyond that.
- Admin screens for grants and AI usage are backend feature 005's web side, not this feature.
- Rewriting (changing words) is out of scope; the formatter only formats.
