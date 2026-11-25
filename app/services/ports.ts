/**
 * Service ports. The UI and stores depend only on these interfaces (constitution III).
 * Phase 1: services/mock. Later: services/http (Laravel). Contracts: specs/001-studio-frontend/contracts/ports.md
 */
import type {
  Device, Invitation, LegacyScript, MyPlan, PendingEmail, Plan, ReadingPosition, ReadingSettings, RemoteTake, RemoteTakeInput,
  Script, ScriptPatch, ScriptSummary, ScriptVersion, ScriptVersionSummary, StorageStatus, SyncMode, UpgradePeriod, UpgradeRequest,
  UploadToken, User, WaitlistEntry,
  ConnectionState, LinkAck, LinkAuth, LinkCommand, LinkEvent, LinkParty, Pairing, PairingCode, PhoneLink, PhoneLinkWithCode,
  PresenceMember, RealtimeSettings, StudioState,
  AiProvider, Credits, FormatEstimate, FormatSuggestion, OwnKey, SpeechLanguage, SpeechPurpose, SpeechResult, SpeechUpload,
  Transcription, TranscriptionEstimate, TranscriptionPermission,
  AddCreditsInput, AdminDashboard, AdminOverride, AdminPlan, AdminPlanLimit, AdminSettings, AdminSubscription, AdminSubscriptionRow,
  AdminUpgradeRequest, AdminUserDetail, AdminUserFilters, AdminUserRow, AdminAiCall, AiCallFilters, AiKeyState, AiUsage, AuditAction,
  AuditEntry, AuditFilters, ChangePlanInput, CreditEntry, FeatureFlag, GrantSubscriptionInput, LedgerEntry, LedgerFilters,
  LimitDefinition, OverrideInput, Page, PaymentsPage, Period, PlanInput, PublicSettings, SignupMode, SubscriptionFilters,
  SubscriptionPatch, UsageGroupBy, AdminLimitValue, Locale,
  AdminAnalytics, AdminConnections, AdminLink, AdminList, AdminPermissionsInput, AdminPreferences, AdminRow, AdminScript, AdminTake,
  PracticeInput, PracticeSession,
} from './types'

export interface AuthPort {
  me(): Promise<User | null>
  signIn(input: { email: string; password: string }): Promise<User>
  signOut(): Promise<void>
  /** Always resolves, whether or not the email has an account. */
  requestPasswordReset(input: { email: string }): Promise<void>
  checkResetToken(token: string): Promise<{ email: string }>
  resetPassword(input: { token: string; password: string }): Promise<User>
  checkInvite(token: string): Promise<{ email: string }>
  acceptInvite(input: { token: string; name: string; password: string }): Promise<User>
  /** Release 2: confirms an email change from the emailed link. Public. */
  confirmEmail(token: string): Promise<{ email: string }>
  /** One-time notice from the last sign-in (`deletion_cancelled`), cleared when read. */
  lastNotice(): 'deletion_cancelled' | null
  /** Feature 006: public sign-up, signs in. `signup_closed` while the mode is invite-only; email taken → `validation` on `email`. */
  signUp(input: { name: string; email: string; password: string; locale: Locale }): Promise<User>
}

/** Feature 006: sign-up mode and feature flags. Public (no sign-in). */
export interface SettingsPort {
  public(): Promise<PublicSettings>
}

export interface WaitlistPort {
  join(input: { email: string }): Promise<void>
}

export interface ScriptsPort {
  list(): Promise<ScriptSummary[]>
  /** Ids of scripts whose title or body contains the query (case- and diacritic-insensitive). */
  search(query: string): Promise<string[]>
  get(id: string): Promise<Script>
  create(input: { title: string; body?: string }): Promise<Script>
  /** Rejects with `conflict` (and the server copy) when `baseVersion` is stale. */
  update(id: string, patch: ScriptPatch, baseVersion: number): Promise<Script>
  duplicate(id: string): Promise<Script>
  remove(id: string): Promise<void>
  savePosition(id: string, position: ReadingPosition): Promise<void>
  /** Release 2 (US5): newest first, without text. */
  listVersions(id: string): Promise<ScriptVersionSummary[]>
  getVersion(id: string, versionId: string): Promise<ScriptVersion>
  /** Versioned save: the current text is kept as a `restore` version. `conflict` when `baseVersion` is stale. */
  restoreVersion(id: string, versionId: string, baseVersion: number): Promise<Script>
}

