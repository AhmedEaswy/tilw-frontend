/**
 * Feature 006: mock of the backend 005 admin console (research R12). Admin-only data (sign-up mode, flags, platform key
 * states, suspensions, last-active times, who scheduled a deletion, override details, credit-entry authors,
 * idempotency keys, seeded AI calls, the audit log) lives in KV `tilw:mock:admin:v1`; people, plans, subscriptions,
 * requests, the waitlist and invitations stay in the main mock state (seeded once with a demo admin and ~40 people).
 *
 * Same refusals as the backend: `not_found` for non-admins; `conflict` for the admin's own account, an admin target,
 * the last admin, a state that already holds, and the plan already in force. Every successful write adds one audit
 * entry with the backend's action name; a refused one adds none.
 */
import type { AdminPort, SettingsPort } from '../ports'
import {
  PortError,
  type AddCreditsInput, type AdminAiCall, type AdminDashboard, type AdminLimitValue, type AdminOverride, type AdminPlan, type AdminSettings,
  type AdminStatus, type AdminSubscription, type AdminSubscriptionRow, type AdminUpgradeRequest, type AdminUserDetail, type AdminUserRow,
  type AiCapability, type AiKeyState, type AiUsage, type AuditAction, type AuditEntry, type CreditEntry, type CreditKind, type FeatureFlag,
  type Invitation, type LedgerEntry, type Page, type PaymentsPage, type PendingRequestRef, type PersonRef, type SignupMode, type UsageFigures,
  type UsageGroup, type User, type WaitlistEntry, FLAG_KEY,
} from '../types'
import { DEFAULT_READING } from '../types'
import { isEmail, normalizeEmail } from '../../utils/text'
import type { KV, MockDb, MockToken } from './db'
import { limitValue, periodEnd, requestReference, type LimitContext, type MockSubscription, type RawLimit } from './plans'
import { SEED_PASSWORD } from './seed'

const KEY = 'tilw:mock:admin:v1'
const DAY = 86_400_000
const INVITE_TTL = 7 * DAY
const RESET_TTL = 60 * 60_000
const DELETION_GRACE = 14 * DAY
export const MOCK_ADMIN_ID = 'u_admin'
export const MOCK_ADMIN_EMAIL = 'admin@example.com'

/** Backend audit action names (GET /api/admin/audit-log/actions). */
export const AUDIT_ACTIONS: AuditAction[] = [
  ['user.suspend', 'User'], ['user.unsuspend', 'User'], ['user.password_reset', 'User'], ['user.plan_change', 'User'],
  ['user.admin_grant', 'User'], ['user.admin_revoke', 'User'], ['user.delete_schedule', 'User'], ['user.delete_cancel', 'User'],
  ['credits.grant', 'User'], ['credits.correct', 'User'], ['override.set', 'User'], ['override.remove', 'User'],
  ['subscription.grant', 'Subscription'], ['subscription.update', 'Subscription'], ['subscription.end', 'Subscription'],
  ['request.fulfil', 'SubscriptionRequest'], ['request.reject', 'SubscriptionRequest'],
  ['plan.create', 'Plan'], ['plan.update', 'Plan'], ['limit.set', 'Plan'], ['limit.unset', 'Plan'], ['limit.define', 'LimitDefinition'],
  ['waitlist.remove', 'WaitlistEntry'], ['invitation.create', 'Invitation'], ['invitation.resend', 'Invitation'], ['invitation.withdraw', 'Invitation'],
  ['settings.signup_mode', 'Setting'], ['settings.ai_key_set', 'Setting'], ['settings.ai_key_remove', 'Setting'],
  ['flag.set', 'FeatureFlag'], ['flag.remove', 'FeatureFlag'],
].map(([action, targetType]) => ({ action: action!, targetType: targetType! }))

interface SeedCall {
  id: string
  userId: string
  capability: AiCapability
  provider: string
  paidWith: 'credits' | 'own_key'
  units: number
  credits: number
  status: 'pending' | 'succeeded' | 'failed'
  failure: string | null
  createdAt: number
}

interface AdminState {
  signupMode: SignupMode
  flags: FeatureFlag[]
  keys: Partial<Record<'anthropic' | 'deepgram', { last4: string; updatedAt: string; project: string | null }>>
  suspensions: Record<string, { at: number; reason: string; byId: string | null }>
  lastActive: Record<string, number>
  deletionBy: Record<string, string>
  overrideMeta: Record<string, Record<string, { id: string; endsAt: string | null; note: string | null; createdBy: string | null }>>
  entryBy: Record<string, string>
  idempotency: Record<string, { userId: string; kind: string; amount: number; entry: CreditEntry }>
  calls: SeedCall[]
  audit: AuditEntry[]
  nextAuditId: number
  linkedAt: Record<string, number>
}

export interface MockAdminKnobs {
  /** Every admin read fails with a network error. */
  listsFail: boolean
  /** The dashboard answers zeros (an empty period). */
  emptyDashboard: boolean
}

export interface MockAdminDeps {
  kv: KV
  db: MockDb
  now: () => number
  call: <T>(fn: () => T) => Promise<T>
  origin: string
  sessionUserId: () => string | null
  mail: (to: string, kind: 'reset' | 'invite' | 'waitlist' | 'email', link: string | null) => void
  token: () => string
  ai: {
    credits: (userId: string) => { balance: number; monthly: number; monthlyLeft: number; granted: number; month: string }
    allEntries: () => (CreditEntry & { userId: string; month: string })[]
    adminEntry: (userId: string, input: AddCreditsInput) => CreditEntry
    ownKey: (userId: string) => { provider: 'anthropic' | 'openai'; last4: string; checkedAt: string } | null
    eraseKey: (userId: string) => void
  }
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7)

/** A small deterministic random (the seed is the same on every machine). */
function rng(seed: number) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const FIRST = ['عمر', 'سارة', 'نور', 'خالد', 'ريم', 'هالة', 'يوسف', 'آية', 'محمود', 'نادين', 'Daniel', 'Maya', 'Jonas', 'Lucas', 'Julia', 'Sam', 'Hana', 'Rania', 'Tarek', 'Mona']
const LAST = ['حداد', 'يوسف', 'منصور', 'عبدالله', 'سمير', 'رضا', 'علي', 'خليل', 'Reyes', 'Chen', 'Weber', 'Silva', 'Amin', 'Kamal', 'Fathy', 'Nasser']

