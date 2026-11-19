/**
 * In-browser mock backend implementing every port. Mirrors the behaviour the Laravel API will have:
 * non-enumerating auth errors, token expiry, optimistic-concurrency conflicts, rate-limit-free.
 * Emails are not sent; reset and invite links land in `db.s.outbox` (shown on /__mock).
 */
import type { Services } from '../ports'
import {
  DEFAULT_READING,
  PortError,
  type Script,
  type ScriptSummary,
  type User,
} from '../types'
import { countWords, firstLine, isEmail, normalizeEmail, PASSWORD_MIN, splitParagraphs } from '../../utils/text'
import { MockDb, type KV, type MockToken } from './db'

const RESET_TTL = 60 * 60_000
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const token = () => Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join('')

export function createMockServices(kv: KV, opts: { origin?: string; sleep?: (ms: number) => Promise<void> } = {}) {
  const db = new MockDb(kv)
  const origin = opts.origin ?? ''
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))

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
  function currentUser() {
    const u = db.s.users.find(x => x.id === db.s.sessionUserId)
    if (!u) throw new PortError('unauthenticated')
    return u
  }
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
    if (!rec || rec.usedAt) throw new PortError('token_invalid')
    if (db.knobs.expireTokens || rec.expiresAt < Date.now()) throw new PortError('token_expired')
    return rec
  }
  function checkPassword(pw: string) {
    if (pw.length < PASSWORD_MIN) throw new PortError('validation', { password: 'min' })
  }
  function summarize(s: Script): ScriptSummary {
    const { body, marks: _m, ...rest } = s
    return { ...rest, excerpt: firstLine(body), wordCount: countWords(body), paragraphCount: splitParagraphs(body).length }
  }
  function mail(to: string, kind: 'reset' | 'invite' | 'waitlist', link: string | null) {
    db.s.outbox.unshift({ id: uid('m'), to, kind, link, sentAt: Date.now() })
    db.s.outbox.splice(20)
  }

  const services: Services = {
    auth: {
      me: () => call(() => {
        const u = db.s.users.find(x => x.id === db.s.sessionUserId)
        return u ? publicUser(u) : null
      }),
      signIn: ({ email, password }) => call(() => {
        const u = db.s.users.find(x => x.email === normalizeEmail(email))
        if (!u || u.password !== password) throw new PortError('invalid_credentials')
        db.write(s => (s.sessionUserId = u.id))
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
      list: () => call(() => userScripts(currentUser().id).map(summarize)),
      get: id => call(() => findScript(id)),
      create: ({ title, body = '' }) => call(() => {
        const t = title.trim()
        if (!t || t.length > 120) throw new PortError('validation', { title: t ? 'max' : 'required' })
        const now = new Date().toISOString()
        const s: Script = {
          id: uid('s'),
          title: t,
          body,
          marks: [],
          direction: 'auto',
          pinned: false,
          archivedAt: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          lastPosition: null,
        }
        db.write(() => userScripts(currentUser().id).unshift(s))
        return s
      }),
      update: (id, patch, baseVersion) => call(() => {
        const s = findScript(id)
        if (db.knobs.forceConflictOnNextSave && patch.body !== undefined) {
          db.setKnobs({ forceConflictOnNextSave: false })
          // Simulate an edit made on another device.
          db.write(() => {
            s.body = s.body.replace(/^[^\n]*/, m => `${m} (عُدّل على جهاز آخر)`)
            s.version += 1
            s.updatedAt = new Date().toISOString()
          })
        }
        if (s.version !== baseVersion) throw new PortError('conflict', undefined, clone(s))
        if (patch.title !== undefined && !patch.title.trim()) throw new PortError('validation', { title: 'required' })
        const contentChange = patch.title !== undefined || patch.body !== undefined || patch.marks !== undefined
        return db.write(() => {
          Object.assign(s, patch)
          if (patch.title !== undefined) s.title = patch.title.trim()
          s.version += 1
          if (contentChange) s.updatedAt = new Date().toISOString()
          return s
        })
      }),
      duplicate: id => call(() => {
        const src = findScript(id)
        const now = new Date().toISOString()
        const copy: Script = { ...clone(src), id: uid('s'), title: `${src.title} (نسخة)`, pinned: false, archivedAt: null, version: 1, createdAt: now, updatedAt: now, lastOpenedAt: null, lastPosition: null }
        db.write(() => userScripts(currentUser().id).unshift(copy))
        return copy
      }),
      remove: id => call(() => {
        const list = userScripts(currentUser().id)
        const i = list.findIndex(x => x.id === id)
        if (i < 0) throw new PortError('not_found')
        db.write(() => list.splice(i, 1))
      }),
      savePosition: (id, position) => call(() => void db.write(() => (findScript(id).lastPosition = position))),
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
      deleteAccount: ({ password }) => call(() => {
        const u = currentUser()
        if (u.password !== password) throw new PortError('invalid_credentials')
        db.write((s) => {
          s.users = s.users.filter(x => x.id !== u.id)
          delete s.scripts[u.id]
          s.sessionUserId = null
        })
      }),
    },
  }

  return { services, db }
}

export type MockBackend = ReturnType<typeof createMockServices>
