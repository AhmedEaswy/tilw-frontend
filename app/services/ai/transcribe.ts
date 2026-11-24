/**
 * Feature 005: one transcription run (backend device-flows §1). Framework-free so it is unit-tested.
 *
 *   permission (charges) → upload straight to the provider → complete(requestId) → settled transcription
 *
 * An upload or provider failure calls `fail` (which refunds nothing by itself: the service settles from the
 * provider's record) and throws `UploadFailed`. The permission is never used after `upload.expiresAt`.
 */
import type { AiPort, SpeechPort } from '../ports'
import { PortError, isPortError, type SpeechLanguage, type SpeechPurpose, type SpeechResult, type Transcription, type TranscriptionPermission } from '../types'

export type TranscribeStep = 'permission' | 'sending' | 'settling' | 'done'

export interface TranscribeRun {
  permission: TranscriptionPermission
  transcription: Transcription
  result: SpeechResult
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
}): Promise<TranscribeRun> {
  const now = o.now ?? Date.now
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
  const transcription = await o.ai.complete(permission.id, result.requestId)
  o.onStep?.('done')
  return { permission, transcription, result }
}