export function createMockAdmin(d: MockAdminDeps) {
  const { db } = d
  const iso = (ms = d.now()) => new Date(ms).toISOString()
  const knobKey = `${KEY}:knobs`

  function read(): AdminState {
    let s: Partial<AdminState> | null = null
    try {
      const raw = d.kv.getItem(KEY)
      s = raw ? JSON.parse(raw) : null
    } catch {
      s = null
    }
    return {
      signupMode: s?.signupMode ?? 'invite_only',
      flags: s?.flags ?? [],
      keys: s?.keys ?? {},
      suspensions: s?.suspensions ?? {},
      lastActive: s?.lastActive ?? {},
      deletionBy: s?.deletionBy ?? {},
      overrideMeta: s?.overrideMeta ?? {},
      entryBy: s?.entryBy ?? {},
      idempotency: s?.idempotency ?? {},
      calls: s?.calls ?? [],
      audit: s?.audit ?? [],
      nextAuditId: s?.nextAuditId ?? 1,
      linkedAt: s?.linkedAt ?? {},
    }
  }
  let st = read()
  const save = () => d.kv.setItem(KEY, JSON.stringify(st))
  function tx<T>(fn: (s: AdminState) => T): T {
    st = read()
    const out = fn(st)
    save()
    return out
  }
  function knobs(): MockAdminKnobs {
    try {
      return { listsFail: false, emptyDashboard: false, ...JSON.parse(d.kv.getItem(knobKey) ?? '{}') }
    } catch {
      return { listsFail: false, emptyDashboard: false }
    }
  }

  // ---------- seed (once) ----------
  function seed() {
    if (db.s.users.some(u => u.id === MOCK_ADMIN_ID)) return
    const t = d.now()
    const r = rng(42)
    const at = (daysAgo: number) => t - daysAgo * DAY - Math.floor(r() * DAY)
    db.write((s) => {
      s.users.push({ id: MOCK_ADMIN_ID, name: 'سارة يوسف', email: MOCK_ADMIN_EMAIL, password: SEED_PASSWORD, locale: 'ar', theme: 'system', reading: { ...DEFAULT_READING }, isAdmin: true, createdAt: iso(at(300)) })
      s.users.push({ id: 'u_admin2', name: 'Admin Two', email: 'ops@example.com', password: SEED_PASSWORD, locale: 'en', theme: 'system', reading: { ...DEFAULT_READING }, isAdmin: true, createdAt: iso(at(280)) })
      for (let i = 0; i < 50; i++) {
        const first = FIRST[i % FIRST.length]!
        const last = LAST[(i * 7) % LAST.length]!
        const id = `u_seed${String(i).padStart(2, '0')}`
        const created = at(Math.floor(i * 1.6) + (i % 3))
        const email = `${first.match(/[a-z]/i) ? first.toLowerCase() : `p${i}`}.${i}@example.com`
        s.users.push({ id, name: `${first} ${last}`, email, password: SEED_PASSWORD, locale: i % 4 ? 'ar' : 'en', theme: 'system', reading: { ...DEFAULT_READING }, createdAt: iso(created) })
        // Every fourth person paid for Pro through a request.
        if (i % 4 === 1) {
          const period = i % 8 === 1 ? 'yearly' as const : 'monthly' as const
          const start = Math.max(created, t - (i + 2) * DAY)
          const reqId = `req_seed${i}`
          const priceCents = period === 'yearly' ? 7700 : 800
          s.requests.push({ id: reqId, userId: id, reference: requestReference(r), plan: 'pro', period, priceCents, state: 'fulfilled', createdAt: iso(start - DAY), expiresAt: iso(start + 29 * DAY), handledBy: MOCK_ADMIN_ID, handledAt: iso(start), note: null, subscriptionId: `sub_seed${i}` })
          s.subscriptions.push({ id: `sub_seed${i}`, userId: id, plan: 'pro', period, startsAt: start, endsAt: periodEnd(start, period), source: 'request', requestId: reqId, grantedBy: MOCK_ADMIN_ID, note: null, createdAt: start })
        }
        // Three people waiting for payment.
        if (i === 2 || i === 6 || i === 10) {
          const c = t - (i + 1) * 3_600_000
          s.requests.push({ id: `req_pend${i}`, userId: id, reference: requestReference(r), plan: 'pro', period: i === 2 ? 'yearly' : 'monthly', priceCents: i === 2 ? 7700 : 800, state: 'pending', createdAt: iso(c), expiresAt: iso(c + 30 * DAY) })
        }
        if (i % 3 === 0) {
          s.storage[id] = { state: 'linked', accountEmail: email.replace('@example.com', '@gmail.com'), syncMode: 'manual' }
          s.remoteTakes[id] = Array.from({ length: 1 + (i % 5) }, (_, k) => ({
            id: `rt_seed${i}_${k}`, clientId: `t_seed${i}_${k}`, scriptId: null, title: `Take ${k + 1}`, kind: 'video' as const, mime: 'video/webm',
            durationMs: 60_000 * (k + 1), sizeBytes: 18_000_000 * (k + 1), recordedAt: iso(at(k * 4)), starred: false, providerFileId: `drive_seed${i}_${k}`, state: 'backed_up' as const,
          }))
        }
      }
      // An admin-granted Pro and an ended one.
      s.subscriptions.push({ id: 'sub_grant', userId: 'u_seed03', plan: 'pro', period: 'custom', startsAt: t - 10 * DAY, endsAt: t + 355 * DAY, source: 'admin', grantedBy: MOCK_ADMIN_ID, note: 'Creator programme', createdAt: t - 10 * DAY })
      s.subscriptions.push({ id: 'sub_ended', userId: 'u_seed07', plan: 'pro', period: 'monthly', startsAt: t - 50 * DAY, endsAt: t - 30 * DAY, endedAt: t - 30 * DAY, endedReason: 'refund', source: 'request', note: null, createdAt: t - 50 * DAY })
      // The waitlist: some invited, some not, some already with an account.
      const wl = ['hana.k', 'm.fathy', 'lucas', 'aya.r', 'yousef.a', 'nada', 'julia', 'r.amin', 'tamer', 'salma', 'kareem', 'lina']
      wl.forEach((n, k) => {
        const email = `${n}@example.com`
        if (!s.waitlist.some(w => w.email === email)) s.waitlist.push({ email, createdAt: t - (k + 1) * DAY })
      })
      s.waitlist.push({ email: 'daniel.10@example.com', createdAt: t - 40 * DAY })
      const inv = (email: string, made: number, extra: Partial<MockToken> = {}): MockToken => ({ id: uid('inv'), token: d.token(), email, expiresAt: made + INVITE_TTL, usedAt: null, createdAt: made, withdrawnAt: null, ...extra })
      s.invites.push(inv('lucas@example.com', t - 2 * DAY), inv('julia@example.com', t - 5 * DAY, { usedAt: t - 4 * DAY }), inv('r.amin@example.com', t - 19 * DAY, { withdrawnAt: t - 18 * DAY }), inv('sam@example.com', t - 16 * DAY))
    })
    tx((s) => {
      const r2 = rng(7)
      const people = db.s.users.filter(u => u.id.startsWith('u_seed'))
      people.forEach((u, i) => {
        if (i % 5 !== 4) s.lastActive[u.id] = t - Math.floor(r2() * (i % 2 ? 2 : 25) * DAY)
        if (db.s.storage[u.id]) s.linkedAt[u.id] = t - (20 + i) * DAY
      })
      s.lastActive[MOCK_ADMIN_ID] = t
      s.suspensions.u_seed09 = { at: t - 3 * DAY, reason: '400 AI calls in an hour', byId: MOCK_ADMIN_ID }
      // Seeded AI calls over the last 30 days (some failures, some own-key).
      const fails = ['timeout', 'provider_error', 'bad_answer', 'changed_words', 'unverified']
      for (let k = 0; k < 60; k++) {
        const u = people[(k * 5) % people.length]!
        const capability: AiCapability = k % 3 === 0 ? 'transcribe' : k % 7 === 0 ? 'captions' : 'format'
        const ownKey = capability === 'format' && k % 6 === 1
        const failed = k % 9 === 4
        const units = capability === 'format' ? 400 + ((k * 137) % 2600) : 30 + ((k * 53) % 600)
        const credits = ownKey || failed ? 0 : Math.max(1, Math.ceil(units / (capability === 'format' ? 1000 : 60)))
        s.calls.push({
          id: `call_seed${k}`, userId: u.id, capability, provider: capability === 'format' ? (ownKey ? 'openai' : 'anthropic') : 'deepgram',
          paidWith: ownKey ? 'own_key' : 'credits', units, credits, status: failed ? 'failed' : 'succeeded', failure: failed ? fails[k % fails.length]! : null,
          createdAt: t - Math.floor((k / 2) * DAY) - 3_600_000,
        })
      }
      if (!s.flags.length) s.flags.push({ key: 'studio.new_editor', enabled: true, description: 'New script editor', updatedAt: iso(t - DAY) })
      // A few past admin actions, so the audit log and the user detail's activity are not empty.
      const past: [string, string, string | null, unknown, unknown, number][] = [
        ['user.suspend', 'User', 'u_seed09', { status: 'active' }, { status: 'suspended', reason: '400 AI calls in an hour' }, 3],
        ['request.fulfil', 'SubscriptionRequest', 'req_seed1', { state: 'pending' }, { state: 'fulfilled' }, 4],
        ['subscription.grant', 'Subscription', 'sub_grant', null, { userId: 'u_seed03', plan: 'pro' }, 10],
        ['settings.signup_mode', 'Setting', 'signup_mode', { signupMode: 'open' }, { signupMode: 'invite_only' }, 12],
        ['invitation.withdraw', 'Invitation', null, { state: 'pending' }, { state: 'withdrawn' }, 18],
      ]
      for (const [action, targetType, targetId, before, after, daysAgo] of past.reverse()) {
        s.audit.unshift({ id: s.nextAuditId++, adminId: MOCK_ADMIN_ID, adminEmail: null, action, targetType, targetId, before: before as AuditEntry['before'], after: after as AuditEntry['after'], createdAt: iso(t - daysAgo * DAY) })
      }
    })
    // Credit grants and a correction by the admin (the ledger's "by" column).
    for (const [userId, kind, amount, reason] of [['u_seed03', 'grant', 100, 'Creator programme'], ['u_seed05', 'grant', 50, 'Failed calls on 20 Nov'], ['u_seed12', 'correction', -10, 'Duplicate grant']] as const) {
      const e = d.ai.adminEntry(userId, { kind, amount, reason })
      tx(s => (s.entryBy[e.id] = MOCK_ADMIN_ID))
    }
  }
  seed()

  // ---------- helpers ----------
  const person = (id: string | null | undefined): PersonRef | null => {
    if (!id) return null
    const u = db.s.users.find(x => x.id === id)
    return { id, email: u?.email ?? null, name: u?.name ?? null }
  }
  const personOrGone = (id: string): PersonRef => person(id) ?? { id, email: null, name: null }
  function requireAdmin() {
    const id = d.sessionUserId()
    if (!id) throw new PortError('unauthenticated')
    const u = db.s.users.find(x => x.id === id)
    if (!u?.isAdmin) throw new PortError('not_found')
    return u
  }
  /** Admin reads: the /__mock "admin lists fail" knob turns them into network errors. */
  function adminRead<T>(fn: (admin: User & { password: string }) => T): Promise<T> {
    return d.call(() => {
      const a = requireAdmin()
      if (knobs().listsFail) throw new PortError('network')
      return fn(a)
    })
  }
  const adminWrite = <T>(fn: (admin: User & { password: string }) => T) => d.call(() => fn(requireAdmin()))
  function findUser(id: string) {
    const u = db.s.users.find(x => x.id === id)
    if (!u) throw new PortError('not_found')
    return u
  }
  function audit(s: AdminState, adminId: string, action: string, targetType: string, targetId: string | null, before: unknown, after: unknown) {
    s.audit.unshift({ id: s.nextAuditId++, adminId, adminEmail: null, action, targetType, targetId, before: (before ?? null) as AuditEntry['before'], after: (after ?? null) as AuditEntry['after'], createdAt: iso() })
  }
  const conflict = () => new PortError('conflict')

  // subscriptions
  function subState(x: MockSubscription, t = d.now()): AdminSubscription['state'] {
    if (x.startsAt > t) return 'scheduled'
    return x.endsAt <= t ? 'ended' : 'active'
  }
  function pubSub(x: MockSubscription): AdminSubscription {
    return {
      id: x.id, userId: x.userId, plan: x.plan, period: x.period, startsAt: iso(x.startsAt), endsAt: iso(x.endsAt),
      endedAt: x.endedAt ? iso(x.endedAt) : null, endedReason: x.endedReason ?? null, state: subState(x), source: x.source ?? 'admin',
      requestId: x.requestId ?? null, grantedBy: x.grantedBy ?? null, note: x.note ?? null, createdAt: iso(x.createdAt ?? x.startsAt),
    }
  }
  const inForce = (userId: string) => db.s.subscriptions.find(x => x.userId === userId && subState(x) === 'active') ?? null
  const planKeyOf = (userId: string) => inForce(userId)?.plan ?? 'free'

  function statusOf(userId: string): AdminStatus {
    if (db.s.deletion[userId] !== undefined) return 'deletion_scheduled'
    return st.suspensions[userId] ? 'suspended' : 'active'
  }
  function pendingRef(userId: string): PendingRequestRef | null {
    const r = db.s.requests.find(x => x.userId === userId && x.state === 'pending' && Date.parse(x.expiresAt) > d.now())
    if (!r) return null
    const { userId: _u, handledBy: _h, handledAt: _a, note: _n, subscriptionId: _s, ...rest } = r
    return rest
  }
  function row(u: User): AdminUserRow {
    const sub = inForce(u.id)
    return {
      id: u.id, email: u.email, name: u.name, isAdmin: !!u.isAdmin, plan: planKeyOf(u.id), planEndsAt: sub ? iso(sub.endsAt) : null,
      pendingRequest: pendingRef(u.id), createdAt: u.createdAt, status: statusOf(u.id),
      suspendedAt: st.suspensions[u.id] ? iso(st.suspensions[u.id]!.at) : null,
      deletionDueAt: db.s.deletion[u.id] !== undefined ? iso(db.s.deletion[u.id]) : null,
      lastActiveAt: st.lastActive[u.id] ? iso(st.lastActive[u.id]) : null,
    }
  }
  function ctx(userId: string): LimitContext {
    const scripts = db.s.scripts[userId] ?? []
    return {
      definitions: db.s.limitDefinitions, plans: db.s.plans, planKey: planKeyOf(userId), overrides: db.s.overrides[userId] ?? {},
      usage: key => key === 'scripts.max_active' ? scripts.filter(x => !x.archivedAt).length : key === 'scripts.max_words' ? null : null,
    }
  }
  function override(userId: string, key: string): AdminOverride {
    const m = st.overrideMeta[userId]?.[key]
    return { id: m?.id ?? `ov_${userId}_${key}`, userId, key, value: (db.s.overrides[userId]?.[key] ?? null) as AdminLimitValue, endsAt: m?.endsAt ?? null, note: m?.note ?? null, createdBy: m?.createdBy ?? null }
  }
  function callsAll(): (SeedCall & { overrun: boolean })[] {
    // Seeded calls plus the real ones the AI mock charged (a charge or an own-key entry is a call).
    const fromLedger = d.ai.allEntries()
      .filter(e => (e.kind === 'charge' || e.kind === 'overrun' || e.kind === 'own_key') && e.capability)
      .map((e): SeedCall & { overrun: boolean } => {
        const refunded = d.ai.allEntries().filter(x => x.refundOf === e.id).reduce((n, x) => n + x.amount, 0)
        return {
          id: `call_${e.id}`, userId: e.userId, capability: e.capability!, provider: e.capability === 'format' ? (e.kind === 'own_key' ? 'openai' : 'anthropic') : 'deepgram',
          paidWith: e.kind === 'own_key' ? 'own_key' : 'credits', units: e.capability === 'format' ? -e.amount * 1000 : -e.amount * 60,
          credits: Math.max(0, -e.amount - refunded), status: e.status ?? 'succeeded', failure: e.status === 'failed' ? 'provider_error' : null,
          createdAt: Date.parse(e.createdAt), overrun: e.kind === 'overrun',
        }
      })
    return [...st.calls.map(c => ({ ...c, overrun: false })), ...fromLedger].sort((a, b) => b.createdAt - a.createdAt)
  }
  function detail(u: User): AdminUserDetail {
    st = read()
    const sub = inForce(u.id)
    const plan = db.s.plans.find(p => p.key === planKeyOf(u.id))
    const takes = db.s.remoteTakes[u.id] ?? []
    const scripts = db.s.scripts[u.id] ?? []
    const c = ctx(u.id)
    const month = monthOf(d.now())
    const mine = callsAll().filter(x => x.userId === u.id && monthOf(x.createdAt) === month)
    const sus = st.suspensions[u.id]
    const storage = db.s.storage[u.id]
    const key = d.ai.ownKey(u.id)
    return {
      id: u.id, email: u.email, name: u.name, locale: u.locale, isAdmin: !!u.isAdmin, status: statusOf(u.id), createdAt: u.createdAt,
      lastActiveAt: st.lastActive[u.id] ? iso(st.lastActive[u.id]) : null,
      suspension: sus ? { at: iso(sus.at), reason: sus.reason, byId: sus.byId, byEmail: person(sus.byId)?.email ?? null } : null,
      deletionDueAt: db.s.deletion[u.id] !== undefined ? iso(db.s.deletion[u.id]) : null,
      deletionBy: st.deletionBy[u.id] ?? null,
      plan: {
        key: plan?.key ?? null, nameAr: plan?.name.ar ?? null, nameEn: plan?.name.en ?? null, subscription: sub ? pubSub(sub) : null,
        upcoming: db.s.subscriptions.filter(x => x.userId === u.id && subState(x) === 'scheduled').sort((a, b) => a.startsAt - b.startsAt).map(pubSub),
        pendingRequest: pendingRef(u.id),
      },
      limits: db.s.limitDefinitions.map(def => ({
        key: def.key, type: def.type, labelAr: def.label.ar, labelEn: def.label.en, value: limitValue(c, def.key) as AdminLimitValue,
        usage: def.counted ? c.usage(def.key) : null, overridden: def.key in c.overrides,
      })),
      overrides: Object.keys(db.s.overrides[u.id] ?? {}).map(k => override(u.id, k)),
      storage: {
        linked: storage?.state === 'linked', provider: storage && storage.state !== 'none' ? 'google_drive' : null, accountEmail: storage?.accountEmail ?? null,
        linkedAt: st.linkedAt[u.id] ? iso(st.linkedAt[u.id]) : null, takes: takes.length, bytes: takes.reduce((n, x) => n + x.sizeBytes, 0),
      },
      credits: d.ai.credits(u.id),
      sessions: {
        web: db.s.sessionUserId === u.id ? 1 : 0,
        devices: (db.s.devices[u.id] ?? []).filter(x => x.platform !== 'web').map(x => ({ id: x.id, name: x.name, platform: x.platform === 'ios' || x.platform === 'android' ? x.platform : 'other', lastUsedAt: x.lastUsedAt, createdAt: x.createdAt })),
      },
      scripts: { total: scripts.length, active: scripts.filter(x => !x.archivedAt).length, archived: scripts.filter(x => x.archivedAt).length },
      ai: { month, calls: mine.length, failed: mine.filter(x => x.status === 'failed').length, credits: mine.reduce((n, x) => n + x.credits, 0), ownKey: key ? { provider: key.provider, last4: key.last4, checkedAt: key.checkedAt } : null },
    }
  }
  /** Ends every session of the person (web cookie, device tokens). */
  function signOutEverywhere(userId: string) {
    db.write((s) => {
      if (s.sessionUserId === userId) s.sessionUserId = null
      s.devices[userId] = []
    })
  }
  const adminCount = () => db.s.users.filter(u => u.isAdmin && db.s.deletion[u.id] === undefined).length
  function notSelf(admin: User, id: string) {
    if (admin.id === id) throw conflict()
  }
  /** `?cursor=` for mock pages: an offset. */
  function paged<T>(all: T[], cursor?: string | null, limit = 50): Page<T> {
    const start = Number(cursor) || 0
    const items = all.slice(start, start + limit)
    return { items, nextCursor: start + limit < all.length ? String(start + limit) : null }
  }
  const inRange = (ms: number, from?: string, to?: string) =>
    (!from || ms >= Date.parse(from)) && (!to || ms < Date.parse(to))
  function defaultRange(from?: string, to?: string) {
    const toMs = to ? Date.parse(to) : d.now()
    const fromMs = from ? Date.parse(from) : toMs - 30 * DAY
    return { from: iso(fromMs), to: iso(toMs) }
  }
  function invitationOf(r: MockToken): Invitation {
    const state = r.withdrawnAt ? 'withdrawn' : r.usedAt ? 'used' : r.expiresAt <= d.now() ? 'expired' : 'pending'
    return { id: r.id ?? `inv_${r.token.slice(0, 8)}`, email: r.email, state, expiresAt: iso(r.expiresAt), usedAt: r.usedAt ? iso(r.usedAt) : null, createdAt: iso(r.createdAt ?? r.expiresAt - INVITE_TTL) }
  }
  const waitId = (email: string) => `wl_${email}`
  function subsOf(admin: User) {
    void admin
    return db.s.subscriptions
  }
  function paymentOf(r: (typeof db.s.requests)[number]) {
    return {
      id: r.id, reference: r.reference, user: personOrGone(r.userId), plan: r.plan, period: r.period, amountCents: r.priceCents, currency: 'USD' as const,
      paidAt: r.handledAt ?? r.createdAt, recordedBy: person(r.handledBy), subscriptionId: r.subscriptionId ?? null, note: r.note ?? null,
    }
  }
  function adminRequest(r: (typeof db.s.requests)[number]): AdminUpgradeRequest {
    const u = db.s.users.find(x => x.id === r.userId)
    const p = db.s.plans.find(x => x.key === r.plan)
    const { userId, handledBy, handledAt, note, subscriptionId: _s, ...rest } = r
    return { ...rest, userId, email: u?.email ?? '', name: u?.name ?? '', currentPriceCents: p ? (r.period === 'yearly' ? p.priceYearlyCents : p.priceMonthlyCents) : r.priceCents, handledBy: handledBy ?? null, handledAt: handledAt ?? null, note: note ?? null }
  }
  function adminPlan(p: (typeof db.s.plans)[number], i: number): AdminPlan {
    return {
      id: p.key, key: p.key, nameAr: p.name.ar, nameEn: p.name.en, priceMonthlyCents: p.priceMonthlyCents, priceYearlyCents: p.priceYearlyCents,
      currency: 'USD', active: p.active !== false, sort: p.sort ?? i,
      limits: db.s.limitDefinitions.map(def => ({ key: def.key, type: def.type, value: (def.key in p.limits ? p.limits[def.key] : def.default) as AdminLimitValue, set: def.key in p.limits })),
    }
  }
  function planById(id: string) {
    const p = db.s.plans.find(x => x.key === id)
    if (!p) throw new PortError('not_found')
    return p
  }
  function checkLimitValue(type: string, v: unknown) {
    const ok = type === 'int' ? v === null || (Number.isInteger(v) && (v as number) >= 0) : type === 'bool' ? typeof v === 'boolean' : Array.isArray(v) && v.every(x => typeof x === 'string')
    if (!ok) throw new PortError('validation', { value: 'invalid' })
  }
  function figures(calls: (SeedCall & { overrun?: boolean })[]): UsageFigures {
    return {
      calls: calls.length, succeeded: calls.filter(c => c.status === 'succeeded').length, failed: calls.filter(c => c.status === 'failed').length,
      pending: calls.filter(c => c.status === 'pending').length, credits: calls.reduce((n, c) => n + c.credits, 0),
      words: calls.filter(c => c.capability === 'format').reduce((n, c) => n + c.units, 0),
      seconds: calls.filter(c => c.capability !== 'format').reduce((n, c) => n + c.units, 0), ownKeyCalls: calls.filter(c => c.paidWith === 'own_key').length,
    }
  }
  const keyState = (provider: 'anthropic' | 'deepgram'): AiKeyState => {
    const k = st.keys[provider]
    return k
      ? { provider, set: true, source: 'stored', last4: k.last4, updatedAt: k.updatedAt, ...(provider === 'deepgram' ? { project: k.project } : {}) }
      : { provider, set: false, source: 'none', last4: null, updatedAt: null, ...(provider === 'deepgram' ? { project: null } : {}) }
  }
  const settingsOf = (): AdminSettings => ({ signupMode: st.signupMode, aiKeys: [keyState('anthropic'), keyState('deepgram')], flags: [...st.flags].sort((a, b) => a.key.localeCompare(b.key)) })

  // ---------- the port ----------
  const admin: AdminPort = {
    waitlist: f => adminRead(() => {
      const q = f?.q?.trim().toLowerCase()
      return db.s.waitlist
        .map((w): WaitlistEntry => ({ id: waitId(w.email), email: w.email, joinedAt: iso(w.createdAt), invited: db.s.invites.some(i => i.email === w.email), hasAccount: db.s.users.some(u => u.email === w.email) }))
        .filter(w => (!q || w.email.includes(q)) && (f?.invited === undefined || w.invited === f.invited))
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    }),
    removeWaitlist: id => adminWrite((a) => {
      const w = db.s.waitlist.find(x => waitId(x.email) === id)
      if (!w) throw new PortError('not_found')
      db.write(s => (s.waitlist = s.waitlist.filter(x => x !== w)))
      tx(s => audit(s, a.id, 'waitlist.remove', 'WaitlistEntry', id, { email: w.email }, null))
    }),
    invitations: () => adminRead(() => db.s.invites.map(invitationOf).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    invite: ({ email }) => adminWrite((a) => {
      const e = normalizeEmail(email)
      if (!isEmail(e)) throw new PortError('validation', { email: 'invalid' })
      if (db.s.users.some(u => u.email === e) || db.s.invites.some(i => i.email === e && invitationOf(i).state === 'pending')) throw conflict()
      const rec: MockToken = { id: uid('inv'), token: d.token(), email: e, expiresAt: d.now() + INVITE_TTL, usedAt: null, createdAt: d.now(), withdrawnAt: null }
      db.write(s => s.invites.push(rec))
      d.mail(e, 'invite', `${d.origin}/invite?token=${rec.token}`)
      tx(s => audit(s, a.id, 'invitation.create', 'Invitation', rec.id!, null, { email: e, state: 'pending' }))
      return invitationOf(rec)
    }),
    resend: id => adminWrite((a) => {
      const rec = db.s.invites.find(i => invitationOf(i).id === id)
      if (!rec) throw new PortError('not_found')
      if (invitationOf(rec).state !== 'pending') throw conflict()
      db.write(() => {
        rec.token = d.token()
        rec.expiresAt = d.now() + INVITE_TTL
      })
      d.mail(rec.email, 'invite', `${d.origin}/invite?token=${rec.token}`)
      tx(s => audit(s, a.id, 'invitation.resend', 'Invitation', id, null, { email: rec.email }))
      return invitationOf(rec)
    }),
    withdraw: id => adminWrite((a) => {
      const rec = db.s.invites.find(i => invitationOf(i).id === id)
      if (!rec) throw new PortError('not_found')
      if (invitationOf(rec).state !== 'pending') throw conflict()
      db.write(() => (rec.withdrawnAt = d.now()))
      tx(s => audit(s, a.id, 'invitation.withdraw', 'Invitation', id, { state: 'pending' }, { state: 'withdrawn' }))
    }),

    dashboard: days => adminRead((): AdminDashboard => {
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new PortError('validation', { days: 'invalid' })
      st = read()
      const t = d.now()
      const from = t - days * DAY
      const empty = knobs().emptyDashboard
      const users = empty ? [] : db.s.users
      const byDay: { date: string; count: number }[] = []
      for (let x = Date.parse(dayOf(from)); x <= t; x += DAY) byDay.push({ date: dayOf(x), count: 0 })
      let signups = 0
      for (const u of users) {
        const c = Date.parse(u.createdAt)
        if (c >= from && c <= t) {
          signups++
          const b = byDay.find(x => x.date === dayOf(c))
          if (b) b.count++
        }
      }
      const activeIn = (ms: number) => users.filter(u => (st.lastActive[u.id] ?? 0) >= t - ms).length
      const takes = empty ? [] : Object.values(db.s.remoteTakes).flat()
      const calls = empty ? [] : callsAll()
      const inPeriod = calls.filter(c => c.createdAt >= from)
      const thisMonth = calls.filter(c => monthOf(c.createdAt) === monthOf(t))
      const paying = empty ? [] : db.s.subscriptions.filter(x => subState(x) === 'active' && x.source === 'request')
      const mrr = paying.reduce((n, x) => {
        const r = db.s.requests.find(q => q.id === x.requestId)
        const cents = r?.priceCents ?? 0
        return n + (r?.period === 'yearly' ? Math.round(cents / 12) : cents)
      }, 0)
      const paid = empty ? [] : db.s.requests.filter(r => r.state === 'fulfilled' && r.handledAt && Date.parse(r.handledAt) >= from)
      return {
        generatedAt: iso(t),
        period: { days, from: iso(from), to: iso(t) },
        users: { total: users.length, admins: users.filter(u => u.isAdmin).length, suspended: users.filter(u => st.suspensions[u.id]).length, deletionScheduled: users.filter(u => db.s.deletion[u.id] !== undefined).length },
        signups: { total: signups, byDay },
        active: { day: activeIn(DAY), week: activeIn(7 * DAY), month: activeIn(30 * DAY) },
        storage: {
          linkedDrives: empty ? 0 : Object.values(db.s.storage).filter(x => x.state === 'linked').length, takes: takes.length,
          bytes: takes.reduce((n, x) => n + x.sizeBytes, 0), bytesInPeriod: takes.filter(x => Date.parse(x.recordedAt) >= from).reduce((n, x) => n + x.sizeBytes, 0),
        },
        ai: { creditsUsed: inPeriod.reduce((n, c) => n + c.credits, 0), creditsUsedThisMonth: thisMonth.reduce((n, c) => n + c.credits, 0), calls: inPeriod.length, failedCalls: inPeriod.filter(c => c.status === 'failed').length, ownKeyCalls: inPeriod.filter(c => c.paidWith === 'own_key').length },
        revenue: { currency: 'USD', mrrCents: mrr, payingSubscriptions: paying.length, payments: paid.length, paymentsCents: paid.reduce((n, r) => n + r.priceCents, 0) },
        attention: {
          pendingRequests: empty ? 0 : db.s.requests.filter(r => r.state === 'pending' && Date.parse(r.expiresAt) > t).length,
          waitlistNotInvited: empty ? 0 : db.s.waitlist.filter(w => !db.s.invites.some(i => i.email === w.email) && !db.s.users.some(u => u.email === w.email)).length,
        },
      }
    }),
    users: (f, cursor, limit = 50) => adminRead(() => {
      st = read()
      const q = f.q?.trim().toLowerCase()
      const all = db.s.users
        .filter(u => !q || u.email.includes(q) || u.name.toLowerCase().includes(q))
        .filter(u => !f.plan || planKeyOf(u.id) === f.plan)
        .filter(u => !f.status || (f.status === 'admin' ? !!u.isAdmin : statusOf(u.id) === f.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map(row)
      return paged(all, cursor, Math.min(100, Math.max(1, limit)))
    }),
    user: id => adminRead(() => detail(findUser(id))),
    suspend: (id, reason) => adminWrite((a) => {
      const u = findUser(id)
      if (!reason?.trim()) throw new PortError('validation', { reason: 'required' })
      notSelf(a, id)
      if (u.isAdmin || st.suspensions[id]) throw conflict()
      tx((s) => {
        s.suspensions[id] = { at: d.now(), reason: reason.trim(), byId: a.id }
        audit(s, a.id, 'user.suspend', 'User', id, { status: 'active' }, { status: 'suspended', reason: reason.trim() })
      })
      signOutEverywhere(id)
      return detail(u)
    }),
    unsuspend: id => adminWrite((a) => {
      const u = findUser(id)
      st = read()
      if (!st.suspensions[id]) throw conflict()
      tx((s) => {
        delete s.suspensions[id]
        audit(s, a.id, 'user.unsuspend', 'User', id, { status: 'suspended' }, { status: 'active' })
      })
      return detail(u)
    }),
    sendPasswordReset: id => adminWrite((a) => {
      const u = findUser(id)
      notSelf(a, id)
      const t = d.token()
      db.write(s => s.resets.push({ token: t, email: u.email, expiresAt: Date.now() + RESET_TTL, usedAt: null }))
      d.mail(u.email, 'reset', `${d.origin}/reset-password?token=${t}`)
      signOutEverywhere(id)
      tx(s => audit(s, a.id, 'user.password_reset', 'User', id, null, { sentTo: u.email }))
      return { sentTo: u.email }
    }),
    changePlan: (id, input) => adminWrite((a) => {
      const u = findUser(id)
      const p = db.s.plans.find(x => x.key === input.planId)
      if (!p) throw new PortError('validation', { planId: 'invalid' })
      if (!input.note?.trim()) throw new PortError('validation', { note: 'required' })
      const cur = inForce(id)
      if ((cur?.plan ?? 'free') === p.key) throw conflict()
      const t = d.now()
      let end = 0
      if (p.key !== 'free') {
        if (input.endsAt) end = Date.parse(input.endsAt)
        else if (input.period === 'monthly' || input.period === 'yearly') end = periodEnd(t, input.period)
        else throw new PortError('validation', { period: 'required' })
        if (!(end > t)) throw new PortError('validation', { endsAt: 'future' })
        if (db.s.subscriptions.some(x => x.userId === id && subState(x) === 'scheduled' && x.startsAt < end)) throw new PortError('validation', { endsAt: 'overlap' })
      }
      db.write((s) => {
        if (cur) {
          const c = s.subscriptions.find(x => x.id === cur.id)!
          c.endsAt = t
          c.endedAt = t
          c.endedReason = 'plan_change'
        }
        if (p.key !== 'free') s.subscriptions.push({ id: uid('sub'), userId: id, plan: p.key, period: input.endsAt ? 'custom' : input.period!, startsAt: t, endsAt: end, source: 'admin', grantedBy: a.id, note: input.note.trim(), createdAt: t })
      })
      tx(s => audit(s, a.id, 'user.plan_change', 'User', id, { plan: cur?.plan ?? 'free' }, { plan: p.key, note: input.note.trim() }))
      return detail(u)
    }),
    grantAdmin: id => adminWrite((a) => {
      const u = findUser(id)
      st = read()
      if (u.isAdmin || statusOf(id) !== 'active') throw conflict()
      db.write(() => (u.isAdmin = true))
      tx(s => audit(s, a.id, 'user.admin_grant', 'User', id, { isAdmin: false }, { isAdmin: true }))
      return detail(u)
    }),
    revokeAdmin: id => adminWrite((a) => {
      const u = findUser(id)
      notSelf(a, id)
      if (!u.isAdmin || adminCount() <= 1) throw conflict()
      db.write(() => (u.isAdmin = false))
      tx(s => audit(s, a.id, 'user.admin_revoke', 'User', id, { isAdmin: true }, { isAdmin: false }))
      return detail(u)
    }),
    scheduleDeletion: (id, reason) => adminWrite((a) => {
      const u = findUser(id)
      if (!reason?.trim()) throw new PortError('validation', { reason: 'required' })
      notSelf(a, id)
      if (u.isAdmin || db.s.deletion[id] !== undefined) throw conflict()
      const due = d.now() + DELETION_GRACE
      db.write(s => (s.deletion[id] = due))
      signOutEverywhere(id)
      d.ai.eraseKey(id)
      d.mail(u.email, 'email', null)
      tx((s) => {
        s.deletionBy[id] = a.id
        audit(s, a.id, 'user.delete_schedule', 'User', id, null, { deletionDueAt: iso(due), reason: reason.trim() })
      })
      return detail(u)
    }),
    cancelDeletion: id => adminWrite((a) => {
      const u = findUser(id)
      if (db.s.deletion[id] === undefined) throw conflict()
      db.write(s => delete s.deletion[id])
      tx((s) => {
        delete s.deletionBy[id]
        audit(s, a.id, 'user.delete_cancel', 'User', id, { status: 'deletion_scheduled' }, { status: statusOf(id) })
      })
      return detail(u)
    }),
    addCredits: (id, input, key) => adminWrite((a) => {
      findUser(id)
      if (input.kind !== 'grant' && input.kind !== 'correction') throw new PortError('validation', { kind: 'invalid' })
      if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > 100_000 || (input.kind === 'grant' && input.amount < 1)) throw new PortError('validation', { amount: 'invalid' })
      if (!input.reason?.trim()) throw new PortError('validation', { reason: 'required' })
      if (input.endsAt && Date.parse(input.endsAt) <= d.now()) throw new PortError('validation', { endsAt: 'future' })
      st = read()
      const idem = key ? `${a.id}:${key}` : null
      if (idem && st.idempotency[idem]) {
        const prev = st.idempotency[idem]!
        if (prev.userId !== id || prev.kind !== input.kind || prev.amount !== input.amount) throw conflict()
        return clone(prev.entry)
      }
      const entry = d.ai.adminEntry(id, { ...input, reason: input.reason.trim() })
      tx((s) => {
        s.entryBy[entry.id] = a.id
        if (idem) s.idempotency[idem] = { userId: id, kind: input.kind, amount: input.amount, entry }
        audit(s, a.id, input.kind === 'grant' ? 'credits.grant' : 'credits.correct', 'User', id, null, { amount: input.amount, reason: input.reason.trim() })
      })
      return entry
    }),
    setOverride: (id, key, input) => adminWrite((a) => {
      findUser(id)
      const def = db.s.limitDefinitions.find(x => x.key === key)
      if (!def) throw new PortError('not_found')
      checkLimitValue(def.type, input.value)
      if (input.endsAt && Date.parse(input.endsAt) <= d.now()) throw new PortError('validation', { endsAt: 'future' })
      const before = db.s.overrides[id]?.[key]
      db.write(s => ((s.overrides[id] ??= {})[key] = input.value as RawLimit))
      tx((s) => {
        ;(s.overrideMeta[id] ??= {})[key] = { id: s.overrideMeta[id]?.[key]?.id ?? uid('ov'), endsAt: input.endsAt ?? null, note: input.note ?? null, createdBy: a.id }
        audit(s, a.id, 'override.set', 'User', id, before === undefined ? null : { key, value: before }, { key, value: input.value, endsAt: input.endsAt ?? null })
      })
      return override(id, key)
    }),
    removeOverride: (id, key) => adminWrite((a) => {
      findUser(id)
      if (!(key in (db.s.overrides[id] ?? {}))) throw new PortError('not_found')
      const before = db.s.overrides[id]![key]
      db.write(s => delete s.overrides[id]![key])
      tx((s) => {
        delete s.overrideMeta[id]?.[key]
        audit(s, a.id, 'override.remove', 'User', id, { key, value: before }, null)
      })
    }),
    userSubscriptions: id => adminRead(() => {
      findUser(id)
      return db.s.subscriptions.filter(x => x.userId === id).sort((a, b) => b.startsAt - a.startsAt).map(pubSub)
    }),
    grantSubscription: (id, input) => adminWrite((a) => {
      findUser(id)
      const p = db.s.plans.find(x => x.key === input.planId)
      if (!p || p.key === 'free') throw new PortError('validation', { planId: 'invalid' })
      if (!input.note?.trim()) throw new PortError('validation', { note: 'required' })
      const last = db.s.subscriptions.filter(x => x.userId === id && subState(x) !== 'ended').reduce((n, x) => Math.max(n, x.endsAt), d.now())
      const start = input.startsAt ? Date.parse(input.startsAt) : last
      const end = input.endsAt ? Date.parse(input.endsAt) : input.period ? periodEnd(start, input.period) : NaN
      if (!(end > start)) throw new PortError('validation', { endsAt: 'invalid' })
      const sub: MockSubscription = { id: uid('sub'), userId: id, plan: p.key, period: input.endsAt ? 'custom' : input.period!, startsAt: start, endsAt: end, source: 'admin', grantedBy: a.id, note: input.note.trim(), createdAt: d.now() }
      db.write(s => s.subscriptions.push(sub))
      tx(s => audit(s, a.id, 'subscription.grant', 'Subscription', sub.id, null, { userId: id, plan: p.key }))
      return pubSub(sub)
    }),

    plans: () => adminRead(() => db.s.plans.map(adminPlan).sort((a, b) => a.sort - b.sort)),
    createPlan: input => adminWrite((a) => {
      if (!/^[a-z0-9_]{2,32}$/.test(input.key ?? '')) throw new PortError('validation', { key: 'invalid' })
      if (db.s.plans.some(p => p.key === input.key)) throw new PortError('validation', { key: 'taken' })
      if (!input.nameAr?.trim() || !input.nameEn?.trim()) throw new PortError('validation', { name: 'required' })
      const p = { key: input.key, name: { ar: input.nameAr.trim(), en: input.nameEn.trim() }, priceMonthlyCents: input.priceMonthlyCents, priceYearlyCents: input.priceYearlyCents, limits: {}, active: input.active ?? true, sort: input.sort ?? db.s.plans.length }
      db.write(s => s.plans.push(p))
      tx(s => audit(s, a.id, 'plan.create', 'Plan', p.key, null, { key: p.key }))
      return adminPlan(p, db.s.plans.length - 1)
    }),
    updatePlan: (id, input) => adminWrite((a) => {
      const p = planById(id)
      if (p.key === 'free' && input.active === false) throw new PortError('validation', { active: 'free' })
      for (const c of [input.priceMonthlyCents, input.priceYearlyCents]) if (c !== undefined && (!Number.isInteger(c) || c < 0)) throw new PortError('validation', { price: 'invalid' })
      const before = adminPlan(p, db.s.plans.indexOf(p))
      db.write(() => {
        if (input.nameAr !== undefined) p.name.ar = input.nameAr.trim()
        if (input.nameEn !== undefined) p.name.en = input.nameEn.trim()
        if (input.priceMonthlyCents !== undefined) p.priceMonthlyCents = input.priceMonthlyCents
        if (input.priceYearlyCents !== undefined) p.priceYearlyCents = input.priceYearlyCents
        if (input.active !== undefined) p.active = input.active
        if (input.sort !== undefined) p.sort = input.sort
      })
      const after = adminPlan(p, db.s.plans.indexOf(p))
      tx(s => audit(s, a.id, 'plan.update', 'Plan', p.key, { ...before, limits: undefined }, { ...after, limits: undefined }))
      return after
    }),
    setPlanLimit: (id, key, value) => adminWrite((a) => {
      const p = planById(id)
      const def = db.s.limitDefinitions.find(x => x.key === key)
      if (!def) throw new PortError('not_found')
      checkLimitValue(def.type, value)
      const before = key in p.limits ? p.limits[key] : undefined
      db.write(() => (p.limits[key] = value as RawLimit))
      tx(s => audit(s, a.id, 'limit.set', 'Plan', p.key, before === undefined ? null : { key, value: before }, { key, value }))
      return { key, type: def.type, value, set: true }
    }),
    unsetPlanLimit: (id, key) => adminWrite((a) => {
      const p = planById(id)
      if (!(key in p.limits)) return
      const before = p.limits[key]
      db.write(() => delete p.limits[key])
      tx(s => audit(s, a.id, 'limit.unset', 'Plan', p.key, { key, value: before }, null))
    }),
    limitDefinitions: () => adminRead(() => db.s.limitDefinitions.map(x => ({ key: x.key, type: x.type, default: x.default as AdminLimitValue, counted: x.counted, labelAr: x.label.ar, labelEn: x.label.en }))),
    defineLimit: input => adminWrite((a) => {
      if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(input.key ?? '') || input.key.length > 64) throw new PortError('validation', { key: 'invalid' })
      if (db.s.limitDefinitions.some(x => x.key === input.key)) throw new PortError('validation', { key: 'taken' })
      if (!['int', 'bool', 'list'].includes(input.type)) throw new PortError('validation', { type: 'invalid' })
      const def = { key: input.key, type: input.type, default: (input.default ?? (input.type === 'bool' ? false : input.type === 'list' ? [] : null)) as RawLimit, counted: !!input.counted, label: { ar: input.labelAr, en: input.labelEn } }
      db.write(s => s.limitDefinitions.push(def))
      tx(s => audit(s, a.id, 'limit.define', 'LimitDefinition', def.key, null, { key: def.key, type: def.type }))
      return { key: def.key, type: def.type, default: def.default as AdminLimitValue, counted: def.counted, labelAr: def.label.ar, labelEn: def.label.en }
    }),

    subscriptions: (f, cursor) => adminRead((a) => {
      const all = subsOf(a)
        .filter(x => (!f.state || subState(x) === f.state) && (!f.plan || x.plan === f.plan) && (!f.source || (x.source ?? 'admin') === f.source) && (!f.userId || x.userId === f.userId))
        .sort((x, y) => y.startsAt - x.startsAt)
        .map((x): AdminSubscriptionRow => ({ ...pubSub(x), user: personOrGone(x.userId) }))
      return paged(all, cursor)
    }),
    updateSubscription: (id, patch) => adminWrite((a) => {
      const x = db.s.subscriptions.find(s => s.id === id)
      if (!x) throw new PortError('not_found')
      const before = pubSub(x)
      if ('endedReason' in patch) {
        if (subState(x) === 'ended') throw new PortError('validation', { endedReason: 'ended' })
        const at = patch.endedAt ? Date.parse(patch.endedAt) : d.now()
        if (at > x.endsAt) throw new PortError('validation', { endedAt: 'invalid' })
        db.write(() => {
          x.endsAt = Math.max(at, x.startsAt)
          x.endedAt = at
          x.endedReason = patch.endedReason
          if (patch.note) x.note = patch.note
        })
        tx(s => audit(s, a.id, 'subscription.end', 'Subscription', id, before, pubSub(x)))
      } else {
        const end = Date.parse(patch.endsAt)
        if (!(end > x.startsAt)) throw new PortError('validation', { endsAt: 'invalid' })
        db.write(() => {
          x.endsAt = end
          if (patch.note) x.note = patch.note
        })
        tx(s => audit(s, a.id, 'subscription.update', 'Subscription', id, before, pubSub(x)))
      }
      return pubSub(x)
    }),
    requests: f => adminRead(() => {
      const q = f?.q?.trim().toLowerCase()
      return db.s.requests
        .map(adminRequest)
        .filter(r => (!f?.state || r.state === f.state) && (!q || r.reference.toLowerCase().includes(q) || r.email.includes(q)))
        .sort((a, b) => (a.state === 'pending' ? 0 : 1) - (b.state === 'pending' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200)
    }),
    fulfilRequest: (id, input) => adminWrite((a) => {
      const r = db.s.requests.find(x => x.id === id)
      if (!r) throw new PortError('not_found')
      if (r.state !== 'pending') throw conflict()
      const t = d.now()
      const last = db.s.subscriptions.filter(x => x.userId === r.userId && subState(x) !== 'ended').reduce((n, x) => Math.max(n, x.endsAt), t)
      const start = input?.startsAt ? Date.parse(input.startsAt) : last
      const end = input?.endsAt ? Date.parse(input.endsAt) : periodEnd(start, r.period)
      const sub: MockSubscription = { id: uid('sub'), userId: r.userId, plan: r.plan, period: r.period, startsAt: start, endsAt: end, source: 'request', requestId: r.id, grantedBy: a.id, note: input?.note ?? null, createdAt: t }
      db.write((s) => {
        s.subscriptions.push(sub)
        Object.assign(r, { state: 'fulfilled', handledBy: a.id, handledAt: iso(t), note: input?.note ?? null, subscriptionId: sub.id })
      })
      tx(s => audit(s, a.id, 'request.fulfil', 'SubscriptionRequest', id, { state: 'pending' }, { state: 'fulfilled', subscriptionId: sub.id }))
      return pubSub(sub)
    }),
    rejectRequest: (id, note) => adminWrite((a) => {
      const r = db.s.requests.find(x => x.id === id)
      if (!r) throw new PortError('not_found')
      if (r.state !== 'pending') throw conflict()
      db.write(() => Object.assign(r, { state: 'rejected', handledBy: a.id, handledAt: iso(), note: note ?? null }))
      tx(s => audit(s, a.id, 'request.reject', 'SubscriptionRequest', id, { state: 'pending' }, { state: 'rejected' }))
      return adminRequest(r)
    }),
    payments: (f, cursor) => adminRead((): PaymentsPage => {
      const all = db.s.requests
        .filter(r => r.state === 'fulfilled' && (!f.userId || r.userId === f.userId))
        .map(paymentOf)
        .filter(p => inRange(Date.parse(p.paidAt), f.from, f.to))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      const pg = paged(all, cursor)
      return { ...pg, count: all.length, totalCents: all.reduce((n, p) => n + p.amountCents, 0), currency: 'USD' }
    }),

    aiUsage: (period, groupBy) => adminRead((): AiUsage => {
      const { from, to } = defaultRange(period.from, period.to)
      const calls = callsAll().filter(c => inRange(c.createdAt, from, to))
      let groups: UsageGroup[]
      if (groupBy === 'day') {
        groups = []
        for (let x = Date.parse(dayOf(Date.parse(from))); x < Date.parse(to); x += DAY) groups.push({ key: dayOf(x), ...figures(calls.filter(c => dayOf(c.createdAt) === dayOf(x))) })
      } else {
        const keyOf = (c: SeedCall) => groupBy === 'provider' ? c.provider : groupBy === 'capability' ? c.capability : c.userId
        const keys = [...new Set(calls.map(keyOf))]
        groups = keys.map(k => ({ key: k, ...figures(calls.filter(c => keyOf(c) === k)), ...(groupBy === 'user' ? { user: personOrGone(k) } : {}) }))
        if (groupBy === 'user') groups = groups.sort((a, b) => b.credits - a.credits || b.calls - a.calls).slice(0, 100)
        else groups.sort((a, b) => b.calls - a.calls)
      }
      return { from, to, groupBy, totals: figures(calls), groups }
    }),
    aiCalls: (f, cursor) => adminRead(() => {
      const all = callsAll()
        .filter(c => (!f.status || c.status === f.status) && (!f.userId || c.userId === f.userId) && (!f.provider || c.provider === f.provider) && (!f.capability || c.capability === f.capability) && inRange(c.createdAt, f.from, f.to))
        .map((c): AdminAiCall => ({
          id: c.id, user: personOrGone(c.userId), capability: c.capability, provider: c.provider, paidWith: c.paidWith, units: c.units, unit: c.capability === 'format' ? 'words' : 'seconds',
          credits: c.credits, status: c.status, failure: c.failure, elapsedMs: c.status === 'pending' ? null : 1800 + (c.units % 900), durationSeconds: c.capability === 'format' ? null : c.units,
          overrun: c.overrun, createdAt: iso(c.createdAt), finishedAt: c.status === 'pending' ? null : iso(c.createdAt + 2000),
        }))
      return paged(all, cursor)
    }),
    ledger: (f, cursor) => adminRead(() => {
      st = read()
      // Newest first; entries made in the same millisecond keep the order they were made in (newest first).
      const all = d.ai.allEntries()
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => (!f.userId || e.userId === f.userId) && (!f.kind || e.kind === (f.kind as CreditKind)) && inRange(Date.parse(e.createdAt), f.from, f.to))
        .sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt) || b.i - a.i)
        .map(({ e }) => e)
        .map(({ userId, ...e }): LedgerEntry => ({ ...e, user: personOrGone(userId), createdBy: person(st.entryBy[e.id]), aiCallId: e.kind === 'charge' || e.kind === 'own_key' || e.kind === 'overrun' ? `call_${e.id}` : null }))
      return paged(all, cursor)
    }),

    settings: () => adminRead(() => {
      st = read()
      return settingsOf()
    }),
    setSignupMode: mode => adminWrite((a) => {
      if (mode !== 'open' && mode !== 'invite_only') throw new PortError('validation', { signupMode: 'invalid' })
      return tx((s) => {
        if (s.signupMode !== mode) audit(s, a.id, 'settings.signup_mode', 'Setting', 'signup_mode', { signupMode: s.signupMode }, { signupMode: mode })
        s.signupMode = mode
        st = s
        return settingsOf()
      })
    }),
    setAiKey: (provider, input) => adminWrite((a) => {
      if (provider !== 'anthropic' && provider !== 'deepgram') throw new PortError('not_found')
      const k = (input.key ?? '').trim()
      if (k.length < 8 || k.length > 500) throw new PortError('validation', { key: 'invalid' })
      st = read()
      if (provider === 'deepgram' && !input.project?.trim() && !st.keys.deepgram?.project) throw new PortError('validation', { project: 'required' })
      // Only the last four characters are kept: the mock never needs the key, and nothing may echo it.
      return tx((s) => {
        s.keys[provider] = { last4: k.slice(-4), updatedAt: iso(), project: provider === 'deepgram' ? (input.project?.trim() || s.keys.deepgram?.project || null) : null }
        audit(s, a.id, 'settings.ai_key_set', 'Setting', `ai_key.${provider}`, null, { last4: k.slice(-4) })
        st = s
        return keyState(provider)
      })
    }),
    removeAiKey: provider => adminWrite((a) => {
      st = read()
      if (!st.keys[provider]) throw new PortError('not_found')
      return tx((s) => {
        const last4 = s.keys[provider]!.last4
        delete s.keys[provider]
        audit(s, a.id, 'settings.ai_key_remove', 'Setting', `ai_key.${provider}`, { last4 }, null)
        st = s
        return keyState(provider)
      })
    }),
    setFlag: (key, input) => adminWrite((a) => {
      if (!FLAG_KEY.test(key)) throw new PortError('validation', { key: 'invalid' })
      if (typeof input.enabled !== 'boolean') throw new PortError('validation', { enabled: 'required' })
      if (input.description && input.description.length > 200) throw new PortError('validation', { description: 'max' })
      return tx((s) => {
        const cur = s.flags.find(f => f.key === key)
        const next: FeatureFlag = { key, enabled: input.enabled, description: input.description === undefined ? (cur?.description ?? null) : input.description, updatedAt: iso() }
        if (!cur || cur.enabled !== next.enabled || cur.description !== next.description) {
          audit(s, a.id, 'flag.set', 'FeatureFlag', key, cur ? { enabled: cur.enabled } : null, { enabled: next.enabled })
          s.flags = [...s.flags.filter(f => f.key !== key), next]
          return next
        }
        return cur
      })
    }),
    removeFlag: key => adminWrite((a) => {
      tx((s) => {
        const cur = s.flags.find(f => f.key === key)
        if (!cur) throw new PortError('not_found')
        s.flags = s.flags.filter(f => f.key !== key)
        audit(s, a.id, 'flag.remove', 'FeatureFlag', key, { enabled: cur.enabled }, null)
      })
    }),

    auditLog: (f, cursor) => adminRead(() => {
      st = read()
      const all = st.audit
        .filter(e => (!f.adminId || e.adminId === f.adminId) && (!f.action || e.action === f.action) && (!f.targetType || e.targetType === f.targetType) && (!f.targetId || e.targetId === f.targetId))
        .filter(e => inRange(Date.parse(e.createdAt), f.after, f.before))
        .map(e => ({ ...e, adminEmail: person(e.adminId)?.email ?? null }))
      // The backend's cursor is the last id; the mock pages by id too.
      const start = cursor ? all.findIndex(e => e.id < Number(cursor)) : 0
      const from = start < 0 ? all.length : start
      const items = all.slice(from, from + 50)
      return { items, nextCursor: from + 50 < all.length ? String(items.at(-1)!.id) : null }
    }),
    auditActions: () => adminRead(() => AUDIT_ACTIONS.map(x => ({ ...x }))),
  }

  const settings: SettingsPort = {
    public: () => d.call(() => {
      st = read()
      return { signupMode: st.signupMode, flags: Object.fromEntries(st.flags.map(f => [f.key, f.enabled])) }
    }),
  }

  /** Hooks for the auth side of the mock (suspension, last active, admin deletions). */
  const hooks = {
    isSuspended: (userId: string) => !!read().suspensions[userId],
    /** An admin scheduled this deletion: signing in does not cancel it. */
    deletionByAdmin: (userId: string) => !!read().deletionBy[userId],
    signupMode: () => read().signupMode,
    /** Records signed-in use at most every 15 minutes. */
    touch(userId: string) {
      const s = read()
      if ((s.lastActive[userId] ?? 0) > d.now() - 15 * 60_000) return
      tx(x => (x.lastActive[userId] = d.now()))
    },
  }

  /** /__mock controls. */
  const controls = {
    knobs,
    setKnobs: (patch: Partial<MockAdminKnobs>) => d.kv.setItem(knobKey, JSON.stringify({ ...knobs(), ...patch })),
    setSignupMode: (mode: SignupMode) => tx((s) => {
      s.signupMode = mode
    }),
    suspend: (userId: string, reason = 'mock') => tx((s) => {
      s.suspensions[userId] = { at: d.now(), reason, byId: MOCK_ADMIN_ID }
    }),
    unsuspend: (userId: string) => tx(s => delete s.suspensions[userId]),
    summary: () => ({ people: db.s.users.length, admins: db.s.users.filter(u => u.isAdmin).length, waitlist: db.s.waitlist.length, invitations: db.s.invites.length, requests: db.s.requests.filter(r => r.state === 'pending').length, calls: callsAll().length, audit: read().audit.length }),
    reset: () => d.kv.removeItem(KEY),
  }

  return { admin, settings, hooks, controls }
}
