/**
 * Service ports. The UI and stores depend only on these interfaces (constitution III).
 * Phase 1: services/mock. Later: services/http (Laravel). Contracts: specs/001-studio-frontend/contracts/ports.md
 */
import type { Invitation, LegacyScript, ReadingPosition, ReadingSettings, Script, ScriptPatch, ScriptSummary, User, WaitlistEntry } from './types'

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
}

export interface AccountPort {
  updatePrefs(patch: Partial<Pick<User, 'locale' | 'theme' | 'name'>>): Promise<User>
  updateReading(settings: ReadingSettings): Promise<User>
  exportData(input: { password: string }): Promise<Blob>
  changePassword(input: { current: string; next: string }): Promise<void>
  deleteAccount(input: { password: string }): Promise<void>
}

/**
 * Scripts an older version of the app left in this browser (6:68–6:71). Read only after the user agrees
 * (they may belong to someone else on a shared computer). Adding one goes through ScriptsPort.create.
 */
export interface LegacyPort {
  scan(): Promise<LegacyScript[]>
}

/**
 * Admin area: who is waiting, and the invitations sent. Admins only; anyone else gets `not_found`, as if the area did
 * not exist. The in-browser mock has no admins, so every call rejects with `not_found` there.
 */
export interface AdminPort {
  waitlist(): Promise<WaitlistEntry[]>
  invitations(): Promise<Invitation[]>
  /** From the waitlist or a new email. Rejects with `conflict` when the email has an account or a pending invitation. */
  invite(input: { email: string }): Promise<Invitation>
  /** New link and expiry for a pending invitation; the old link stops working. */
  resend(id: string): Promise<Invitation>
  withdraw(id: string): Promise<void>
}

export interface Services {
  auth: AuthPort
  waitlist: WaitlistPort
  scripts: ScriptsPort
  account: AccountPort
  admin: AdminPort
  legacy: LegacyPort
}
