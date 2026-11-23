/** Entities shared by the UI and the service ports. See specs/001-studio-frontend/data-model.md. */

export type Locale = 'ar' | 'en'
export type Theme = 'system' | 'light' | 'dark'
export type TextDirection = 'auto' | 'rtl' | 'ltr'

/** Account-wide reading settings (G15). Text direction is per script, not here. */
export interface ReadingSettings {
  mode: 'constant' | 'manual'
  wpm: number
  fontSize: 'S' | 'M' | 'L' | 'XL'
  mirror: boolean
  lineWidth: 'narrow' | 'medium' | 'wide'
  countdownSec: 0 | 3 | 5 | 10
}

export const DEFAULT_READING: ReadingSettings = {
  mode: 'constant',
  wpm: 120,
  fontSize: 'M',
  mirror: false,
  lineWidth: 'medium',
  countdownSec: 3,
}

export interface User {
  id: string
  name: string
  email: string
  locale: Locale
  theme: Theme
  reading: ReadingSettings
  /** Present when the real service is used; the mock has no admins. */
  isAdmin?: boolean
  createdAt: string
}

export interface DeliveryMark {
  id: string
  type: 'emphasis' | 'pause' | 'note'
  start: number
  end: number
  pauseSec?: number
  note?: string
}

export interface ReadingPosition {
  paragraph: number
  offset: number
}

export interface Script {
  id: string
  title: string
  body: string
  marks: DeliveryMark[]
  direction: TextDirection
  pinned: boolean
  archivedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  lastPosition: ReadingPosition | null
  /** Release 2: the service keeps scripts over a lowered limit read-only (newest stay editable). */
  readOnly?: boolean
  readOnlyReason?: LimitKey | null
}

/** List rows omit the body; `excerpt` is the first line. */
export type ScriptSummary = Omit<Script, 'body' | 'marks'> & { excerpt: string; wordCount: number; paragraphCount: number }

export type ScriptPatch = Partial<Pick<Script, 'title' | 'body' | 'marks' | 'direction' | 'pinned' | 'archivedAt' | 'lastOpenedAt'>>

/** Admin area (real API only). A waitlist entry is "invited" once any invitation exists for its email. */
export interface WaitlistEntry {
  id: string
  email: string
  joinedAt: string
  invited: boolean
}

export type InvitationState = 'pending' | 'used' | 'expired' | 'withdrawn'

export interface Invitation {
  id: string
  email: string
  state: InvitationState
  expiresAt: string
  usedAt?: string | null
  createdAt: string
}

export interface LegacyScript {
  key: string
  title: string
  kind: 'draft' | 'saved'
  body: string
}

// ---------- Release 2: plans, storage, history, account (specs/003-accounts-plans-storage/data-model.md) ----------

/** Known keys: scripts.max_active, scripts.max_words, takes.max_minutes, ai.credits_monthly, storage.auto_sync,
 * storage.providers, history.versions, history.days, byok.allowed, phone_link.allowed. Others may appear later. */
export type LimitKey = string

export interface LimitValue {
  key: LimitKey
  type: 'int' | 'bool' | 'list'
  label: string
  /** `null` on an `int` limit = unlimited. */
  value: number | boolean | string[] | null
  /** Counted limits only. */
  usage?: number | null
  overridden: boolean
}

export interface Plan {
  key: string
  name: string
  priceMonthlyCents: number
  priceYearlyCents: number
  currency: 'USD'
  limits: LimitValue[]
}

export type UpgradePeriod = 'monthly' | 'yearly'

export interface UpgradeRequest {
  id: string
  reference: string
  plan: string
  period: UpgradePeriod
  priceCents: number
  state: 'pending' | 'fulfilled' | 'rejected' | 'cancelled' | 'expired'
  createdAt: string
  expiresAt: string
}

export interface MyPlan {
  plan: Plan
  period: 'monthly' | 'yearly' | 'custom' | null
  startsAt?: string | null
  endsAt?: string | null
  renewsAfter?: string | null
  limits: LimitValue[]
  pendingRequest: UpgradeRequest | null
  /** One-time notice since the last read. */
  notice?: 'pro_started' | 'pro_ended' | null
}

export type SyncMode = 'off' | 'manual' | 'auto'

export interface StorageStatus {
  provider: 'google_drive' | null
  accountEmail?: string | null
  state: 'none' | 'linked' | 'revoked'
  syncMode: SyncMode
  autoSyncAllowed: boolean
  quota?: { usedBytes: number; totalBytes: number | null; tilwBytes: number; tilwTakes: number } | null
}

export type RemoteTakeState = 'uploading' | 'backed_up' | 'unreachable' | 'failed'

/** The service's record of a take backed up to Drive. `clientId` is the device take id. */
export interface RemoteTake {
  id: string
  clientId: string
  scriptId: string | null
  title: string
  kind: 'audio' | 'video'
  mime: string
  durationMs: number
  sizeBytes: number
  recordedAt: string
  starred: boolean
  providerFileId: string | null
  state: RemoteTakeState
}

export interface RemoteTakeInput {
  clientId: string
  scriptId: string | null
  title: string
  kind: 'audio' | 'video'
  mime: string
  durationMs: number
  sizeBytes: number
  recordedAt: string
  starred?: boolean
}

export interface UploadToken {
  accessToken: string
  expiresAt: string
  rootFolderId: string
  folderId: string | null
}

export interface ScriptVersionSummary {
  id: string
  createdAt: string
  reason: 'edit' | 'restore' | 'ai'
  wordCount: number
}

export interface ScriptVersion extends ScriptVersionSummary {
  title: string
  body: string
  marks: DeliveryMark[]
  direction: TextDirection
}

export interface Device {
  /** Token id, or "browser" for the cookie session. */
  id: string
  name: string
  platform: 'ios' | 'android' | 'other' | 'web'
  createdAt: string
  lastUsedAt: string | null
  current: boolean
}

export interface PendingEmail {
  email: string
  expiresAt: string
}

export interface LimitInfo {
  key: LimitKey
  value: number | boolean | string[] | null
  usage: number | null
}

export type PortErrorCode =
  | 'invalid_credentials'
  | 'validation'
  | 'unauthenticated'
  | 'token_invalid'
  | 'token_expired'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'unknown'
  | 'limit_reached'
  | 'storage_full'
  | 'storage_not_linked'

export class PortError extends Error {
  constructor(
    public code: PortErrorCode,
    public fields?: Record<string, string>,
    /** For `conflict`: the server copy. */
    public current?: unknown,
    /** For `limit_reached`: which limit, its value and the current usage. */
    public limit?: LimitInfo,
  ) {
    super(code)
    this.name = 'PortError'
  }
}

export const isPortError = (e: unknown, code?: PortErrorCode): e is PortError =>
  e instanceof PortError && (!code || e.code === code)
