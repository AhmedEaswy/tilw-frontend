/**
 * In-browser mock backend implementing every port. Mirrors the behaviour the Laravel API has:
 * non-enumerating auth errors, token expiry, optimistic-concurrency conflicts, rate-limit-free.
 * Emails are not sent; reset, invite and email-change links land in `db.s.outbox` (shown on /__mock).
 *
 * Release 2 adds plans and limits (with the same resolution and refusals as the backend), upgrade requests,
 * script history, linked storage with a fake Google Drive (mock/drive.ts), take records, devices, email change and
 * the 14-day deletion grace. The clock can be moved from /__mock (`knobs.clockOffsetMs`).
 */
import { startMockApp } from './app'
import type { Services } from '../ports'
import {
  DEFAULT_READING,
  PortError,
  type Locale,
  type MyPlan,
  type RemoteTake,
  type Script,
  type ScriptSummary,
  type ScriptVersion,
  type SyncMode,
  type UpgradeRequest,
  type User,
} from '../types'
import { countWords, firstLine, foldForSearch, isEmail, normalizeEmail, PASSWORD_MIN, splitParagraphs } from '../../utils/text'
import { MockDb, type KV, type MockToken } from './db'
import { createFakeDrive, DRIVE_OTHER_BYTES, DRIVE_TOTAL_BYTES, idbBlobStore, memoryBlobStore, usedBytes, type BlobStore } from './drive'
import { allLimits, limitValue, periodEnd, publicPlan, requestReference, type LimitContext, type RawLimit } from './plans'
import { LEGACY_SCRIPTS, mockPhone } from './seed'
import { createMockLinks } from './link'
import { createMockAi } from './ai'
import { createMockAdmin } from './admin'
import { broadcastBus, createMockHub, createMockRealtime, type MockHub } from './realtime'

const RESET_TTL = 60 * 60_000
const EMAIL_CHANGE_TTL = 24 * 60 * 60_000
const REQUEST_TTL = 30 * 86_400_000
const DELETION_GRACE = 14 * 86_400_000
/** At most one `edit` snapshot per this much editing (backend tilw.version_min_gap_minutes). */
export const VERSION_GAP_MS = 10 * 60_000
/** The sales number the mock puts in wa.me links. */
export const MOCK_SALES_NUMBER = '201000000000'

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const token = () => Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join('')
const EDIT_FIELDS = ['title', 'body', 'marks', 'direction'] as const

export interface MockOptions {
  origin?: string
  sleep?: (ms: number) => Promise<void>
  /** UI language for limit labels when nobody is signed in. */
  locale?: () => Locale
  /** Where the fake Drive keeps uploaded files (IndexedDB in the browser, memory in tests). */
  blobs?: BlobStore
  /** Feature 004: the fake realtime hub between tabs (a BroadcastChannel in the browser, a memory network in tests). */
  hub?: MockHub
}

