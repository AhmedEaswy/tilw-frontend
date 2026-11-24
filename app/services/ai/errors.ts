/**
 * Feature 005: what to say when an AI call is refused or fails (research R6). Pure, unit-tested; components turn
 * `kind` into `ai.errors.<kind>.title` / `.text` with `params`.
 */
import { isPortError } from '../types'
import { UploadFailed } from './transcribe'

export type AiErrorKind =
  | 'credits' // not enough credits (balance and cost known)
  | 'negative' // balance below zero after an overrun
  | 'byok' // own keys not on this plan
  | 'audio_limit' // longer than ai.audio_max_minutes
  | 'read_only' // the script is read-only (scripts.max_active)
  | 'key_refused' // the provider refused the own key
  | 'changed_words' // the formatter tried to change words (refunded)
  | 'unavailable' // provider down or slow (refunded)
  | 'rate_limited'
  | 'gone' // the suggestion expired or was applied elsewhere
  | 'conflict' // the script changed since the suggestion was made
  | 'upload_failed' // the audio didn't reach the provider after the permission was paid
  | 'network'
  | 'other'

export interface AiErrorCopy {
  kind: AiErrorKind
  params: { balance?: number; cost?: number; wait?: number; minutes?: number }
}

export function describeAiError(e: unknown): AiErrorCopy {
  if (e instanceof UploadFailed) return { kind: 'upload_failed', params: {} }
  if (!isPortError(e)) return { kind: 'other', params: {} }
  const wait = e.info?.retryAfter
  switch (e.code) {
    case 'limit_reached': {
      const key = e.limit?.key
      if (key === 'byok.allowed') return { kind: 'byok', params: {} }
      if (key === 'ai.audio_max_minutes') return { kind: 'audio_limit', params: { minutes: typeof e.limit?.value === 'number' ? e.limit.value : undefined } }
      if (key === 'scripts.max_active') return { kind: 'read_only', params: {} }
      const balance = e.info?.balance
      return { kind: typeof balance === 'number' && balance < 0 ? 'negative' : 'credits', params: { balance, cost: e.info?.cost } }
    }
    case 'own_key_refused': return { kind: 'key_refused', params: {} }
    case 'ai_unavailable': return e.info?.reason === 'changed_words' ? { kind: 'changed_words', params: {} } : { kind: 'unavailable', params: { wait } }
    case 'rate_limited': return { kind: 'rate_limited', params: { wait } }
    case 'not_found': return { kind: 'gone', params: {} }
    case 'conflict': return { kind: 'conflict', params: {} }
    case 'network': return { kind: 'network', params: {} }
    default: return { kind: 'other', params: {} }
  }
}

/** A credit-paid action is possible only when the balance covers its cost (a negative balance never does). */
export const canPay = (balance: number | null | undefined, cost: number): boolean => typeof balance === 'number' && balance >= cost
