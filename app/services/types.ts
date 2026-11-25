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
  /** Feature 007: `super` (every permission, locked), `admin`, or null for everyone else. */
  adminRole?: AdminRole | null
  /** Feature 007: the level per admin section; null when not an admin. */
  adminPermissions?: AdminPermissions | null
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
  /** Feature 006: an account exists for this email. */
  hasAccount?: boolean
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
  /** Feature 005 (AI): the provider refused the person's own key; credits were not used. */
  | 'own_key_refused'
  /** Feature 005 (AI): the provider failed or the formatter changed words; credits were refunded. */
  | 'ai_unavailable'
  /** Feature 006 (backend 005): the account is suspended; any signed-in call ends the session with this. */
  | 'account_suspended'
  /** Feature 006 (backend 005): public sign-up while the sign-up mode is invite-only. */
  | 'signup_closed'
  /** Feature 007: an admin whose level for the route's section is too low (403; `info.section`, `info.need`). */
  | 'forbidden'
  /** Feature 007: the super admin can't be edited, demoted, suspended, deleted or lose the admin flag (409). */
  | 'super_admin_locked'

export interface PortErrorInfo {
  balance?: number
  cost?: number
  reason?: string
  /** Seconds, from `Retry-After`. */
  retryAfter?: number
  /** Feature 007 (`forbidden`): the section and the level the route needs. */
  section?: AdminSection
  need?: 'view' | 'edit'
}

