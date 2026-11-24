# Port delta: AI writing tools

Added to `app/services/ports.ts`. Release-1, release-2 and phone-link ports are unchanged.

```ts
/** Backend 004: formatting, credits, own keys and transcription permissions. Never carries audio or transcript text. */
export interface AiPort {
  // Formatting (US1)
  formatEstimate(scriptId: string): Promise<FormatEstimate>          // GET  /api/scripts/{id}/format/estimate
  format(scriptId: string, opts?: { useCredits?: boolean }): Promise<FormatSuggestion>  // POST /api/scripts/{id}/format
  suggestion(scriptId: string): Promise<FormatSuggestion | null>     // GET  /api/scripts/{id}/format (404 → null)
  discard(scriptId: string): Promise<void>                           // DELETE /api/scripts/{id}/format
  apply(scriptId: string): Promise<Script>                           // POST /api/scripts/{id}/format/apply (409 conflict + current)
  // Credits (US2)
  credits(): Promise<Credits>                                        // GET  /api/ai/credits
  // Own keys (US4)
  keys(): Promise<OwnKey[]>                                          // GET  /api/ai/keys
  saveKey(input: { provider: AiProvider; key: string }): Promise<OwnKey>  // PUT /api/ai/keys/text
  deleteKey(): Promise<void>                                         // DELETE /api/ai/keys/text
  checkKey(): Promise<OwnKey>                                        // POST /api/ai/keys/text/check
  // Transcription (US3, US5)
  transcriptionEstimate(input: { seconds: number; bytes: number; mimeType: string }): Promise<TranscriptionEstimate>
  startTranscription(input: { seconds: number; bytes: number; mimeType: string; language?: SpeechLanguage; purpose?: SpeechPurpose }): Promise<TranscriptionPermission>
  transcription(id: string): Promise<Transcription>
  complete(id: string, requestId: string): Promise<Transcription>   // 422 fields.requestId = not_this_permission
  fail(id: string, reason?: string): Promise<Transcription>         // 202, refunds nothing by itself
}

/** Browser → speech provider (device-flows §1). The only place that talks to the provider. */
export interface SpeechPort {
  send(upload: SpeechUpload, audio: Blob, opts: { seconds: number; purpose: SpeechPurpose; language: SpeechLanguage; signal?: AbortSignal }): Promise<SpeechResult>
}

export interface Services { /* … */ ai: AiPort; speech: SpeechPort }
```

## Errors

| Answer | PortError |
|---|---|
| 403 `limit_reached` with `limit.key = ai.credits_monthly` | `limit_reached`, `limit`, `info.balance`, `info.cost` |
| 403 `limit_reached` `byok.allowed` / `ai.audio_max_minutes` / `scripts.max_active` | `limit_reached`, `limit` |
| 422 `own_key_refused` | `own_key_refused` |
| 503 `ai_unavailable` | `ai_unavailable`, `info.reason`, `info.retryAfter` |
| 429 | `rate_limited`, `info.retryAfter` |
| 409 on apply | `conflict`, `current` = the script |
| 422 validation on complete | `validation`, `fields.requestId = 'not_this_permission'` |
| speech upload fails | `SpeechPort.send` rejects with `PortError('ai_unavailable', …, { reason: 'provider_failed' })`; network → `network` |

## Mock-only controls (not in the port)

`MockBackend.ai`: `setKnobs(patch)`, `grant(userId, amount, endsAt?)`, `setBalance(userId, n)` (writes a correction), `expireSuggestion(scriptId)`, `settleExpired()`.