export interface AccountPort {
  updatePrefs(patch: Partial<Pick<User, 'locale' | 'theme' | 'name'>>): Promise<User>
  updateReading(settings: ReadingSettings): Promise<User>
  exportData(input: { password: string }): Promise<Blob>
  changePassword(input: { current: string; next: string }): Promise<void>
  /** Release 2: schedules deletion in 14 days and signs out everywhere. Signing in before then cancels it. */
  deleteAccount(input: { password: string }): Promise<{ deletionDueAt: string }>
  requestEmailChange(input: { email: string; password: string }): Promise<PendingEmail>
  pendingEmailChange(): Promise<PendingEmail | null>
  cancelEmailChange(): Promise<void>
  resendEmailChange(): Promise<void>
  listDevices(): Promise<Device[]>
  revokeDevice(id: string): Promise<void>
}

/** Release 2 (US1, US2): plans as data, the person's effective limits, upgrade requests. */
export interface PlanPort {
  /** Public: active plans with prices and limits. */
  listPlans(): Promise<Plan[]>
  myPlan(): Promise<MyPlan>
  requestUpgrade(input: { plan: string; period: UpgradePeriod }): Promise<{ request: UpgradeRequest; whatsappUrl: string | null }>
  cancelRequest(): Promise<void>
}

/** A Drive resumable upload in progress. */
export interface DriveSession {
  url: string
}

/** Browser → Google Drive file transfer (services/drive/uploader.ts; the mock uses a fake Drive). */
export interface DriveUploader {
  /** Opens a resumable session for `file` in `folderId`. */
  start(file: Blob, meta: { name: string; mimeType: string }, folderId: string, token: string): Promise<DriveSession>
  /** Sends the rest of the file from the offset Google reports; resolves with the Drive file id. */
  resume(session: DriveSession, file: Blob, token: string, onProgress: (sent: number, total: number) => void, signal?: AbortSignal): Promise<{ fileId: string }>
  download(fileId: string, token: string): Promise<Blob>
  remove(fileId: string, token: string): Promise<void>
}

/** Release 2 (US3): linked storage. Take bytes never go through Tilw: only metadata and short-lived tokens. */
export interface StoragePort {
  status(): Promise<StorageStatus>
  /** Google consent URL; the browser navigates there and comes back to /app/settings/storage?linked=1|error=… */
  connectUrl(client: 'web'): Promise<string>
  unlink(): Promise<void>
  setSyncMode(mode: SyncMode): Promise<{ mode: SyncMode }>
  uploadToken(scriptId?: string | null): Promise<UploadToken>
  uploader(): DriveUploader
}

/** Release 2 (US3): the service's records of takes backed up to Drive, from every device. */
export interface RemoteTakesPort {
  list(scriptId?: string): Promise<RemoteTake[]>
  /** Idempotent on `clientId`. Checks takes.max_minutes and storage.providers. */
  register(input: RemoteTakeInput): Promise<RemoteTake>
  update(id: string, patch: Partial<Pick<RemoteTake, 'title' | 'starred' | 'providerFileId'>> & { state?: 'backed_up' | 'unreachable' }): Promise<RemoteTake>
  /** `remote: true` also deletes the Drive file. */
  remove(id: string, opts: { remote: boolean }): Promise<void>
}

/**
 * Scripts an older version of the app left in this browser (6:68–6:71). Read only after the user agrees
 * (they may belong to someone else on a shared computer). Adding one goes through ScriptsPort.create.
 */
export interface LegacyPort {
  scan(): Promise<LegacyScript[]>
}