export class PortError extends Error {
  constructor(
    public code: PortErrorCode,
    public fields?: Record<string, string>,
    /** For `conflict`: the server copy. */
    public current?: unknown,
    /** For `limit_reached`: which limit, its value and the current usage. */
    public limit?: LimitInfo,
    /** Feature 005: extra answer fields (credits limit: balance and cost; ai_unavailable: reason; Retry-After). */
    public info?: PortErrorInfo,
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

// ---------------------------------------------------------------------------------------------------------------
// Feature 005: AI writing tools (backend 004-ai-writing-tools). Shapes as the API sends them; see
// specs/005-ai-writing-tools/data-model.md. Audio and transcribed text never reach the Tilw API.
// ---------------------------------------------------------------------------------------------------------------

export type AiProvider = 'anthropic' | 'openai'
export type PaidWith = 'credits' | 'own_key'
export type SpeechLanguage = 'ar' | 'en' | 'auto'
export type SpeechPurpose = 'text' | 'captions'
export type AiCapability = 'format' | 'transcribe' | 'captions'

export interface OwnKeyState {
  provider: AiProvider
  last4: string
  usable: boolean
  /** `byok.allowed` when the plan turned own keys off. */
  reason: string | null
}

export interface FormatEstimate {
  words: number
  credits: number
  balance: number
  /** What a call without `useCredits` would use. */
  paidWith: PaidWith
  ownKey: OwnKeyState | null
  enough: boolean
}

export interface FormatSuggestion {
  id: string
  scriptId: string
  baseVersion: number
  body: string
  marks: DeliveryMark[]
  words: number
  credits: number
  paidWith: PaidWith
  balance: number
  expiresAt: string
  createdAt: string
}

export type CreditKind = 'monthly' | 'plan_change' | 'grant' | 'charge' | 'refund' | 'correction' | 'own_key' | 'overrun'

export interface CreditEntry {
  id: string
  kind: CreditKind
  amount: number
  capability: AiCapability | null
  status: 'pending' | 'succeeded' | 'failed' | null
  refundOf: string | null
  endsAt: string | null
  reason: string | null
  createdAt: string
}

export interface Credits {
  /** Below zero after an overrun; every charge is refused until it covers the cost. */
  balance: number
  monthly: number
  monthlyLeft: number
  granted: number
  /** `YYYY-MM` */
  month: string
  renewsAt: string
  entries: CreditEntry[]
}

export interface OwnKey {
  capability: 'text'
  provider: AiProvider
  last4: string
  checkOk: boolean
  checkedAt: string
  usable: boolean
  reason: string | null
}

export interface TranscriptionEstimate {
  credits: number
  balance: number
  enough: boolean
  ownKeyApplies: false
}

export type TranscriptionState = 'issued' | 'used' | 'failed' | 'expired'

export interface Transcription {
  id: string
  purpose: SpeechPurpose
  language: SpeechLanguage
  seconds: number
  credits: number
  state: TranscriptionState
  durationSeconds: number | null
  tokenExpiresAt: string
  refundableAt: string
  createdAt: string
}

export interface SpeechUpload {
  provider: 'deepgram' | 'fake'
  method: 'POST'
  url: string
  headers: Record<string, string>
  expiresAt: string
}

export interface TranscriptionPermission extends Transcription {
  upload: SpeechUpload
  balance: number
}

/** One recognised word, times in seconds. */
export interface SpeechWord {
  word: string
  start: number
  end: number
}

/** What the browser got back from the speech provider. Only `requestId` is ever sent to Tilw. */
export interface SpeechResult {
  requestId: string
  transcript: string
  /** Detected language when `auto` was asked for. */
  language: string | null
  duration: number | null
  words: SpeechWord[]
  /** Indexes into `words` where a new utterance starts (after the first). */
  utteranceBreaks: number[]
}

export interface CaptionCue {
  start: number
  end: number
  lines: string[]
}

/** Backend 004 starting values (config/tilw.php `ai`). */
export const AI_RULES = {
  wordsPerCredit: 1000,
  secondsPerCredit: 60,
  audioMaxBytes: 200 * 1024 * 1024,
  audioMaxMinutes: 60,
  suggestionHours: 24,
  ownKeyMin: 20,
  ownKeyMax: 300,
} as const

// ---------------------------------------------------------------------------------------------------------------
// Feature 006: admin console (backend 005-admin-console). Shapes as the API sends them; see
// specs/006-admin-console/data-model.md and the backend contract (components.schemas).
// ---------------------------------------------------------------------------------------------------------------

/** A paged list: `nextCursor` is null on the last page. */
export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface PersonRef {
  id: string
  /** null when the person was deleted. */
  email: string | null
  name: string | null
}

export type AdminStatus = 'active' | 'suspended' | 'deletion_scheduled'
export type UserStatusFilter = AdminStatus | 'admin'
export type SignupMode = 'invite_only' | 'open'

/** Times in ISO 8601 with `Z`; `from` inclusive, `to` exclusive. */
export interface Period {
  from?: string
  to?: string
}

export interface AdminDashboard {
  generatedAt: string
  period: { days: number; from: string; to: string }
  users: { total: number; admins: number; suspended: number; deletionScheduled: number }
  signups: { total: number; byDay: { date: string; count: number }[] }
  active: { day: number; week: number; month: number }
  storage: { linkedDrives: number; takes: number; bytes: number; bytesInPeriod: number }
  ai: { creditsUsed: number; creditsUsedThisMonth: number; calls: number; failedCalls: number; ownKeyCalls: number }
  revenue: { currency: 'USD'; mrrCents: number; payingSubscriptions: number; payments: number; paymentsCents: number }
  attention: { pendingRequests: number; waitlistNotInvited: number }
  /** Feature 007: headline counts for the period (ownKeyUsers is "now"). */
  headlines: DashboardHeadlines
}

export interface PendingRequestRef {
  id: string
  reference: string
  plan: string
  period: UpgradePeriod
  priceCents: number
  state: UpgradeRequest['state']
  createdAt: string
  expiresAt: string
}

export interface AdminUserRow {
  id: string
  email: string
  name: string
  isAdmin: boolean
  /** Feature 007. */
  adminRole: AdminRole | null
  plan: string | null
  planEndsAt: string | null
  pendingRequest: PendingRequestRef | null
  createdAt: string
  status: AdminStatus
  suspendedAt: string | null
  deletionDueAt: string | null
  lastActiveAt: string | null
}

export interface AdminUserFilters {
  q?: string
  plan?: string
  status?: UserStatusFilter
}

export type AdminLimitValue = number | boolean | string[] | null

export interface AdminOverride {
  id: string
  userId: string
  key: string
  value: AdminLimitValue
  endsAt: string | null
  note: string | null
  createdBy: string | null
}

export type SubscriptionState = 'active' | 'scheduled' | 'ended'
export type SubscriptionSource = 'request' | 'admin' | 'provider'

export interface AdminSubscription {
  id: string
  userId: string
  plan: string
  period: 'monthly' | 'yearly' | 'custom'
  startsAt: string
  endsAt: string
  endedAt: string | null
  endedReason: 'refund' | 'cancelled' | 'other' | 'plan_change' | null
  state: SubscriptionState
  source: SubscriptionSource
  requestId: string | null
  grantedBy: string | null
  note: string | null
  createdAt: string
}

export interface AdminSubscriptionRow extends AdminSubscription {
  user: PersonRef
}

export interface AdminLimitRow {
  key: string
  type: 'int' | 'bool' | 'list'
  labelAr: string
  labelEn: string
  value: AdminLimitValue
  usage: number | null
  overridden: boolean
}

export interface AdminDevice {
  id: string
  name: string
  platform: 'ios' | 'android' | 'other'
  lastUsedAt: string | null
  createdAt: string
}

export interface AdminUserDetail {
  id: string
  email: string
  name: string
  locale: Locale
  isAdmin: boolean
  /** Feature 007. */
  adminRole: AdminRole | null
  adminPermissions: AdminPermissions | null
  status: AdminStatus
  createdAt: string
  lastActiveAt: string | null
  suspension: { at: string; reason: string; byId: string | null; byEmail: string | null } | null
  deletionDueAt: string | null
  /** The admin who scheduled the deletion (then signing in does not cancel it); null for a self-deletion. */
  deletionBy: string | null
  plan: {
    key: string | null
    nameAr: string | null
    nameEn: string | null
    subscription: AdminSubscription | null
    upcoming: AdminSubscription[]
    pendingRequest: PendingRequestRef | null
  }
  limits: AdminLimitRow[]
  overrides: AdminOverride[]
  storage: { linked: boolean; provider: 'google_drive' | null; accountEmail: string | null; linkedAt: string | null; takes: number; bytes: number }
  credits: { balance: number; monthly: number; monthlyLeft: number; granted: number; month: string }
  sessions: { web: number; devices: AdminDevice[] }
  scripts: { total: number; active: number; archived: number }
  ai: { month: string; calls: number; failed: number; credits: number; ownKey: { provider: AiProvider; last4: string; checkedAt: string } | null }
}

export interface ChangePlanInput {
  planId: string
  period?: UpgradePeriod
  endsAt?: string
  note: string
}

export interface AddCreditsInput {
  kind: 'grant' | 'correction'
  amount: number
  endsAt?: string | null
  reason: string
}

export interface OverrideInput {
  value: AdminLimitValue
  endsAt?: string | null
  note?: string | null
}

export interface GrantSubscriptionInput {
  planId: string
  period?: UpgradePeriod
  startsAt?: string
  endsAt?: string
  note: string
}

export type SubscriptionPatch =
  | { endsAt: string; note?: string }
  | { endedReason: 'refund' | 'cancelled' | 'other'; endedAt?: string; note?: string }

export interface AdminPlanLimit {
  key: string
  type: 'int' | 'bool' | 'list'
  value: AdminLimitValue
  /** false = the limit kind's default applies. */
  set: boolean
}

export interface AdminPlan {
  id: string
  key: string
  nameAr: string
  nameEn: string
  priceMonthlyCents: number
  priceYearlyCents: number
  currency: 'USD'
  active: boolean
  sort: number
  limits: AdminPlanLimit[]
}

export interface PlanInput {
  nameAr?: string
  nameEn?: string
  priceMonthlyCents?: number
  priceYearlyCents?: number
  active?: boolean
  sort?: number
}

export interface LimitDefinition {
  key: string
  type: 'int' | 'bool' | 'list'
  default: AdminLimitValue
  counted: boolean
  labelAr: string
  labelEn: string
}

export interface AdminUpgradeRequest extends PendingRequestRef {
  userId: string
  email: string
  name: string
  currentPriceCents: number
  handledBy: string | null
  handledAt: string | null
  note: string | null
}

export interface Payment {
  id: string
  reference: string
  user: PersonRef
  plan: string
  period: UpgradePeriod
  amountCents: number
  currency: 'USD'
  paidAt: string
  recordedBy: PersonRef | null
  subscriptionId: string | null
  note: string | null
}

export interface PaymentsPage extends Page<Payment> {
  count: number
  totalCents: number
  currency: 'USD'
}

export type UsageGroupBy = 'provider' | 'capability' | 'day' | 'user'

export interface UsageFigures {
  calls: number
  succeeded: number
  failed: number
  pending: number
  credits: number
  words: number
  seconds: number
  ownKeyCalls: number
}

export interface UsageGroup extends UsageFigures {
  key: string
  user?: PersonRef
}

export interface AiUsage {
  from: string
  to: string
  groupBy: UsageGroupBy
  totals: UsageFigures
  groups: UsageGroup[]
}

export interface AdminAiCall {
  id: string
  user: PersonRef
  capability: AiCapability
  provider: string
  paidWith: PaidWith
  units: number
  unit: 'words' | 'seconds'
  credits: number
  status: 'pending' | 'succeeded' | 'failed'
  failure: string | null
  elapsedMs: number | null
  durationSeconds: number | null
  overrun: boolean
  createdAt: string
  finishedAt: string | null
}

export interface AiCallFilters extends Period {
  status?: AdminAiCall['status']
  userId?: string
  provider?: string
  capability?: AiCapability
}

export interface LedgerEntry extends CreditEntry {
  month: string
  user: PersonRef
  createdBy: PersonRef | null
  aiCallId: string | null
}

export interface LedgerFilters extends Period {
  userId?: string
  kind?: CreditKind
}

export interface SubscriptionFilters {
  state?: SubscriptionState
  plan?: string
  source?: SubscriptionSource
  userId?: string
}

export interface AiKeyState {
  provider: 'anthropic' | 'deepgram'
  set: boolean
  source: 'stored' | 'env' | 'none'
  last4: string | null
  updatedAt: string | null
  project?: string | null
}

export interface FeatureFlag {
  key: string
  enabled: boolean
  description: string | null
  updatedAt: string
}

export interface AdminSettings {
  signupMode: SignupMode
  aiKeys: AiKeyState[]
  flags: FeatureFlag[]
}

export interface PublicSettings {
  signupMode: SignupMode
  flags: Record<string, boolean>
}

export interface AuditEntry {
  id: number
  adminId: string | null
  adminEmail: string | null
  action: string
  targetType: string
  targetId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

export interface AuditAction {
  action: string
  targetType: string
}

export interface AuditFilters {
  adminId?: string
  action?: string
  targetType?: string
  targetId?: string
  after?: string
  before?: string
}

/** Feature-flag key rule (backend FR-023). */
export const FLAG_KEY = /^[a-z][a-z0-9_.-]{0,63}$/

// ---------------------------------------------------------------------------------------------------------------
// Feature 007 (backend specs/007-admin-insights/contracts/openapi.yaml): admin roles and per-section permissions,
// product analytics, read-only views of one person's takes, scripts, links, connections and preferences, practice.
// ---------------------------------------------------------------------------------------------------------------

/** The seven admin sections, in display order. */
export const ADMIN_SECTIONS = ['users', 'money', 'ai', 'plans', 'settings', 'audit', 'admins'] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]
/** `edit` includes `view`. */
export type AdminLevel = 'none' | 'view' | 'edit'
export type AdminRole = 'super' | 'admin'
/** Always all seven sections in answers. */
export type AdminPermissions = Record<AdminSection, AdminLevel>
/** Any of the sections; left out = none. */
export type AdminPermissionsInput = Partial<AdminPermissions>

export interface AdminRow {
  id: string
  email: string
  name: string
  adminRole: AdminRole
  adminPermissions: AdminPermissions
  status: AdminStatus
  lastActiveAt: string | null
  createdAt: string
}

export interface AdminList {
  admins: AdminRow[]
  sections: AdminSection[]
}

export interface DashboardHeadlines {
  /** Take records created in the period. */
  takes: number
  /** Their total length in minutes, one decimal. */
  minutes: number
  scripts: number
  practiceSessions: number
  phoneLinks: number
  /** People with an own AI key saved now. */
  ownKeyUsers: number
}

export interface DayCount {
  date: string
  count: number
}

/** Lower bound inclusive: lt1m < 60 s ≤ 1to5 < 300 s ≤ 5to15 < 900 s ≤ 15to30 < 1800 s ≤ gt30. */
export const DURATION_BUCKETS = ['lt1m', '1to5', '5to15', '15to30', 'gt30'] as const
export type DurationBucket = (typeof DURATION_BUCKETS)[number]

export type PracticeVia = 'web' | 'app' | 'phone'

export interface AnalyticsAiRow {
  provider: string
  paidWith: PaidWith
  calls: number
  failed: number
  units: number
  unit: 'words' | 'seconds'
  credits: number
}

export interface AdminAnalytics {
  generatedAt: string
  period: { days: number; from: string; to: string }
  takes: {
    count: number
    totalMinutes: number
    durationBuckets: Record<DurationBucket, number>
    byDay: { date: string; count: number; minutes: number }[]
    byKind: { audio: number; video: number }
  }
  scripts: { total: number; active: number; archived: number; createdInPeriod: number }
  practice: {
    sessions: number
    byDay: DayCount[]
    avgDurationS: number | null
    /** 0..1, null when there are no sessions. */
    recordedShare: number | null
    usersPractising: number
    byVia: Record<PracticeVia, number>
  }
  phoneLinks: {
    started: number
    byHostKind: { web: number; app: number }
    byDay: DayCount[]
    avgDurationS: number | null
  }
  drives: { linked: number; byProvider: Record<string, number> }
  ownKeys: { users: number; byProvider: Record<AiProvider, number> }
  aiUsage: AnalyticsAiRow[]
}

export interface PracticeSession {
  id: string
  scriptId: string | null
  startedAt: string
  durationS: number
  recorded: boolean
  via: PracticeVia
  createdAt: string
}

export interface PracticeInput {
  scriptId?: string | null
  startedAt: string
  /** Whole seconds, 1..21600. */
  durationS: number
  recorded: boolean
  via: PracticeVia
}

/** Never a provider file id or any media. */
export interface AdminTake {
  id: string
  scriptId: string | null
  scriptTitle: string | null
  title: string
  kind: 'audio' | 'video'
  mime: string
  durationMs: number
  sizeBytes: number
  recordedAt: string
  starred: boolean
  provider: string
  state: 'uploading' | 'backed_up' | 'unreachable' | 'failed'
  createdAt: string
}

/** Never the body, marks or reading position. */
export interface AdminScript {
  id: string
  title: string
  wordCount: number
  archived: boolean
  archivedAt: string | null
  pinned: boolean
  lastOpenedAt: string | null
  takes: number
  practiceSessions: number
  createdAt: string
  updatedAt: string
}

export interface AdminLinkRemote {
  id: string
  kind: 'browser' | 'app'
  name: string
  status: 'pending' | 'active' | 'replaced' | 'declined' | 'ended'
  pairedAt: string
  lastSeenAt: string | null
  endedAt: string | null
}

export interface AdminLink {
  id: string
  scriptId: string | null
  scriptTitle: string | null
  hostKind: 'web' | 'app'
  hostLabel: string
  player: 'host' | 'remote'
  state: 'waiting' | 'connected' | 'ended'
  startedAt: string
  lastUsedAt: string
  endedAt: string | null
  endReason: string | null
  remotes: AdminLinkRemote[]
}

export interface AdminConnections {
  storage: { provider: string; accountEmail: string; state: 'linked' | 'revoked'; linkedAt: string }[]
  aiKeys: { capability: 'text'; provider: AiProvider; last4: string; checkOk: boolean; checkedAt: string }[]
  devices: AdminDevice[]
  webSessions: number
}

export interface AdminPreferences {
  locale: Locale
  theme: Theme
  /** The 001 reading settings as saved. */
  reading: Partial<ReadingSettings> & Record<string, unknown>
  syncMode: SyncMode
}

/** An admin report period: the last N days (1–365) ending now, or whole UTC days `from`–`to` (`YYYY-MM-DD`, ≤ 366 days, not after today). */
export type AdminPeriodQuery = number | { from: string; to: string }
