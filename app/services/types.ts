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
  /** Feature 004 (phone link): the other side of the link isn't connected, so nothing was delivered. */
  | 'partner_offline'

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

// ---------------------------------------------------------------------------------------------------------------
// Feature 004: phone link (backend 003-phone-link). Shapes as the API sends them; see specs/004-phone-link/data-model.md.
// ---------------------------------------------------------------------------------------------------------------

export type LinkParty = 'host' | 'remote'
export type LinkStateName = 'waiting' | 'connected' | 'ended'
export type LinkEndReason = 'owner' | 'remote' | 'idle' | 'script_deleted' | 'signed_out' | 'device_revoked'
  | 'email_changed' | 'account_deleted' | 'limit'

export interface PairingCode {
  /** 6 digits. */
  code: string
  /** `<frontend>/remote#<secret>`, for the QR. */
  url: string
  expiresAt: string
}

export interface LinkRemote {
  id: string
  kind: 'browser' | 'app'
  name: string
  status: 'pending' | 'active' | 'replaced' | 'declined' | 'ended'
  connected: boolean
  lastSeenAt: string | null
}

export interface PhoneLink {
  id: string
  scriptId: string | null
  scriptTitle: string | null
  host: { kind: 'web' | 'app'; label: string; connected: boolean }
  player: LinkParty
  previews: boolean
  state: LinkStateName
  remote: LinkRemote | null
  pendingRemote: LinkRemote | null
  startedAt: string
  lastUsedAt: string
  endedAt: string | null
  endReason: LinkEndReason | null
}

export interface PhoneLinkWithCode extends PhoneLink {
  code: PairingCode
}

/** What a Pusher-protocol client needs to reach the realtime server. */
export interface RealtimeSettings {
  key: string
  host: string
  port: number
  scheme: 'http' | 'https'
}

export interface Pairing {
  link: PhoneLink
  remote: LinkRemote
  /** `rl_…` for a phone browser; null for the app. */
  credential: string | null
  channels: { own: string; presence: string }
  realtime: RealtimeSettings
}

export type CommandType = 'play' | 'pause' | 'next' | 'previous' | 'goto' | 'restart' | 'faster' | 'slower' | 'speed'
  | 'textBigger' | 'textSmaller' | 'recordStart' | 'recordStop'

export interface LinkCommand {
  /** uuid */
  id: string
  type: CommandType
  /** goto only, 0-based. */
  paragraph?: number
  /** speed only, 60–220. */
  wpm?: number
}

export type RefusalReason = 'at_end' | 'at_start' | 'not_recording_mode' | 'devices_off' | 'already_recording'
  | 'not_recording' | 'saving' | 'limit' | 'unsupported'

export interface LinkAck {
  commandId: string
  result: 'applied' | 'refused'
  reason?: RefusalReason
}

export type RecordingStateName = 'unavailable' | 'idle' | 'countdown' | 'recording' | 'saving' | 'saved' | 'failed'

export interface StudioState {
  /** Increases with every change; receivers drop older ones. */
  seq: number
  scriptTitle: string | null
  /** 0-based. */
  paragraph: number
  paragraphCount: number
  playing: boolean
  mode: 'constant' | 'manual'
  wpm: number
  fontSize: 'S' | 'M' | 'L' | 'XL'
  recording: { state: RecordingStateName; startedAt?: string }
  /** At most 120 characters each; absent when previews are off. */
  preview?: { current: string; next: string | null }
}

/** Who is calling a link route: the signed-in studio, or a phone browser with its `rl_` credential. */
export type LinkAuth = { kind: 'session' } | { kind: 'remote'; credential: string }

export type LinkEvent =
  | { name: 'command'; data: LinkCommand }
  | { name: 'ack'; data: LinkAck }
  | { name: 'state'; data: StudioState }
  | { name: 'remote.requested'; data: { remote: LinkRemote } }
  | { name: 'remote.replaced'; data: { reason: 'replaced' } }
  | { name: 'remote.accepted'; data: { player: LinkParty } }
  | { name: 'remote.declined'; data: { reason: 'declined' | 'lapsed' } }
  | { name: 'roles.requested'; data: { player: LinkParty; expiresAt: string } }
  | { name: 'roles.declined'; data: { reason: 'recording' | 'declined' | 'lapsed' } }
  | { name: 'roles.changed'; data: { player: LinkParty } }
  | { name: 'link.updated'; data: { previews: boolean } }
  | { name: 'link.ended'; data: { reason: LinkEndReason } }

export const LINK_EVENTS: readonly LinkEvent['name'][] = [
  'command', 'ack', 'state', 'remote.requested', 'remote.replaced', 'remote.accepted', 'remote.declined',
  'roles.requested', 'roles.declined', 'roles.changed', 'link.updated', 'link.ended',
]

export interface PresenceMember {
  /** `host` or `remote:<remoteId>`. */
  id: string
  party: LinkParty
  remoteId: string | null
}

export type ConnectionState = 'connecting' | 'connected' | 'unavailable' | 'disconnected'

/** Phone-link timings and sizes from backend 003 (config/tilw.php `phone_link`). */
export const LINK_RULES = {
  codeMinutes: 5,
  reconnectMinutes: 10,
  pendingRemoteMinutes: 2,
  roleRequestSeconds: 30,
  previewChars: 120,
  ackTimeoutMs: 5000,
  wpmMin: 60,
  wpmMax: 220,
  wrongCodes: 5,
  wrongWindowMinutes: 15,
  blockMinutes: 60,
} as const