/**
 * Admin console (feature 006, backend 005). Admins only; anyone else gets `not_found`, as if the area did not exist.
 * Contract: specs/006-admin-console/contracts/ports.md.
 */
export interface AdminPort {
  // ---------- joining (001, 005 filters) ----------
  waitlist(filters?: { q?: string; invited?: boolean }): Promise<WaitlistEntry[]>
  removeWaitlist(id: string): Promise<void>
  invitations(): Promise<Invitation[]>
  /** From the waitlist or a new email. Rejects with `conflict` when the email has an account or a pending invitation. */
  invite(input: { email: string }): Promise<Invitation>
  /** New link and expiry for a pending invitation; the old link stops working. */
  resend(id: string): Promise<Invitation>
  withdraw(id: string): Promise<void>

  // ---------- dashboard and people ----------
  dashboard(days: number): Promise<AdminDashboard>
  users(filters: AdminUserFilters, cursor?: string | null, limit?: number): Promise<Page<AdminUserRow>>
  user(id: string): Promise<AdminUserDetail>
  suspend(id: string, reason: string): Promise<AdminUserDetail>
  unsuspend(id: string): Promise<AdminUserDetail>
  sendPasswordReset(id: string): Promise<{ sentTo: string }>
  changePlan(id: string, input: ChangePlanInput): Promise<AdminUserDetail>
  grantAdmin(id: string): Promise<AdminUserDetail>
  revokeAdmin(id: string): Promise<AdminUserDetail>
  scheduleDeletion(id: string, reason: string): Promise<AdminUserDetail>
  cancelDeletion(id: string): Promise<AdminUserDetail>
  /** `idempotencyKey`: one per form opening, so a retry or double-click applies once. */
  addCredits(id: string, input: AddCreditsInput, idempotencyKey?: string): Promise<CreditEntry>
  setOverride(id: string, key: string, input: OverrideInput): Promise<AdminOverride>
  removeOverride(id: string, key: string): Promise<void>
  userSubscriptions(id: string): Promise<AdminSubscription[]>
  grantSubscription(id: string, input: GrantSubscriptionInput): Promise<AdminSubscription>

  // ---------- plans and quotas (002) ----------
  plans(): Promise<AdminPlan[]>
  createPlan(input: PlanInput & { key: string; nameAr: string; nameEn: string; priceMonthlyCents: number; priceYearlyCents: number }): Promise<AdminPlan>
  updatePlan(id: string, input: PlanInput): Promise<AdminPlan>
  setPlanLimit(id: string, key: string, value: AdminLimitValue): Promise<AdminPlanLimit>
  unsetPlanLimit(id: string, key: string): Promise<void>
  limitDefinitions(): Promise<LimitDefinition[]>
  defineLimit(input: { key: string; type: 'int' | 'bool' | 'list'; default?: AdminLimitValue; counted?: boolean; labelAr: string; labelEn: string }): Promise<LimitDefinition>

  // ---------- money ----------
  subscriptions(filters: SubscriptionFilters, cursor?: string | null): Promise<Page<AdminSubscriptionRow>>
  updateSubscription(id: string, patch: SubscriptionPatch): Promise<AdminSubscription>
  requests(filters?: { q?: string; state?: AdminUpgradeRequest['state'] }): Promise<AdminUpgradeRequest[]>
  fulfilRequest(id: string, input?: { startsAt?: string; endsAt?: string; note?: string }): Promise<AdminSubscription>
  rejectRequest(id: string, note?: string): Promise<AdminUpgradeRequest>
  payments(filters: Period & { userId?: string }, cursor?: string | null): Promise<PaymentsPage>

  // ---------- AI ----------
  aiUsage(period: Period, groupBy: UsageGroupBy): Promise<AiUsage>
  aiCalls(filters: AiCallFilters, cursor?: string | null): Promise<Page<AdminAiCall>>
  ledger(filters: LedgerFilters, cursor?: string | null): Promise<Page<LedgerEntry>>

