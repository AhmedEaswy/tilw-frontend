/**
 * Feature 005: one transcription run (backend device-flows §1). Framework-free so it is unit-tested.
 *
 *   permission (charges) → upload straight to the provider → complete(requestId) → settled transcription
 *
 * An upload or provider failure calls `fail` (which refunds nothing by itself: the service settles from the
 * provider's record) and throws `UploadFailed`. The permission is never used after `upload.expiresAt`.
 *
 * Once the provider has answered, the text is paid for and is never thrown away. `complete` is retried with backoff
 * on network errors, 503s and `not_this_permission` (the provider's request log can lag a few seconds behind its
 * answer). When it still fails, the run returns the text with `transcription: null`: the service settles the
 * permission later from the provider's tagged record.
 */
import type { AiPort, SpeechPort } from '../ports'
import { PortError, isPortError, type SpeechLanguage, type SpeechPurpose, type SpeechResult, type Transcription, type TranscriptionPermission } from '../types'

export type TranscribeStep = 'permission' | 'sending' | 'settling' | 'done'

export interface TranscribeRun {
  permission: TranscriptionPermission
  /** null when settling didn't go through now; the service settles it later from the provider's record. */
  transcription: Transcription | null
  result: SpeechResult
}

/** Waits between `complete` attempts. */
export const COMPLETE_RETRY_MS = [1000, 2000, 4000, 8000]

function retryable(e: unknown): boolean {
  if (!isPortError(e)) return false
  if (e.code === 'network' || e.code === 'ai_unavailable' || e.code === 'unknown') return true
  return e.code === 'validation' && e.fields?.requestId === 'not_this_permission'
}

/** The audio didn't reach the provider, or the provider failed, after the permission was paid. */
export class UploadFailed extends Error {
  constructor(public reason: unknown, public permission: TranscriptionPermission) {
    super('upload_failed')
    this.name = 'UploadFailed'
  }
}

function failReason(e: unknown): string {
  if (isPortError(e)) return e.info?.reason ?? e.code
  return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'error'
}

/** Reports the provider's request id, retrying; null when it didn't go through (the service settles it later). */
export async function settleTranscription(o: {
  ai: AiPort
  id: string
  requestId: string
  delays?: number[]
  sleep?: (ms: number) => Promise<void>
}): Promise<Transcription | null> {
  const delays = o.delays ?? COMPLETE_RETRY_MS
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  if (!o.requestId) return null
  for (let i = 0; ; i++) {
    try {
      return await o.ai.complete(o.id, o.requestId)
    } catch (e) {
      // Already settled (the expiry job got there first): its record is the answer.
      if (isPortError(e, 'conflict')) return (e.current as Transcription | undefined) ?? null
      if (!retryable(e) || i >= delays.length) return null
      await sleep(delays[i]!)
    }
  }
}

export async function runTranscription(o: {
  ai: AiPort
  speech: SpeechPort
  blob: Blob
  seconds: number
  language: SpeechLanguage
  purpose: SpeechPurpose
  onStep?: (s: TranscribeStep) => void
  signal?: AbortSignal
  now?: () => number
  retryMs?: number[]
  sleep?: (ms: number) => Promise<void>
}): Promise<TranscribeRun> {
  const now = o.now ?? Date.now
  const delays = o.retryMs ?? COMPLETE_RETRY_MS
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  o.onStep?.('permission')
  const permission = await o.ai.startTranscription({
    seconds: o.seconds,
    bytes: o.blob.size,
    mimeType: o.blob.type || 'audio/webm',
    language: o.language,
    purpose: o.purpose,
  })
  o.onStep?.('sending')
  let result: SpeechResult
  try {
    if (Date.parse(permission.upload.expiresAt) <= now()) throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'expired' })
    result = await o.speech.send(permission.upload, o.blob, { seconds: o.seconds, purpose: o.purpose, language: o.language, signal: o.signal })
  } catch (e) {
    await o.ai.fail(permission.id, failReason(e)).catch(() => {})
    throw new UploadFailed(e, permission)
  }
  o.onStep?.('settling')
  const transcription = await settleTranscription({ ai: o.ai, id: permission.id, requestId: result.requestId, delays, sleep })
  o.onStep?.('done')
  return { permission, transcription, result }
}
