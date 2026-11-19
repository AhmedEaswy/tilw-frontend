/**
 * Service ports. The UI and stores depend only on these interfaces (constitution III).
 * Phase 1: services/mock. Later: services/http (Laravel). Contracts: specs/001-studio-frontend/contracts/ports.md
 */
import type { ReadingPosition, ReadingSettings, Script, ScriptPatch, ScriptSummary, User } from './types'

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

export interface Services {
  auth: AuthPort
  waitlist: WaitlistPort
  scripts: ScriptsPort
  account: AccountPort
}