export function createMockServices(kv: KV, opts: MockOptions = {}) {
  const db = new MockDb(kv)
  const origin = opts.origin ?? ''
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  const blobs = opts.blobs ?? (typeof indexedDB === 'undefined' ? memoryBlobStore() : idbBlobStore())
  let notice: 'deletion_cancelled' | null = null
  const issuedTokens = new Set<string>()

  /** The mock's clock: real time moved by the /__mock knob. */
  const now = () => Date.now() + (db.knobs.clockOffsetMs || 0)
  const iso = (ms = now()) => new Date(ms).toISOString()

  /** Every call goes through here: latency, offline, random failures. */
  async function call<T>(fn: () => T): Promise<T> {
    await sleep(db.knobs.latencyMs)
    if (db.knobs.offline || Math.random() < db.knobs.failRate) throw new PortError('network')
    return clone(fn())
  }

  const publicUser = (u: User & { password?: string }): User => {
    const { password: _pw, ...rest } = u
    return rest
  }
  function sessionUser() {
    return db.s.users.find(x => x.id === db.s.sessionUserId) ?? null
  }
  function currentUser() {
    const u = sessionUser()
    if (!u) throw new PortError('unauthenticated')
    // Feature 006 (backend 005 review fix): a suspended account is refused on every signed-in call, and the
    // session ends with it.
    if (adminMock.hooks.isSuspended(u.id)) {
      db.write(s => (s.sessionUserId = null))
      throw new PortError('account_suspended')
    }
    adminMock.hooks.touch(u.id)
    return u
  }
  const locale = (): Locale => sessionUser()?.locale ?? opts.locale?.() ?? 'ar'
  function userScripts(userId: string) {
    return db.s.scripts[userId] ?? (db.s.scripts[userId] = [])
  }
  function findScript(id: string) {
    const u = currentUser()
    const s = userScripts(u.id).find(x => x.id === id)
    if (!s) throw new PortError('not_found')
    return s
  }
  function validToken(list: MockToken[], t: string) {
    const rec = list.find(x => x.token === t)
    if (!rec || rec.usedAt || rec.withdrawnAt) throw new PortError('token_invalid')
    if (db.knobs.expireTokens || rec.expiresAt < Date.now()) throw new PortError('token_expired')
    return rec
  }
  function checkPassword(pw: string) {
    if (pw.length < PASSWORD_MIN) throw new PortError('validation', { password: 'min' })
  }
  function mail(to: string, kind: 'reset' | 'invite' | 'waitlist' | 'email', link: string | null) {
    db.s.outbox.unshift({ id: uid('m'), to, kind, link, sentAt: Date.now() })
    db.s.outbox.splice(20)
  }

  // ---------- plans and limits ----------

  /** The subscription in force now, if any. */
  function subscription(userId: string) {
    const t = now()
    return db.s.subscriptions.find(x => x.userId === userId && x.startsAt <= t && t < x.endsAt) ?? null
  }
  function planKey(userId: string) {
    return subscription(userId)?.plan ?? 'free'
  }
  function usage(userId: string, key: string): number | null {
    const list = userScripts(userId)
    if (key === 'scripts.max_active') return list.filter(s => !s.archivedAt).length
    if (key === 'scripts.max_words') return list.reduce((n, s) => Math.max(n, countWords(s.body)), 0)
    return null
  }
  function ctx(userId: string): LimitContext {
    return {
      definitions: db.s.limitDefinitions,
      plans: db.s.plans,
      planKey: planKey(userId),
      overrides: db.s.overrides[userId] ?? {},
      usage: key => usage(userId, key),
    }
  }
  const limit = (userId: string, key: string) => limitValue(ctx(userId), key)
  function limitError(key: string, value: RawLimit, used: number | null) {
    return new PortError('limit_reached', undefined, undefined, { key, value, usage: used })
  }
  /** Refuse when `wouldUse` goes over an int limit (null = unlimited). */
  function check(userId: string, key: string, wouldUse: number, used = Math.max(0, wouldUse - 1)) {
    const v = limit(userId, key)
    if (typeof v === 'number' && wouldUse > v) throw limitError(key, v, used)
  }
  function checkActive(userId: string) {
    const active = usage(userId, 'scripts.max_active') ?? 0
    check(userId, 'scripts.max_active', active + 1, active)
  }
  function checkWords(userId: string, body: string) {
    const words = countWords(body)
    check(userId, 'scripts.max_words', words, words)
  }
  /** Non-archived scripts beyond `scripts.max_active`, ranked by last edit (newest stay editable). */
  function readOnlyIds(userId: string): Set<string> {
    const max = limit(userId, 'scripts.max_active')
    if (typeof max !== 'number') return new Set()
    const ranked = userScripts(userId)
      .filter(s => !s.archivedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
    return new Set(ranked.slice(max).map(s => s.id))
  }
  function withReadOnly<T extends Script | ScriptSummary>(s: T, ro: Set<string>): T {
    const readOnly = ro.has(s.id)
    return { ...s, readOnly, readOnlyReason: readOnly ? 'scripts.max_active' : null }
  }
  function summarize(s: Script): ScriptSummary {
    const { body, marks: _m, ...rest } = s
    return { ...rest, excerpt: firstLine(body), wordCount: countWords(body), paragraphCount: splitParagraphs(body).length }
  }

  /** Requests past their 30 days become `expired`. */
  function expireRequests() {
    const t = now()
    if (db.s.requests.some(r => r.state === 'pending' && Date.parse(r.expiresAt) <= t)) {
      db.write(s => s.requests.forEach(r => r.state === 'pending' && Date.parse(r.expiresAt) <= t && (r.state = 'expired')))
    }
  }
  function pendingRequest(userId: string) {
    expireRequests()
    return db.s.requests.find(r => r.userId === userId && r.state === 'pending') ?? null
  }
  const publicRequest = (r: UpgradeRequest & { userId?: string }): UpgradeRequest => {
    const { userId: _u, ...rest } = r
    return rest
  }
  function whatsappUrl(r: UpgradeRequest) {
    const price = `$${(r.priceCents / 100).toFixed(r.priceCents % 100 ? 2 : 0)}`
    const period = r.period === 'yearly' ? 'yearly / سنوي' : 'monthly / شهري'
    const text = `Tilw Pro · ${period} · ${price} · ${r.reference}`
    return `https://wa.me/${MOCK_SALES_NUMBER}?text=${encodeURIComponent(text)}`
  }

  // ---------- history ----------

  function versionsOf(scriptId: string) {
    return db.s.versions[scriptId] ?? (db.s.versions[scriptId] = [])
  }
  function snapshot(userId: string, s: Script, reason: ScriptVersion['reason']) {
    const list = versionsOf(s.id)
    list.push({ id: uid('v'), createdAt: iso(), reason, wordCount: countWords(s.body), title: s.title, body: s.body, marks: clone(s.marks), direction: s.direction })
    const keep = limit(userId, 'history.versions')
    if (typeof keep === 'number' && list.length > keep) list.splice(0, list.length - keep)
  }
  function snapshotIfDue(userId: string, s: Script) {
    const newest = versionsOf(s.id).at(-1)
    if (!newest || Date.parse(newest.createdAt) <= now() - VERSION_GAP_MS) snapshot(userId, s, 'edit')
  }
  function visibleVersions(userId: string, scriptId: string) {
    const days = limit(userId, 'history.days')
    const after = typeof days === 'number' ? now() - days * 86_400_000 : -Infinity
    return versionsOf(scriptId).filter(v => Date.parse(v.createdAt) >= after)
  }

  // ---------- storage ----------

  function storageOf(userId: string) {
    return db.s.storage[userId] ?? { state: 'none' as const, accountEmail: null, syncMode: 'off' as SyncMode }
  }
  function linked(userId: string) {
    return storageOf(userId).state === 'linked' && db.knobs.driveMode !== 'revoked'
  }
  function requireLinked(userId: string) {
    if (!linked(userId)) throw new PortError('storage_not_linked')
  }
  function remoteOf(userId: string) {
    return db.s.remoteTakes[userId] ?? (db.s.remoteTakes[userId] = [])
  }
  function requireProvider(userId: string) {
    const providers = limit(userId, 'storage.providers')
    if (!Array.isArray(providers) || !providers.includes('google_drive')) throw limitError('storage.providers', providers, null)
  }

  const drive = createFakeDrive({
    state: () => db.s.drive,
    write: fn => db.write(s => fn(s.drive)),
    mode: () => db.knobs.driveMode,
    tokenOk: t => issuedTokens.has(t) && !!sessionUser() && linked(sessionUser()!.id),
    blobs,
    sleep,
  })

  // ---------- feature 004: phone link ----------
  const hub = opts.hub ?? createMockHub({
    bus: broadcastBus(),
    offline: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tilw:mock:link-offline') === '1',
  })
  const phone = createMockLinks({
    kv,
    hub,
    now,
    call,
    origin,
    sessionUserId: () => sessionUser()?.id ?? null,
    limit: (userId, key) => limit(userId, key),
    script: (userId, scriptId) => {
      const s = userScripts(userId).find(x => x.id === scriptId)
      return s ? { id: s.id, title: s.title } : null
    },
  })

  // ---------- feature 005: AI writing tools ----------
  const aiMock = createMockAi({
    kv,
    now,
    call,
    sleep,
    sessionUserId: () => sessionUser()?.id ?? null,
    limit: (userId, key) => limit(userId, key),
    script: (userId, scriptId) => {
      const s = userScripts(userId).find(x => x.id === scriptId)
      return s ? clone(withReadOnly(s, readOnlyIds(userId))) : null
    },
    // A suggestion's apply is a versioned save against its base version that keeps an `ai` history version.
    applyFormatted: (userId, scriptId, body, marks, baseVersion) => {
      const s = userScripts(userId).find(x => x.id === scriptId)
      if (!s) throw new PortError('not_found')
      if (s.version !== baseVersion) throw new PortError('conflict', undefined, clone(withReadOnly(s, readOnlyIds(userId))))
      if (readOnlyIds(userId).has(s.id)) {
        throw limitError('scripts.max_active', limit(userId, 'scripts.max_active'), usage(userId, 'scripts.max_active'))
      }
      checkWords(userId, body)
      return db.write(() => {
        snapshot(userId, s, 'ai')
        s.body = body
        s.marks = clone(marks)
        s.version += 1
        s.updatedAt = new Date().toISOString()
        return clone(withReadOnly(s, readOnlyIds(userId)))
      })
    },
  })

  // ---------- feature 006: admin console ----------
  const adminMock = createMockAdmin({
    kv,
    db,
    now,
    call,
    origin,
    sessionUserId: () => sessionUser()?.id ?? null,
    mail,
    token,
    ai: aiMock.controls,
  })

  const services: Services = {
    admin: adminMock.admin,
    settings: adminMock.settings,
    ai: aiMock.ai,
    speech: aiMock.speech,
    links: phone.links,
    relay: phone.relay,
    realtime: createMockRealtime(hub, phone.server),
    auth: {
      me: () => call(() => {
        const u = sessionUser()
        return u ? publicUser(currentUser()) : null
      }),
      signIn: ({ email, password }) => call(() => {
        const u = db.s.users.find(x => x.email === normalizeEmail(email))
        if (!u || u.password !== password) throw new PortError('invalid_credentials')
        if (adminMock.hooks.isSuspended(u.id)) throw new PortError('account_suspended')
        const due = db.s.deletion[u.id]
        if (due !== undefined && due <= now()) {
          // The grace period is over: the account is gone.
          db.write((s) => {
            s.users = s.users.filter(x => x.id !== u.id)
            delete s.scripts[u.id]
            delete s.deletion[u.id]
          })
          throw new PortError('invalid_credentials')
        }
        db.write((s) => {
          // Feature 006: a deletion an admin scheduled is not cancelled by signing in (only an admin can).
          if (due !== undefined && !adminMock.hooks.deletionByAdmin(u.id)) {
            delete s.deletion[u.id]
            notice = 'deletion_cancelled'
          }
          s.sessionUserId = u.id
        })
        adminMock.hooks.touch(u.id)
        return publicUser(u)
      }),
      signOut: () => call(() => void db.write(s => (s.sessionUserId = null))),
      requestPasswordReset: ({ email }) => call(() => {
        const e = normalizeEmail(email)
        if (!isEmail(e)) throw new PortError('validation', { email: 'invalid' })
        db.write((s) => {
          if (!s.users.some(u => u.email === e)) return // no enumeration: same response
          const t = token()
          s.resets.push({ token: t, email: e, expiresAt: Date.now() + RESET_TTL, usedAt: null })
          mail(e, 'reset', `${origin}/reset-password?token=${t}`)
        })
      }),
      checkResetToken: t => call(() => ({ email: validToken(db.s.resets, t).email })),
      resetPassword: ({ token: t, password }) => call(() => {
        const rec = validToken(db.s.resets, t)
        checkPassword(password)
        // Feature 006: a suspended account can't finish a reset; the link stays unused.
        const owner = db.s.users.find(x => x.email === rec.email)
        if (owner && adminMock.hooks.isSuspended(owner.id)) throw new PortError('account_suspended')
        return db.write((s) => {
          rec.usedAt = Date.now()
          const u = s.users.find(x => x.email === rec.email)
          if (!u) throw new PortError('token_invalid')
          u.password = password
          s.sessionUserId = u.id
          return publicUser(u)
        })
      }),
      checkInvite: t => call(() => ({ email: validToken(db.s.invites, t).email })),
      acceptInvite: ({ token: t, name, password }) => call(() => {
        const rec = validToken(db.s.invites, t)
        if (!name.trim()) throw new PortError('validation', { name: 'required' })
        checkPassword(password)
        if (db.s.users.some(u => u.email === rec.email)) throw new PortError('token_invalid')
        return db.write((s) => {
          rec.usedAt = Date.now()
          const u = {
            id: uid('u'),
            name: name.trim(),
            email: rec.email,
            password,
            locale: 'ar' as const,
            theme: 'system' as const,
            reading: { ...DEFAULT_READING },
            createdAt: new Date().toISOString(),
          }
          s.users.push(u)
          s.scripts[u.id] = []
          s.sessionUserId = u.id
          return publicUser(u)
        })
      }),
      confirmEmail: t => call(() => {
        const entry = Object.entries(db.s.emailChange).find(([, c]) => c.token === t)
        if (!entry) throw new PortError('token_invalid')
        const [userId, change] = entry
        if (db.knobs.expireTokens || change.expiresAt <= now()) throw new PortError('token_expired')
        if (db.s.users.some(u => u.email === change.email && u.id !== userId)) throw new PortError('token_invalid')
        return db.write((s) => {
          const u = s.users.find(x => x.id === userId)
          if (!u) throw new PortError('token_invalid')
          u.email = change.email
          delete s.emailChange[userId]
          // Other sessions and phones are signed out when the address changes.
          s.devices[userId] = (s.devices[userId] ?? []).filter(d => d.current)
          return { email: change.email }
        })
      }),
      lastNotice: () => {
        const n = notice
        notice = null
        return n
      },
      // Feature 006: public sign-up, only while the sign-up mode is open.
      signUp: ({ name, email, password, locale: lang }) => call(() => {
        if (adminMock.hooks.signupMode() !== 'open') throw new PortError('signup_closed')
        const n = (name ?? '').trim()
        const e = normalizeEmail(email)
        if (!n || n.length > 120) throw new PortError('validation', { name: n ? 'max' : 'required' })
        if (!isEmail(e)) throw new PortError('validation', { email: 'invalid' })
        checkPassword(password)
        if (db.s.users.some(u => u.email === e)) throw new PortError('validation', { email: 'taken' })
        return db.write((s) => {
          const u = { id: uid('u'), name: n, email: e, password, locale: lang === 'en' ? 'en' as const : 'ar' as const, theme: 'system' as const, reading: { ...DEFAULT_READING }, createdAt: new Date(now()).toISOString() }
          s.users.push(u)
          s.scripts[u.id] = []
          s.sessionUserId = u.id
          return publicUser(u)
        })
      }),
    },

    waitlist: {
      join: ({ email }) => call(() => {
        const e = normalizeEmail(email)
        if (!isEmail(e)) throw new PortError('validation', { email: 'invalid' })
        db.write((s) => {
          if (!s.waitlist.some(w => w.email === e)) s.waitlist.push({ email: e, createdAt: Date.now() })
          mail(e, 'waitlist', null)
        })
      }),
    },

    scripts: {
      list: () => call(() => {
        const u = currentUser()
        const ro = readOnlyIds(u.id)
        return userScripts(u.id).map(s => withReadOnly(summarize(s), ro))
      }),
      search: query => call(() => {
        const q = foldForSearch(query.trim())
        if (!q) return []
        return userScripts(currentUser().id)
          .filter(s => foldForSearch(`${s.title}\n${s.body}`).includes(q))
          .map(s => s.id)
      }),
      get: id => call(() => withReadOnly(findScript(id), readOnlyIds(currentUser().id))),
      create: ({ title, body = '' }) => call(() => {
        const u = currentUser()
        const t = title.trim()
        if (!t || t.length > 120) throw new PortError('validation', { title: t ? 'max' : 'required' })
        checkActive(u.id)
        checkWords(u.id, body)
        const at = new Date().toISOString()
        const s: Script = {
          id: uid('s'),
          title: t,
          body,
          marks: [],
          direction: 'auto',
          pinned: false,
          archivedAt: null,
          version: 1,
          createdAt: at,
          updatedAt: at,
          lastOpenedAt: at,
          lastPosition: null,
        }
        db.write(() => userScripts(u.id).unshift(s))
        return withReadOnly(s, readOnlyIds(u.id))
      }),
      update: (id, patch, baseVersion) => call(() => {
        const u = currentUser()
        const s = findScript(id)
        // As the backend: opening a script only records when; it never changes the version and never conflicts
        // (feature 005: a waiting suggestion made from that version can still be applied later).
        if (Object.keys(patch).every(k => k === 'lastOpenedAt')) {
          return db.write(() => {
            if (patch.lastOpenedAt !== undefined) s.lastOpenedAt = patch.lastOpenedAt
            return clone(withReadOnly(s, readOnlyIds(u.id)))
          })
        }
        if (db.knobs.forceConflictOnNextSave && patch.body !== undefined) {
          db.setKnobs({ forceConflictOnNextSave: false })
          // Simulate an edit made on another device.
          db.write(() => {
            s.body = s.body.replace(/^[^\n]*/, m => `${m} (عُدّل على جهاز آخر)`)
            s.version += 1
            s.updatedAt = new Date().toISOString()
          })
        }
        if (s.version !== baseVersion) throw new PortError('conflict', undefined, clone(withReadOnly(s, readOnlyIds(u.id))))
        if (patch.title !== undefined && !patch.title.trim()) throw new PortError('validation', { title: 'required' })
        // Release 2: a read-only script keeps pin, archive and open, never edits.
        const edits = EDIT_FIELDS.some(k => patch[k] !== undefined)
        if (edits && readOnlyIds(u.id).has(s.id)) {
          throw limitError('scripts.max_active', limit(u.id, 'scripts.max_active'), usage(u.id, 'scripts.max_active'))
        }
        if (patch.body !== undefined) checkWords(u.id, patch.body)
        if (patch.archivedAt === null && s.archivedAt !== null) checkActive(u.id)
        const contentChange = patch.title !== undefined || patch.body !== undefined || patch.marks !== undefined
        return db.write(() => {
          if (edits) snapshotIfDue(u.id, s)
          Object.assign(s, patch)
          if (patch.title !== undefined) s.title = patch.title.trim()
          s.version += 1
          if (contentChange) s.updatedAt = new Date().toISOString()
          return withReadOnly(s, readOnlyIds(u.id))
        })
      }),
      duplicate: id => call(() => {
        const u = currentUser()
        const src = findScript(id)
        checkActive(u.id)
        const at = new Date().toISOString()
        const copy: Script = { ...clone(src), id: uid('s'), title: `${src.title} (نسخة)`, pinned: false, archivedAt: null, version: 1, createdAt: at, updatedAt: at, lastOpenedAt: null, lastPosition: null }
        delete copy.readOnly
        delete copy.readOnlyReason
        db.write(() => userScripts(u.id).unshift(copy))
        return withReadOnly(copy, readOnlyIds(u.id))
      }),
      remove: id => call(() => {
        const list = userScripts(currentUser().id)
        const i = list.findIndex(x => x.id === id)
        if (i < 0) throw new PortError('not_found')
        db.write((s) => {
          list.splice(i, 1)
          delete s.versions[id]
        })
        // Feature 004 (backend Script deleting hook): a deleted script can't be read with a remote any more.
        phone.endForScript(id)
      }),
      savePosition: (id, position) => call(() => {
        if (db.knobs.failPositionSave) throw new PortError('network')
        db.write(() => (findScript(id).lastPosition = position))
      }),
      listVersions: id => call(() => {
        const u = currentUser()
        findScript(id)
        return visibleVersions(u.id, id)
          .map(({ id: vid, createdAt, reason, wordCount }) => ({ id: vid, createdAt, reason, wordCount }))
          .reverse()
      }),
      getVersion: (id, versionId) => call(() => {
        const u = currentUser()
        findScript(id)
        const v = visibleVersions(u.id, id).find(x => x.id === versionId)
        if (!v) throw new PortError('not_found')
        return v
      }),
      restoreVersion: (id, versionId, baseVersion) => call(() => {
        const u = currentUser()
        const s = findScript(id)
        const v = visibleVersions(u.id, id).find(x => x.id === versionId)
        if (!v) throw new PortError('not_found')
        if (readOnlyIds(u.id).has(s.id)) throw limitError('scripts.max_active', limit(u.id, 'scripts.max_active'), usage(u.id, 'scripts.max_active'))
        if (s.version !== baseVersion) throw new PortError('conflict', undefined, clone(withReadOnly(s, readOnlyIds(u.id))))
        checkWords(u.id, v.body)
        return db.write(() => {
          snapshot(u.id, s, 'restore')
          Object.assign(s, { title: v.title, body: v.body, marks: clone(v.marks), direction: v.direction })
          s.version += 1
          s.updatedAt = new Date().toISOString()
          return withReadOnly(s, readOnlyIds(u.id))
        })
      }),
    },

    account: {
      updatePrefs: patch => call(() => {
        const u = currentUser()
        if (patch.name !== undefined && !patch.name.trim()) throw new PortError('validation', { name: 'required' })
        return db.write(() => publicUser(Object.assign(u, patch, patch.name ? { name: patch.name.trim() } : {})))
      }),
      updateReading: settings => call(() => db.write(() => publicUser(Object.assign(currentUser(), { reading: settings })))),
      exportData: ({ password }) => call(() => {
        const u = currentUser()
        if (u.password !== password) throw new PortError('invalid_credentials')
        return { format: 'tilw-account-v1', exportedAt: new Date().toISOString(), account: publicUser(u), scripts: userScripts(u.id) }
      }).then(data => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
      changePassword: ({ current, next }) => call(() => {
        const u = currentUser()
        if (u.password !== current) throw new PortError('invalid_credentials')
        checkPassword(next)
        db.write(() => (u.password = next))
      }),
      // Release 2: deletion is scheduled 14 days ahead; signing in before then cancels it.
      deleteAccount: ({ password }) => call(() => {
        const u = currentUser()
        if (u.password !== password) throw new PortError('invalid_credentials')
        const due = now() + DELETION_GRACE
        db.write((s) => {
          s.deletion[u.id] = due
          s.sessionUserId = null
        })
        return { deletionDueAt: iso(due) }
      }),
      requestEmailChange: ({ email, password }) => call(() => {
        const u = currentUser()
        if (u.password !== password) throw new PortError('invalid_credentials')
        const e = normalizeEmail(email)
        if (!isEmail(e)) throw new PortError('validation', { email: 'invalid' })
        if (e === u.email) throw new PortError('validation', { email: 'same' })
        const t = token()
        const expiresAt = now() + EMAIL_CHANGE_TTL
        db.write((s) => {
          s.emailChange[u.id] = { email: e, token: t, expiresAt }
          mail(e, 'email', `${origin}/confirm-email?token=${t}`)
        })
        return { email: e, expiresAt: iso(expiresAt) }
      }),
      pendingEmailChange: () => call(() => {
        const c = db.s.emailChange[currentUser().id]
        return c && c.expiresAt > now() ? { email: c.email, expiresAt: iso(c.expiresAt) } : null
      }),
      cancelEmailChange: () => call(() => void db.write(s => delete s.emailChange[currentUser().id])),
      resendEmailChange: () => call(() => {
        const u = currentUser()
        const c = db.s.emailChange[u.id]
        if (!c) throw new PortError('not_found')
        const t = token()
        db.write((s) => {
          s.emailChange[u.id] = { email: c.email, token: t, expiresAt: now() + EMAIL_CHANGE_TTL }
          mail(c.email, 'email', `${origin}/confirm-email?token=${t}`)
        })
      }),
      listDevices: () => call(() => db.s.devices[currentUser().id] ?? []),
      revokeDevice: id => call(() => {
        const u = currentUser()
        const list = db.s.devices[u.id] ?? []
        const d = list.find(x => x.id === id)
        if (!d || d.current) throw new PortError('not_found')
        db.write(s => (s.devices[u.id] = list.filter(x => x.id !== id)))
      }),
    },

    // Phase 1 stands in for the old app's browser keys with fixed sample scripts.
    legacy: {
      scan: () => call(() => {
        currentUser()
        return LEGACY_SCRIPTS.map(l => ({ ...l }))
      }),
    },

    plans: {
      listPlans: () => call(() => {
        if (db.knobs.plansDown) throw new PortError('network')
        return db.s.plans.filter(p => p.active !== false).map(p => publicPlan(p, db.s.limitDefinitions, locale()))
      }),
      myPlan: () => call((): MyPlan => {
        const u = currentUser()
        const sub = subscription(u.id)
        const key = sub?.plan ?? 'free'
        const plan = db.s.plans.find(p => p.key === key) ?? db.s.plans[0]!
        const seen = db.s.seenPlan[u.id]
        const change = seen !== undefined && seen !== key ? (key === 'free' ? 'pro_ended' : 'pro_started') : null
        if (seen !== key) db.write(s => (s.seenPlan[u.id] = key))
        const queued = sub ? db.s.subscriptions.find(x => x.userId === u.id && x.startsAt >= sub.endsAt) : undefined
        const pending = pendingRequest(u.id)
        return {
          plan: publicPlan(plan, db.s.limitDefinitions, locale()),
          period: sub?.period ?? null,
          startsAt: sub ? iso(sub.startsAt) : null,
          endsAt: sub ? iso(sub.endsAt) : null,
          renewsAfter: queued ? iso(queued.startsAt) : null,
          limits: allLimits(ctx(u.id), locale()),
          pendingRequest: pending ? publicRequest(pending) : null,
          notice: change,
        }
      }),
      requestUpgrade: ({ plan, period }) => call(() => {
        const u = currentUser()
        const p = db.s.plans.find(x => x.key === plan)
        if (!p || p.key === 'free') throw new PortError('validation', { plan: 'invalid' })
        if (period !== 'monthly' && period !== 'yearly') throw new PortError('validation', { period: 'invalid' })
        const priceCents = period === 'yearly' ? p.priceYearlyCents : p.priceMonthlyCents
        const existing = pendingRequest(u.id)
        const request = db.write((s) => {
          if (existing) {
            const r = s.requests.find(x => x.id === existing.id)!
            Object.assign(r, { plan, period, priceCents })
            return r
          }
          const t = now()
          const r = { id: uid('req'), userId: u.id, reference: requestReference(), plan, period, priceCents, state: 'pending' as const, createdAt: iso(t), expiresAt: iso(t + REQUEST_TTL) }
          s.requests.push(r)
          return r
        })
        const pub = publicRequest(request)
        return { request: pub, whatsappUrl: whatsappUrl(pub) }
      }),
      cancelRequest: () => call(() => {
        const r = pendingRequest(currentUser().id)
        if (!r) throw new PortError('not_found')
        db.write(s => (s.requests.find(x => x.id === r.id)!.state = 'cancelled'))
      }),
    },

    storage: {
      status: () => call(() => {
        const u = currentUser()
        const st = storageOf(u.id)
        const autoSyncAllowed = limit(u.id, 'storage.auto_sync') === true
        // Back on Free: auto sync becomes manual (the backend's daily job does this).
        if (st.syncMode === 'auto' && !autoSyncAllowed) db.write(s => (s.storage[u.id] = { ...st, syncMode: 'manual' }))
        const state = st.state === 'linked' && db.knobs.driveMode === 'revoked' ? 'revoked' : st.state
        const tilw = usedBytes(db.s.drive)
        const full = db.knobs.driveMode === 'full'
        return {
          provider: st.state === 'none' ? null : 'google_drive' as const,
          accountEmail: st.accountEmail,
          state,
          syncMode: storageOf(u.id).syncMode,
          autoSyncAllowed,
          quota: state === 'linked'
            ? { usedBytes: full ? DRIVE_TOTAL_BYTES : DRIVE_OTHER_BYTES + tilw, totalBytes: DRIVE_TOTAL_BYTES, tilwBytes: tilw, tilwTakes: Object.keys(db.s.drive.files).length }
            : null,
        }
      }),
      connectUrl: () => call(() => {
        const u = currentUser()
        requireProvider(u.id)
        if (db.knobs.denyDriveConsent) return `${origin}/app/settings/storage?error=denied`
        // The mock's "Google consent page" agrees at once and sends the person back.
        db.write((s) => {
          s.storage[u.id] = { state: 'linked', accountEmail: `${u.email.split('@')[0]}@gmail.com`, syncMode: storageOf(u.id).syncMode }
        })
        if (db.knobs.driveMode === 'revoked') db.setKnobs({ driveMode: 'ok' })
        return `${origin}/app/settings/storage?linked=1`
      }),
      unlink: () => call(() => {
        const u = currentUser()
        db.write((s) => {
          s.storage[u.id] = { state: 'none', accountEmail: null, syncMode: 'off' }
          remoteOf(u.id).forEach(t => (t.state = 'unreachable'))
        })
      }),
      setSyncMode: mode => call(() => {
        const u = currentUser()
        if (!['off', 'manual', 'auto'].includes(mode)) throw new PortError('validation', { mode: 'invalid' })
        if (mode !== 'off') requireLinked(u.id)
        if (mode === 'auto' && limit(u.id, 'storage.auto_sync') !== true) throw limitError('storage.auto_sync', limit(u.id, 'storage.auto_sync'), null)
        db.write(s => (s.storage[u.id] = { ...storageOf(u.id), syncMode: mode }))
        return { mode }
      }),
      uploadToken: scriptId => call(() => {
        const u = currentUser()
        requireLinked(u.id)
        if (scriptId) findScript(scriptId) // like the API: someone else's or a deleted script → not_found
        const t = `mock-tok-${token()}`
        issuedTokens.add(t)
        return { accessToken: t, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), rootFolderId: 'folder_root', folderId: scriptId ? `folder_${scriptId}` : null }
      }),
      uploader: () => drive,
    },

    remoteTakes: {
      list: scriptId => call(() => remoteOf(currentUser().id).filter(t => !scriptId || t.scriptId === scriptId)),
      register: input => call(() => {
        const u = currentUser()
        const existing = remoteOf(u.id).find(t => t.clientId === input.clientId)
        if (existing) return existing
        requireLinked(u.id)
        requireProvider(u.id)
        if (!input.clientId || !input.title?.trim() || input.durationMs < 1 || input.sizeBytes < 1) throw new PortError('validation', { take: 'invalid' })
        const max = limit(u.id, 'takes.max_minutes')
        if (typeof max === 'number' && input.durationMs > max * 60_000) {
          throw limitError('takes.max_minutes', max, Math.ceil(input.durationMs / 60_000))
        }
        if (db.knobs.driveMode === 'full') throw new PortError('storage_full')
        const take: RemoteTake = {
          id: uid('rt'),
          clientId: input.clientId,
          scriptId: input.scriptId,
          title: input.title.trim().slice(0, 160),
          kind: input.kind,
          mime: input.mime,
          durationMs: input.durationMs,
          sizeBytes: input.sizeBytes,
          recordedAt: input.recordedAt,
          starred: !!input.starred,
          providerFileId: null,
          state: 'uploading',
        }
        db.write(() => remoteOf(u.id).unshift(take))
        return take
      }),
      update: (id, patch) => call(() => {
        const u = currentUser()
        const t = remoteOf(u.id).find(x => x.id === id)
        if (!t) throw new PortError('not_found')
        return db.write(() => Object.assign(t, patch))
      }),
      remove: async (id, { remote }) => {
        const fileId = await call(() => {
          const u = currentUser()
          const t = remoteOf(u.id).find(x => x.id === id)
          if (!t) throw new PortError('not_found')
          if (remote && t.providerFileId) requireLinked(u.id)
          db.write((s) => {
            s.remoteTakes[u.id] = remoteOf(u.id).filter(x => x.id !== id)
            if (remote && t.providerFileId) delete s.drive.files[t.providerFileId]
          })
          return remote ? t.providerFileId : null
        })
        if (fileId) await blobs.del(fileId)
      },
    },
  }

  /** /__mock controls for release 2 (dev only). */
  const knobs = {
    now,
    /** Feature 005: AI knobs, grants and balance. */
    ai: aiMock.controls,
    /** Feature 006: admin console knobs (sign-up mode, suspend, lists fail, empty dashboard). */
    admin: adminMock.controls,
    /** Feature 005: an edit from another device (the apply conflict). */
    bumpScript(userId: string, scriptId: string) {
      const s = userScripts(userId).find(x => x.id === scriptId)
      if (!s) return
      db.write(() => {
        s.body = s.body.replace(/^[^\n]*/, m => `${m} (عُدّل على جهاز آخر)`)
        s.version += 1
        s.updatedAt = new Date().toISOString()
      })
    },
    setPlan(userId: string, key: string) {
      db.write((s) => {
        const t = now()
        // End whatever is in force, then (for a paid plan) start a custom subscription of one year.
        s.subscriptions.forEach(x => x.userId === userId && x.endsAt > t && (x.endsAt = t))
        if (key !== 'free') s.subscriptions.push({ id: uid('sub'), userId, plan: key, period: 'custom', startsAt: t, endsAt: periodEnd(t, 'yearly') })
      })
    },
    setPlanLimit(planKey: string, key: string, value: RawLimit) {
      db.write(s => (s.plans.find(p => p.key === planKey)!.limits[key] = value))
    },
    setPlanPrice(planKey: string, monthly: number, yearly: number) {
      db.write((s) => {
        const p = s.plans.find(x => x.key === planKey)!
        p.priceMonthlyCents = monthly
        p.priceYearlyCents = yearly
      })
    },
    setOverride(userId: string, key: string, value: RawLimit | undefined) {
      db.write((s) => {
        const o = (s.overrides[userId] ??= {})
        if (value === undefined) delete o[key]
        else o[key] = value
      })
    },
    pendingRequest: (userId: string) => pendingRequest(userId),
    /** Marks the pending request paid: Pro starts now for its period. */
    fulfil(userId: string) {
      const r = pendingRequest(userId)
      if (!r) return false
      db.write((s) => {
        const t = now()
        s.requests.find(x => x.id === r.id)!.state = 'fulfilled'
        s.subscriptions.push({ id: uid('sub'), userId, plan: r.plan, period: r.period, startsAt: t, endsAt: periodEnd(t, r.period) })
      })
      return true
    },
    settle(userId: string, state: 'rejected' | 'expired') {
      const r = pendingRequest(userId)
      if (!r) return false
      db.write(s => (s.requests.find(x => x.id === r.id)!.state = state))
      return true
    },
    /** A take backed up from another device: a Drive file and its record, with no copy in this browser. */
    async addRemoteOnlyTake(userId: string) {
      const audio = new Blob([new Uint8Array(4096)], { type: 'audio/webm' })
      const fileId = `drive_${Math.random().toString(36).slice(2, 12)}`
      await blobs.set(fileId, audio)
      const script = userScripts(userId)[0]
      db.write((s) => {
        s.drive.files[fileId] = { id: fileId, name: 'phone-take.webm', mimeType: 'audio/webm', sizeBytes: audio.size, folderId: 'folder_root', createdAt: Date.now() }
        remoteOf(userId).unshift({
          id: uid('rt'),
          clientId: uid('t_phone'),
          scriptId: script?.id ?? null,
          title: script ? `${script.title} · iPhone` : 'iPhone',
          kind: 'audio',
          mime: 'audio/webm',
          durationMs: 42_000,
          sizeBytes: audio.size,
          recordedAt: iso(now() - 86_400_000),
          starred: false,
          providerFileId: fileId,
          state: 'backed_up',
        })
      })
    },
    addPhone(userId: string) {
      db.write(s => (s.devices[userId] ??= []).push(mockPhone(now())))
    },
    /** Feature 004: this tab loses (or gets back) its realtime connection; kept across reloads of this tab. */
    setLinkOffline(off: boolean) {
      if (typeof sessionStorage !== 'undefined') {
        if (off) sessionStorage.setItem('tilw:mock:link-offline', '1')
        else sessionStorage.removeItem('tilw:mock:link-offline')
      }
      hub.setOffline(off)
    },
    linkOffline: () => hub.offline,
    /** Feature 004: end a link as the backend would for an account action (signed_out, script_deleted…). */
    endLink: phone.endWith,
    /** Feature 004 US4: pair a stand-in Tilw app with a studio's code; it runs in this tab (see mock/app.ts). */
    async pairMockApp(code: string) {
      const pairing = await phone.pairApp(code)
      return startMockApp({ relay: phone.relay, realtime: services.realtime, pairing })
    },
  }

  return { services, db, knobs, hub }
}

export type MockBackend = ReturnType<typeof createMockServices>