  // ---------- settings ----------
  settings(): Promise<AdminSettings>
  setSignupMode(mode: SignupMode): Promise<AdminSettings>
  /** The key is sent once and never comes back; only last4 does. */
  setAiKey(provider: AiKeyState['provider'], input: { key: string; project?: string }): Promise<AiKeyState>
  removeAiKey(provider: AiKeyState['provider']): Promise<AiKeyState>
  setFlag(key: string, input: { enabled: boolean; description?: string | null }): Promise<FeatureFlag>
  removeFlag(key: string): Promise<void>

  // ---------- audit ----------
  auditLog(filters: AuditFilters, cursor?: string | null): Promise<Page<AuditEntry>>
  auditActions(): Promise<AuditAction[]>

  // ---------- feature 007: analytics, one person's insights, admins ----------
  /** Aggregates over the last `days` (1..365) ending now. Section users (view). */
  analytics(days: number): Promise<AdminAnalytics>
  /** Newest recording first; metadata only. */
  userTakes(id: string, cursor?: string | null, limit?: number): Promise<Page<AdminTake>>
  /** Most recently updated first; never the text. */
  userScripts(id: string, cursor?: string | null, limit?: number): Promise<Page<AdminScript>>
  /** Newest start first, with their remotes. */
  userLinks(id: string, cursor?: string | null, limit?: number): Promise<Page<AdminLink>>
  /** Not paged. */
  userConnections(id: string): Promise<AdminConnections>
  /** Not paged. */
  userPreferences(id: string): Promise<AdminPreferences>
  /** The super admin first, then by email. Needs admins (edit), reads too. */
  admins(): Promise<AdminList>
  /** Exactly one of userId / email. `conflict` when already an admin, suspended or leaving. */
  addAdmin(input: ({ userId: string; email?: never } | { email: string; userId?: never }) & { permissions: AdminPermissionsInput }): Promise<AdminRow>
  /** Replaces the whole map. `super_admin_locked` for the super admin; `conflict` for yourself. */
  updateAdmin(id: string, permissions: AdminPermissionsInput): Promise<AdminRow>
  /** `super_admin_locked` for the super admin; `conflict` for yourself or the last admin. */
  removeAdmin(id: string): Promise<void>
}

/** Feature 007: one finished teleprompter run, with or without a take. */
export interface PracticePort {
  /** `not_found` when the script isn't the caller's own. */
  log(input: PracticeInput): Promise<PracticeSession>
}

/** Feature 004: the owner's phone links (session). Contract: specs/004-phone-link/contracts/ports.md. */
export interface LinkPort {
  /** Starts (or reuses) the open link for this script and studio, with a fresh code. */
  start(scriptId: string): Promise<PhoneLinkWithCode>
  /** The open link for this script and studio, if any (rejoin after a reload). */
  current(scriptId: string): Promise<PhoneLink | null>
  /** Open links and links ended within 30 days, newest first. */
  list(): Promise<PhoneLink[]>
  newCode(linkId: string): Promise<PairingCode>
  update(linkId: string, patch: { previews: boolean }): Promise<PhoneLink>
  end(linkId: string): Promise<void>
  acceptRemote(linkId: string, remoteId: string): Promise<PhoneLink>
  declineRemote(linkId: string, remoteId: string): Promise<void>
}

/** Feature 004: what either side of a link sends. The phone has no session; it signs calls with its `rl_` credential. */
export interface LinkRelayPort {
  /** Public. `token_invalid` for a wrong, used or expired code (always the same), `rate_limited` after 5 wrong tries. */
  pair(input: { code: string } | { secret: string }, name?: string): Promise<Pairing>
  command(auth: LinkAuth, linkId: string, cmd: LinkCommand): Promise<void>
  ack(auth: LinkAuth, linkId: string, ack: LinkAck): Promise<void>
  state(auth: LinkAuth, linkId: string, state: StudioState): Promise<void>
  ping(auth: LinkAuth, linkId: string): Promise<void>
  leave(auth: LinkAuth, linkId: string): Promise<void>
  requestRoles(auth: LinkAuth, linkId: string, player: LinkParty): Promise<void>
  answerRoles(auth: LinkAuth, linkId: string, accept: boolean): Promise<void>
}

