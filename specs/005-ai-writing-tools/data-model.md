# Data model: Web app — AI writing tools

Shapes as backend 004 sends them (`openapi.yaml` 4.0.0). All in `app/services/types.ts`.

## Types

```ts
type AiProvider = 'anthropic' | 'openai' | 'minimax' | 'deepseek'
type PaidWith = 'credits' | 'own_key'
type SpeechLanguage = 'ar' | 'en' | 'auto'
type SpeechPurpose = 'text' | 'captions'

interface OwnKeyState { provider: AiProvider; last4: string; usable: boolean; reason: string | null }
interface FormatEstimate { words: number; credits: number; balance: number; paidWith: PaidWith; ownKey: OwnKeyState | null; enough: boolean }
interface FormatSuggestion {
  id: string; scriptId: string; baseVersion: number; body: string; marks: DeliveryMark[]
  words: number; credits: number; paidWith: PaidWith; balance: number; expiresAt: string; createdAt: string
}
type CreditKind = 'monthly' | 'plan_change' | 'grant' | 'charge' | 'refund' | 'correction' | 'own_key' | 'overrun'
interface CreditEntry {
  id: string; kind: CreditKind; amount: number
  capability: 'format' | 'transcribe' | 'captions' | null; status: 'pending' | 'succeeded' | 'failed' | null
  refundOf: string | null; endsAt: string | null; reason: string | null; createdAt: string
}
interface Credits { balance: number; monthly: number; monthlyLeft: number; granted: number; month: string; renewsAt: string; entries: CreditEntry[] }
interface OwnKey { capability: 'text'; provider: AiProvider; last4: string; checkOk: boolean; checkedAt: string; usable: boolean; reason: string | null }
interface TranscriptionEstimate { credits: number; balance: number; enough: boolean; ownKeyApplies: false }
type TranscriptionState = 'issued' | 'used' | 'failed' | 'expired'
interface Transcription {
  id: string; purpose: SpeechPurpose; language: SpeechLanguage; seconds: number; credits: number; state: TranscriptionState
  durationSeconds: number | null; tokenExpiresAt: string; refundableAt: string; createdAt: string
}
interface SpeechUpload { provider: 'deepgram' | 'fake'; method: 'POST'; url: string; headers: Record<string, string>; expiresAt: string }
interface TranscriptionPermission extends Transcription { upload: SpeechUpload; balance: number }

/** What the browser got back from the provider. Never sent to Tilw (except requestId). */
interface SpeechWord { word: string; start: number; end: number }
interface SpeechResult { requestId: string; transcript: string; language: string | null; duration: number | null; words: SpeechWord[]; utteranceBreaks: number[] }
interface CaptionCue { start: number; end: number; lines: string[] }
```

`PortErrorCode` gains `own_key_refused` and `ai_unavailable`. `PortError` gains a 5th argument `info?: { balance?: number; cost?: number; reason?: string; retryAfter?: number }`.

## Store `useAiStore` (`app/stores/ai.ts`)

| State | Meaning |
|---|---|
| `credits: Credits \| null` | last loaded credits |
| `balance: number \| null` | freshest balance (from any charging answer, else `credits.balance`) |
| `key: OwnKey \| null`, `keyLoaded` | the saved own text key, masked |
| `suggestions: Record<scriptId, FormatSuggestion \| null>` | waiting suggestion per script (`null` = none, missing = unknown) |
| `formatting: Record<scriptId, boolean>` | a format request is running |

Actions: `loadCredits()`, `loadKey()`, `saveKey(provider, key)`, `checkKey()`, `deleteKey()`, `estimate(scriptId)`, `format(scriptId, { useCredits })`, `loadSuggestion(scriptId)`, `discard(scriptId)`, `apply(scriptId)` (returns the script; on `conflict` rethrows), `setBalance(n)`. Getter `negative` (balance < 0).

## Transcription run (`services/ai/transcribe.ts`)

```text
check(file) ─▶ estimate ─▶ (person confirms) ─▶ start (permission, charges) ─▶ speech.send(upload, blob)
   ├─ ok: complete(id, requestId) ─▶ result (text / words) ─▶ refresh credits
   └─ upload or provider failed: fail(id, reason) ─▶ error "failed; refunded once the provider confirms"
```

Steps reported to the UI: `checking`, `permission`, `sending`, `settling`, `done` | `failed`.

## Mock state (`tilw:mock:ai:v1`)

```ts
interface MockAiState {
  entries: Record<userId, (CreditEntry & { month: string })[]>
  suggestions: Record<scriptId, FormatSuggestion & { userId: string }>
  transcriptions: Record<id, Transcription & { userId: string; requestId: string | null }>
  keys: Record<userId, OwnKey>
  ownKeyCalls: Record<userId, number[]>   // fair use: 60 an hour
  knobs: {
    format: 'ok' | 'slow' | 'unavailable' | 'changed_words'
    keyRefused: boolean                    // the provider refuses own keys (save and use)
    speech: 'ok' | 'failed' | 'empty' | 'overrun'
  }
}
```

Rules follow the backend: month start writes a `monthly` entry (`ai.credits_monthly`); charges are refused when balance < cost; refunds link to their charge; own-key calls write an `own_key` entry of 0; an overrun writes an `overrun` charge and may go below zero. Grants are added from `/__mock` ("Grant 50 credits").
