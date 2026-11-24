/**
 * Persistent state for the mock backend. Lives in localStorage (or any KV for tests).
 * MOCK ONLY: passwords are stored in plain text because nothing here ever leaves the browser;
 * the real backend hashes them.
 */
import type { Device, RemoteTake, Script, ScriptVersion, SyncMode, UpgradeRequest, User } from '../types'
import type { DriveMode, FakeDriveState } from './drive'
import { LIMIT_DEFINITIONS, seedPlans, type MockLimitDefinition, type MockPlan, type MockSubscription, type RawLimit } from './plans'
import { seedDevices, seedScripts, seedUser } from './seed'

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface MockToken {
  token: string
  email: string
  expiresAt: number
  usedAt: number | null
  /** Feature 006 (invitations): id, when it was made, and a withdrawal (the link stops working). */
  id?: string
  createdAt?: number
  withdrawnAt?: number | null
}

export interface OutboxMail {
  id: string
  to: string
  kind: 'reset' | 'invite' | 'waitlist' | 'email'
  link: string | null
  sentAt: number
}

export interface MockState {
  version: 1
  users: (User & { password: string })[]
  sessionUserId: string | null
  scripts: Record<string, Script[]>
  waitlist: { email: string; createdAt: number }[]
  invites: MockToken[]
  resets: MockToken[]
  outbox: OutboxMail[]
  // ---------- release 2 ----------
  plans: MockPlan[]
  limitDefinitions: MockLimitDefinition[]
  /** userId → limit key → value. */
  overrides: Record<string, Record<string, RawLimit>>
  subscriptions: MockSubscription[]
  requests: (UpgradeRequest & { userId: string; handledBy?: string | null; handledAt?: string | null; note?: string | null; subscriptionId?: string | null })[]
  /** userId → the plan key last reported, for the one-time pro_started / pro_ended notices. */
  seenPlan: Record<string, string>
  /** scriptId → snapshots, oldest first. */
  versions: Record<string, ScriptVersion[]>
  /** userId → linked storage. */
  storage: Record<string, { state: 'none' | 'linked' | 'revoked'; accountEmail: string | null; syncMode: SyncMode }>
  remoteTakes: Record<string, RemoteTake[]>
  drive: FakeDriveState
  devices: Record<string, Device[]>
  emailChange: Record<string, { email: string; token: string; expiresAt: number }>
  /** userId → scheduled deletion time. */
  deletion: Record<string, number>
}

export interface MockKnobs {
  latencyMs: number
  /** 0..1 chance that any call fails with a network error. */
  failRate: number
  offline: boolean
  forceConflictOnNextSave: boolean
  expireTokens: boolean
  /** Reading-position saves fail (reader recovery, 6:79). */
  failPositionSave: boolean
  /** Release 2: moves the mock's clock (subscriptions, requests, history). */
  clockOffsetMs: number
  driveMode: DriveMode
  /** Google consent page answers "declined". */
  denyDriveConsent: boolean
  /** Public plan catalogue unreachable (landing fallback). */
  plansDown: boolean
}

export const DEFAULT_KNOBS: MockKnobs = {
  latencyMs: 300,
  failRate: 0,
  offline: false,
  forceConflictOnNextSave: false,
  expireTokens: false,
  failPositionSave: false,
  clockOffsetMs: 0,
  driveMode: 'ok',
  denyDriveConsent: false,
  plansDown: false,
}

const STATE_KEY = 'tilw:mock:v1'
const KNOBS_KEY = 'tilw:mock:knobs'

export function freshState(now = Date.now()): MockState {
  const user = seedUser(new Date(now).toISOString())
  return {
    version: 1,
    users: [user],
    sessionUserId: null,
    scripts: { [user.id]: seedScripts(now) },
    waitlist: [],
    invites: [{ token: 'demo-invite', email: 'invited@example.com', expiresAt: now + 7 * 86_400_000, usedAt: null }],
    resets: [],
    outbox: [],
    plans: seedPlans(),
    limitDefinitions: LIMIT_DEFINITIONS.map(d => ({ ...d, label: { ...d.label } })),
    overrides: {},
    subscriptions: [],
    requests: [],
    seenPlan: {},
    versions: {},
    storage: {},
    remoteTakes: {},
    drive: { files: {}, sessions: {} },
    devices: { [user.id]: seedDevices(now) },
    emailChange: {},
    deletion: {},
  }
}

export class MockDb {
  private state: MockState
  knobs: MockKnobs

  constructor(private kv: KV) {
    // Saved release-1 state gains the release-2 collections with their seed values.
    const saved = this.read<MockState>(STATE_KEY)
    this.state = saved ? { ...freshState(), ...saved } : freshState()
    this.knobs = { ...DEFAULT_KNOBS, ...this.read<Partial<MockKnobs>>(KNOBS_KEY) }
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.kv.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  get s(): MockState {
    return this.state
  }

  /** Mutate and persist in one step. */
  write<T>(fn: (s: MockState) => T): T {
    const out = fn(this.state)
    this.kv.setItem(STATE_KEY, JSON.stringify(this.state))
    return out
  }

  /** Re-read state another tab wrote (the mock has no server to share it otherwise). */
  reload() {
    const saved = this.read<MockState>(STATE_KEY)
    if (saved) this.state = { ...freshState(), ...saved }
    this.knobs = { ...DEFAULT_KNOBS, ...this.read<Partial<MockKnobs>>(KNOBS_KEY) }
  }

  setKnobs(patch: Partial<MockKnobs>) {
    this.knobs = { ...this.knobs, ...patch }
    this.kv.setItem(KNOBS_KEY, JSON.stringify(this.knobs))
  }

  reset() {
    this.state = freshState()
    this.kv.setItem(STATE_KEY, JSON.stringify(this.state))
  }
}

export function memoryKV(): KV {
  const m = new Map<string, string>()
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
  }
}
