/**
 * Persistent state for the mock backend. Lives in localStorage (or any KV for tests).
 * MOCK ONLY: passwords are stored in plain text because nothing here ever leaves the browser;
 * the real backend hashes them.
 */
import type { Script, User } from '../types'
import { seedScripts, seedUser } from './seed'

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
}

export interface OutboxMail {
  id: string
  to: string
  kind: 'reset' | 'invite' | 'waitlist'
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
}

export interface MockKnobs {
  latencyMs: number
  /** 0..1 chance that any call fails with a network error. */
  failRate: number
  offline: boolean
  forceConflictOnNextSave: boolean
  expireTokens: boolean
}

export const DEFAULT_KNOBS: MockKnobs = {
  latencyMs: 300,
  failRate: 0,
  offline: false,
  forceConflictOnNextSave: false,
  expireTokens: false,
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
  }
}

export class MockDb {
  private state: MockState
  knobs: MockKnobs

  constructor(private kv: KV) {
    this.state = this.read<MockState>(STATE_KEY) ?? freshState()
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