/** Feature 004: the live channel. The socket only receives; everything is sent over the relay port. */
export interface RealtimeConnection {
  readonly state: ConnectionState
  onState(cb: (s: ConnectionState) => void): () => void
  /** Private channel; resolves to an unsubscribe once subscribed, rejects when authorisation is refused. */
  subscribe(channel: string, onEvent: (e: LinkEvent) => void): Promise<() => void>
  presence(channel: string, on: {
    members: (m: PresenceMember[]) => void
    added: (m: PresenceMember) => void
    removed: (m: PresenceMember) => void
  }): Promise<() => void>
  close(): void
}

export interface RealtimePort {
  /** Where the studio connects; null when phone link can't reach a realtime server. */
  settings(): RealtimeSettings | null
  connect(auth: LinkAuth, settings: RealtimeSettings): RealtimeConnection
}

/**
 * Feature 005: AI writing tools (backend 004). Contract: specs/005-ai-writing-tools/contracts/ports.md.
 * Never carries audio or transcribed text: only lengths, sizes, types and the provider's request id.
 */
export interface AiPort {
  /** What formatting this script costs, and how it would be paid. */
  formatEstimate(scriptId: string): Promise<FormatEstimate>
  /** Charges, formats and stores the suggestion (replacing any older one). Can take up to about 60 s. */
  format(scriptId: string, opts?: { useCredits?: boolean }): Promise<FormatSuggestion>
  /** The waiting suggestion, or null when there is none (or it expired). */
  suggestion(scriptId: string): Promise<FormatSuggestion | null>
  /** Credits stay spent. */
  discard(scriptId: string): Promise<void>
  /** Versioned save against the suggestion's base version; `conflict` + the script when it changed since. */
  apply(scriptId: string): Promise<Script>
  credits(): Promise<Credits>
  keys(): Promise<OwnKey[]>
  /** Checked with the provider first; `own_key_refused` and not saved when the provider refuses it. */
  saveKey(input: { provider: AiProvider; key: string }): Promise<OwnKey>
  deleteKey(): Promise<void>
  checkKey(): Promise<OwnKey>
  /** `purpose` matters for the type check: video is allowed only for captions. */
  transcriptionEstimate(input: { seconds: number; bytes: number; mimeType: string; purpose?: SpeechPurpose }): Promise<TranscriptionEstimate>
  /** Pays for a short-lived permission to send this audio straight to the speech provider. */
  startTranscription(input: { seconds: number; bytes: number; mimeType: string; language?: SpeechLanguage; purpose?: SpeechPurpose }): Promise<TranscriptionPermission>
  transcription(id: string): Promise<Transcription>
  /** Reports the provider's request id; the service settles on the real length. */
  complete(id: string, requestId: string): Promise<Transcription>
  /** Notes a failure on the device. Refunds nothing by itself. */
  fail(id: string, reason?: string): Promise<Transcription>
}

/** Feature 005: browser → speech provider (backend device-flows §1). The only code that talks to the provider. */
export interface SpeechPort {
  send(upload: SpeechUpload, audio: Blob, opts: { seconds: number; purpose: SpeechPurpose; language: SpeechLanguage; signal?: AbortSignal }): Promise<SpeechResult>
}

export interface Services {
  auth: AuthPort
  waitlist: WaitlistPort
  scripts: ScriptsPort
  account: AccountPort
  admin: AdminPort
  legacy: LegacyPort
  plans: PlanPort
  storage: StoragePort
  remoteTakes: RemoteTakesPort
  links: LinkPort
  relay: LinkRelayPort
  realtime: RealtimePort
  ai: AiPort
  speech: SpeechPort
  settings: SettingsPort
  practice: PracticePort
}
