/**
 * Feature 005: mock of backend 004 (AI writing tools), persisted in KV `tilw:mock:ai:v1` (research R9, data-model).
 *
 * - Ledger: a lazy `monthly` entry per UTC month (`ai.credits_monthly`), plan changes, grants (used first), charges,
 *   refunds linked to their charge, `own_key` entries of 0 and `overrun` charges that may take the balance below zero.
 *   A charge is refused while the balance is below its cost.
 * - Suggestions: one per script for 24 h, from a word-preserving fake formatter; apply is a versioned save (the
 *   `applyFormatted` hook, which keeps an `ai` history version).
 * - Permissions: `fake` uploads; `complete` takes `fake-<seconds>` (settles on that length), `fake-failed` (refund),
 *   refuses anything else as `not_this_permission`; `fail` refunds nothing; unused permissions expire after 10 min
 *   with their credits kept.
 * - Own key: never stored, only provider and last four; 60 own-key calls an hour.
 */
import type { AiPort, SpeechPort } from '../ports'
import {
  PortError,
  type AiCapability,
  type CreditEntry,
  type Credits,
  type DeliveryMark,
  type FormatSuggestion,
  type OwnKey,
  type Script,
  type SpeechPurpose,
  type Transcription,
  type TranscriptionPermission,
} from '../types'
import { AI_RULES } from '../types'
import { countWords } from '../../utils/text'
import { creditsForSeconds, creditsForWords, isAllowedAudioType } from '../ai/audio'
import { fakeSpeech, type FakeSpeechMode } from '../ai/speech'
import type { KV } from './db'
import type { RawLimit } from './plans'

const KEY = 'tilw:mock:ai:v1'
const TOKEN_MS = 5 * 60_000
const REFUND_WINDOW_MS = 10 * 60_000
const OWN_KEY_PER_HOUR = 60

export interface MockAiKnobs {
  format: 'ok' | 'slow' | 'unavailable' | 'changed_words'
  /** The provider refuses own keys (on save, check and use). */
  keyRefused: boolean
  speech: FakeSpeechMode
}
export const DEFAULT_AI_KNOBS: MockAiKnobs = { format: 'ok', keyRefused: false, speech: 'ok' }

interface MockEntry extends CreditEntry {
  userId: string
  month: string
  /** The part that counts in the month's pool (grants: 0). */
  monthlyAmount: number
  /** grantId → amount drawn (−) or given back (+). */
  draws?: Record<string, number>
  /** monthly / plan_change: the plan's monthly amount it was made for. */
  target?: number
}
interface MockTranscription extends Transcription { userId: string; requestId: string | null; chargeId: string | null; failReason: string | null }
interface AiState {
  entries: MockEntry[]
  suggestions: Record<string, FormatSuggestion & { userId: string }>
  transcriptions: Record<string, MockTranscription>
  keys: Record<string, OwnKey>
  ownKeyCalls: Record<string, number[]>
  knobs: MockAiKnobs
}

export interface MockAiDeps {
  kv: KV
  now: () => number
  call: <T>(fn: () => T) => Promise<T>
  sleep: (ms: number) => Promise<void>
  sessionUserId: () => string | null
  limit: (userId: string, key: string) => RawLimit
  /** The person's script with its read-only flag, or null. */
  script: (userId: string, scriptId: string) => Script | null
  /** Versioned save of a suggestion: `conflict` (+ current) when stale, `limit_reached` when read-only. Keeps an `ai` version. */
  applyFormatted: (userId: string, scriptId: string, body: string, marks: DeliveryMark[], baseVersion: number) => Script
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`
const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7)
const renewsAt = (ms: number) => {
  const d = new Date(ms)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString()
}
const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number) as [number, number]
  return monthOf(Date.UTC(y, mo - 2, 1))
}

// ---------- the fake formatter (research R9) ----------

const SENTENCE_END = /[.!?؟…]["'»”)]*$/

/** Same words in the same order: short paragraphs, pauses between sentences, emphasis and one note. */
export function fakeFormat(body: string, locale: 'ar' | 'en' = 'ar'): { body: string; marks: DeliveryMark[] } {
  const tokens = body.split(/\s+/).filter(Boolean)
  const sentences: string[][] = []
  let cur: string[] = []
  for (const t of tokens) {
    cur.push(t)
    if (SENTENCE_END.test(t)) {
      sentences.push(cur)
      cur = []
    }
  }
  if (cur.length) sentences.push(cur)
  const marks: DeliveryMark[] = []
  const paragraphs: string[] = []
  let offset = 0
  const mid = () => `ai_${Math.random().toString(36).slice(2, 10)}`
  for (let i = 0; i < sentences.length; i += 2) {
    const group = sentences.slice(i, i + 2)
    const start = offset
    let text = ''
    group.forEach((s, j) => {
      if (j) text += ' '
      const sStart = start + text.length
      text += s.join(' ')
      if (i === 0 && j === 0) marks.push({ id: mid(), type: 'note', start: sStart, end: start + text.length, note: locale === 'en' ? 'Slow down' : 'أبطئ هنا' })
      if (j < group.length - 1) marks.push({ id: mid(), type: 'pause', start: start + text.length, end: start + text.length, pauseSec: 0.8 })
    })
    // Emphasis on the paragraph's longest word.
    let best = { at: -1, len: 0 }
    let pos = 0
    for (const w of text.split(' ')) {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, '')
      if (clean.length > best.len) best = { at: pos + w.indexOf(clean[0] ?? ''), len: clean.length }
      pos += w.length + 1
    }
    if (best.at >= 0 && best.len > 3) marks.push({ id: mid(), type: 'emphasis', start: start + best.at, end: start + best.at + best.len })
    paragraphs.push(text)
    offset += text.length + 2
  }
  return { body: paragraphs.join('\n\n'), marks: marks.sort((a, b) => a.start - b.start) }
}

export const sameWords = (a: string, b: string) => a.split(/\s+/).filter(Boolean).join(' ') === b.split(/\s+/).filter(Boolean).join(' ')

export function createMockAi(d: MockAiDeps) {
  function read(): AiState {
    let s: Partial<AiState> | null = null
    try {
      const raw = d.kv.getItem(KEY)
      s = raw ? (JSON.parse(raw) as AiState) : null
    } catch {
      s = null
    }
    return {
      entries: s?.entries ?? [],
      suggestions: s?.suggestions ?? {},
      transcriptions: s?.transcriptions ?? {},
      keys: s?.keys ?? {},
      ownKeyCalls: s?.ownKeyCalls ?? {},
      knobs: { ...DEFAULT_AI_KNOBS, ...s?.knobs },
    }
  }
  /** Read, change and save in one step; saved even when the call throws (a refund after a failure is kept). */
  function tx<T>(fn: (s: AiState) => T): T {
    const s = read()
    try {
      return fn(s)
    } finally {
      d.kv.setItem(KEY, JSON.stringify(s))
    }
  }
  function me() {
    const id = d.sessionUserId()
    if (!id) throw new PortError('unauthenticated')
    return id
  }
  const iso = (ms = d.now()) => new Date(ms).toISOString()
  const intLimit = (userId: string, key: string, fallback: number) => {
    const v = d.limit(userId, key)
    return typeof v === 'number' ? v : fallback
  }

  // ---------- ledger ----------
  const mine = (s: AiState, userId: string) => s.entries.filter(e => e.userId === userId)
  function grantRemainder(s: AiState, g: MockEntry) {
    return g.amount + s.entries.reduce((n, e) => n + (e.draws?.[g.id] ?? 0), 0)
  }
  function activeGrants(s: AiState, userId: string) {
    const t = d.now()
    return mine(s, userId)
      .filter(e => e.kind === 'grant' && (!e.endsAt || Date.parse(e.endsAt) > t))
      .sort((a, b) => (a.endsAt ? Date.parse(a.endsAt) : Infinity) - (b.endsAt ? Date.parse(b.endsAt) : Infinity) || a.createdAt.localeCompare(b.createdAt))
  }
  const pool = (s: AiState, userId: string, month = monthOf(d.now())) =>
    mine(s, userId).filter(e => e.month === month).reduce((n, e) => n + e.monthlyAmount, 0)
  const granted = (s: AiState, userId: string) => activeGrants(s, userId).reduce((n, g) => n + Math.max(0, grantRemainder(s, g)), 0)
  function balance(s: AiState, userId: string) {
    ensureMonth(s, userId)
    return pool(s, userId) + granted(s, userId)
  }
  function add(s: AiState, userId: string, e: Partial<MockEntry> & Pick<MockEntry, 'kind' | 'amount' | 'monthlyAmount'>): MockEntry {
    const entry: MockEntry = {
      id: uid('ce'),
      userId,
      month: monthOf(d.now()),
      capability: null,
      status: null,
      refundOf: null,
      endsAt: null,
      reason: null,
      createdAt: iso(),
      ...e,
    }
    s.entries.push(entry)
    return entry
  }
  /** Lazy month start, the previous month's debt, and plan changes (backend research §5). */
  function ensureMonth(s: AiState, userId: string) {
    const month = monthOf(d.now())
    const list = mine(s, userId).filter(e => e.month === month)
    const target = intLimit(userId, 'ai.credits_monthly', 0)
    if (!list.some(e => e.kind === 'monthly')) {
      const prev = mine(s, userId).filter(e => e.month === prevMonth(month))
      const prevPool = prev.reduce((n, e) => n + e.monthlyAmount, 0)
      add(s, userId, { kind: 'monthly', amount: target, monthlyAmount: target, target })
      if (prev.length && prevPool < 0) add(s, userId, { kind: 'overrun', amount: prevPool, monthlyAmount: prevPool })
      return
    }
    const base = list.filter(e => e.kind === 'monthly' || e.kind === 'plan_change')
    const last = base.at(-1)?.target ?? target
    if (last === target) return
    const current = base.reduce((n, e) => n + e.monthlyAmount, 0)
    // Upgrade: top up by the difference, once. Downgrade: down to the new amount minus what was used, never below 0.
    const used = -list.filter(e => e.kind === 'charge' || e.kind === 'refund').reduce((n, e) => n + e.monthlyAmount, 0)
    const desired = target > last ? current + (target - last) : Math.max(target, used)
    add(s, userId, { kind: 'plan_change', amount: desired - current, monthlyAmount: desired - current, target })
  }
  function creditsLimitError(s: AiState, userId: string, cost: number) {
    return new PortError('limit_reached', undefined, undefined, { key: 'ai.credits_monthly', value: d.limit(userId, 'ai.credits_monthly'), usage: null }, { balance: balance(s, userId), cost })
  }
  /** Draws from grants (soonest end first), then from the month. `allowNegative` only for overruns. */
  function charge(s: AiState, userId: string, cost: number, capability: AiCapability, kind: 'charge' | 'overrun' = 'charge'): MockEntry {
    if (kind === 'charge' && balance(s, userId) < cost) throw creditsLimitError(s, userId, cost)
    const draws: Record<string, number> = {}
    let left = cost
    for (const g of activeGrants(s, userId)) {
      if (!left) break
      const take = Math.min(left, Math.max(0, grantRemainder(s, g)))
      if (take > 0) {
        draws[g.id] = -take
        left -= take
      }
    }
    return add(s, userId, { kind, amount: -cost, monthlyAmount: -left, draws, capability, status: 'pending' })
  }
  function refund(s: AiState, chargeId: string, amount?: number) {
    const c = s.entries.find(e => e.id === chargeId)
    if (!c) return null
    const given = s.entries.filter(e => e.refundOf === c.id).reduce((n, e) => n + e.amount, 0)
    const n = Math.min(amount ?? -c.amount, -c.amount - given)
    if (n <= 0) return null
    // Grant draws come back first.
    const draws: Record<string, number> = {}
    let left = n
    for (const [g, v] of Object.entries(c.draws ?? {})) {
      const back = Math.min(left, -v)
      if (back > 0) {
        draws[g] = back
        left -= back
      }
    }
    return add(s, c.userId, { kind: 'refund', amount: n, monthlyAmount: left, draws, refundOf: c.id, capability: c.capability, status: 'succeeded', month: c.month })
  }
  function finish(s: AiState, chargeId: string | null, status: 'succeeded' | 'failed') {
    const c = chargeId ? s.entries.find(e => e.id === chargeId) : null
    if (c) c.status = status
  }
  function publicEntry(e: MockEntry): CreditEntry {
    const { userId: _u, month: _m, monthlyAmount: _a, draws: _d, target: _t, ...rest } = e
    return rest
  }
  function creditsOf(s: AiState, userId: string): Credits {
    const b = balance(s, userId)
    const month = monthOf(d.now())
    return {
      balance: b,
      monthly: intLimit(userId, 'ai.credits_monthly', 0),
      monthlyLeft: pool(s, userId),
      granted: granted(s, userId),
      month,
      renewsAt: renewsAt(d.now()),
      entries: mine(s, userId)
        .filter(e => e.month === month)
        .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt) || s.entries.indexOf(b2) - s.entries.indexOf(a))
        .map(publicEntry),
    }
  }

  // ---------- own key ----------
  const byokAllowed = (userId: string) => d.limit(userId, 'byok.allowed') === true
  function keyOf(s: AiState, userId: string): OwnKey | null {
    const k = s.keys[userId]
    if (!k) return null
    const allowed = byokAllowed(userId)
    return { ...k, usable: allowed && k.checkOk, reason: allowed ? null : 'byok.allowed' }
  }
  function ownKeyCall(s: AiState, userId: string) {
    const t = d.now()
    const recent = (s.ownKeyCalls[userId] ?? []).filter(x => x > t - 3_600_000)
    if (recent.length >= OWN_KEY_PER_HOUR) {
      const e = new PortError('rate_limited', undefined, undefined, undefined, { retryAfter: Math.ceil((recent[0]! + 3_600_000 - t) / 1000) })
      throw e
    }
    recent.push(t)
    s.ownKeyCalls[userId] = recent
  }

  // ---------- suggestions ----------
  function liveSuggestion(s: AiState, userId: string, scriptId: string) {
    const sg = s.suggestions[scriptId]
    if (!sg || sg.userId !== userId) return null
    if (Date.parse(sg.expiresAt) <= d.now()) {
      delete s.suggestions[scriptId]
      return null
    }
    return sg
  }
  const publicSuggestion = (sg: FormatSuggestion & { userId: string }, b: number): FormatSuggestion => {
    const { userId: _u, ...rest } = sg
    return { ...rest, balance: b }
  }
  function scriptOrThrow(userId: string, scriptId: string) {
    const sc = d.script(userId, scriptId)
    if (!sc) throw new PortError('not_found')
    return sc
  }

  // ---------- transcriptions ----------
  function validateAudio(userId: string, input: { seconds: number; bytes: number; mimeType: string }) {
    const fields: Record<string, string> = {}
    if (!Number.isInteger(input.seconds) || input.seconds < 1) fields.seconds = 'min'
    if (!Number.isInteger(input.bytes) || input.bytes < 1) fields.bytes = 'min'
    else if (input.bytes > AI_RULES.audioMaxBytes) fields.bytes = 'max'
    if (!isAllowedAudioType(input.mimeType || '')) fields.mimeType = 'audio'
    if (Object.keys(fields).length) throw new PortError('validation', fields)
    const max = intLimit(userId, 'ai.audio_max_minutes', AI_RULES.audioMaxMinutes)
    if (input.seconds > max * 60) throw new PortError('limit_reached', undefined, undefined, { key: 'ai.audio_max_minutes', value: max, usage: null })
  }
  function publicTranscription(t: MockTranscription): Transcription {
    const { userId: _u, requestId: _r, chargeId: _c, failReason: _f, ...rest } = t
    return rest
  }
  /** Housekeeping as `tilw:ai-expire`: an unused permission past its window expires; its credits stay spent. */
  function settleExpired(s: AiState) {
    const t = d.now()
    for (const x of Object.values(s.transcriptions)) {
      if (x.state === 'issued' && Date.parse(x.refundableAt) <= t) {
        x.state = 'expired'
        finish(s, x.chargeId, 'failed')
      }
    }
  }

  const ai: AiPort = {
    formatEstimate: scriptId => d.call(() => tx((s) => {
      const userId = me()
      const sc = scriptOrThrow(userId, scriptId)
      const words = countWords(sc.body)
      const credits = creditsForWords(words)
      const key = keyOf(s, userId)
      const b = balance(s, userId)
      const own = !!key?.usable
      return {
        words,
        credits,
        balance: b,
        paidWith: own ? 'own_key' as const : 'credits' as const,
        ownKey: key ? { provider: key.provider, last4: key.last4, usable: key.usable, reason: key.reason } : null,
        enough: own || b >= credits,
      }
    })),

    format: async (scriptId, opts = {}) => {
      if (read().knobs.format === 'slow') await d.sleep(4000)
      return d.call(() => tx((s) => {
        const userId = me()
        const sc = scriptOrThrow(userId, scriptId)
        if (sc.readOnly) throw new PortError('limit_reached', undefined, undefined, { key: 'scripts.max_active', value: d.limit(userId, 'scripts.max_active'), usage: null })
        const words = countWords(sc.body)
        if (!words) throw new PortError('validation', { body: 'required' })
        const cost = creditsForWords(words)
        const key = keyOf(s, userId)
        const own = !!key?.usable && !opts.useCredits
        let entry: MockEntry
        if (own) {
          ownKeyCall(s, userId)
          if (s.knobs.keyRefused) {
            s.keys[userId]!.checkOk = false
            s.keys[userId]!.checkedAt = iso()
            add(s, userId, { kind: 'own_key', amount: 0, monthlyAmount: 0, capability: 'format', status: 'failed' })
            throw new PortError('own_key_refused')
          }
          entry = add(s, userId, { kind: 'own_key', amount: 0, monthlyAmount: 0, capability: 'format', status: 'pending' })
        } else {
          entry = charge(s, userId, cost, 'format')
        }
        const mode = s.knobs.format
        if (mode === 'unavailable' || mode === 'changed_words') {
          if (!own) refund(s, entry.id)
          entry.status = 'failed'
          throw new PortError('ai_unavailable', undefined, undefined, undefined, mode === 'changed_words' ? { reason: 'changed_words' } : { reason: 'provider_error', retryAfter: 30 })
        }
        const out = fakeFormat(sc.body)
        if (!sameWords(out.body, sc.body)) {
          if (!own) refund(s, entry.id)
          entry.status = 'failed'
          throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'changed_words' })
        }
        entry.status = 'succeeded'
        const sg: FormatSuggestion & { userId: string } = {
          id: uid('fs'),
          userId,
          scriptId,
          baseVersion: sc.version,
          body: out.body,
          marks: out.marks,
          words,
          credits: own ? 0 : cost,
          paidWith: own ? 'own_key' : 'credits',
          balance: 0,
          expiresAt: iso(d.now() + AI_RULES.suggestionHours * 3_600_000),
          createdAt: iso(),
        }
        s.suggestions[scriptId] = sg
        return publicSuggestion(sg, balance(s, userId))
      }))
    },

    suggestion: scriptId => d.call(() => tx((s) => {
      const userId = me()
      scriptOrThrow(userId, scriptId)
      const sg = liveSuggestion(s, userId, scriptId)
      return sg ? publicSuggestion(sg, balance(s, userId)) : null
    })),

    discard: scriptId => d.call(() => tx((s) => {
      const userId = me()
      if (!liveSuggestion(s, userId, scriptId)) throw new PortError('not_found')
      delete s.suggestions[scriptId]
    })),

    apply: scriptId => d.call(() => tx((s) => {
      const userId = me()
      const sg = liveSuggestion(s, userId, scriptId)
      if (!sg) throw new PortError('not_found')
      const out = d.applyFormatted(userId, scriptId, sg.body, sg.marks, sg.baseVersion)
      delete s.suggestions[scriptId]
      return out
    })),

    credits: () => d.call(() => tx(s => creditsOf(s, me()))),

    keys: () => d.call(() => tx((s) => {
      const k = keyOf(s, me())
      return k ? [k] : []
    })),

    saveKey: ({ provider, key }) => d.call(() => tx((s) => {
      const userId = me()
      if (!byokAllowed(userId)) throw new PortError('limit_reached', undefined, undefined, { key: 'byok.allowed', value: false, usage: null })
      const fields: Record<string, string> = {}
      if (provider !== 'anthropic' && provider !== 'openai') fields.provider = 'in'
      const k = (key ?? '').trim()
      if (k.length < AI_RULES.ownKeyMin) fields.key = 'min'
      else if (k.length > AI_RULES.ownKeyMax) fields.key = 'max'
      if (Object.keys(fields).length) throw new PortError('validation', fields)
      if (s.knobs.keyRefused) throw new PortError('own_key_refused')
      s.keys[userId] = { capability: 'text', provider, last4: k.slice(-4), checkOk: true, checkedAt: iso(), usable: true, reason: null }
      return keyOf(s, userId)!
    })),

    deleteKey: () => d.call(() => tx((s) => {
      const userId = me()
      if (!s.keys[userId]) throw new PortError('not_found')
      delete s.keys[userId]
    })),

    checkKey: () => d.call(() => tx((s) => {
      const userId = me()
      const k = s.keys[userId]
      if (!k) throw new PortError('not_found')
      k.checkOk = !s.knobs.keyRefused
      k.checkedAt = iso()
      return keyOf(s, userId)!
    })),

    transcriptionEstimate: input => d.call(() => tx((s) => {
      const userId = me()
      validateAudio(userId, input)
      const credits = creditsForSeconds(input.seconds)
      const b = balance(s, userId)
      return { credits, balance: b, enough: b >= credits, ownKeyApplies: false as const }
    })),

    startTranscription: input => d.call(() => tx((s) => {
      const userId = me()
      settleExpired(s)
      validateAudio(userId, input)
      const purpose: SpeechPurpose = input.purpose ?? 'text'
      const cost = creditsForSeconds(input.seconds)
      const entry = charge(s, userId, cost, purpose === 'captions' ? 'captions' : 'transcribe')
      const id = uid('tr')
      const t = d.now()
      const rec: MockTranscription = {
        id,
        userId,
        purpose,
        language: input.language ?? 'auto',
        seconds: input.seconds,
        credits: cost,
        state: 'issued',
        durationSeconds: null,
        tokenExpiresAt: iso(t + TOKEN_MS),
        refundableAt: iso(t + REFUND_WINDOW_MS),
        createdAt: iso(t),
        requestId: null,
        chargeId: entry.id,
        failReason: null,
      }
      s.transcriptions[id] = rec
      const permission: TranscriptionPermission = {
        ...publicTranscription(rec),
        upload: {
          provider: 'fake',
          method: 'POST',
          url: `https://fake-speech.invalid/v1/listen?tag=tilw-${id}`,
          headers: { Authorization: 'Bearer fake-grant' },
          expiresAt: rec.tokenExpiresAt,
        },
        balance: balance(s, userId),
      }
      return permission
    })),

    transcription: id => d.call(() => tx((s) => {
      const userId = me()
      settleExpired(s)
      const t = s.transcriptions[id]
      if (!t || t.userId !== userId) throw new PortError('not_found')
      return publicTranscription(t)
    })),

    complete: (id, requestId) => d.call(() => tx((s) => {
      const userId = me()
      settleExpired(s)
      const t = s.transcriptions[id]
      if (!t || t.userId !== userId) throw new PortError('not_found')
      if (t.state !== 'issued') throw new PortError('conflict', undefined, publicTranscription(t))
      const claimed = Object.values(s.transcriptions).some(x => x.id !== id && x.requestId === requestId)
      const m = /^fake-(\d+)$/.exec(requestId)
      if (claimed || (requestId !== 'fake-failed' && !m)) throw new PortError('validation', { requestId: 'not_this_permission' })
      t.requestId = requestId
      if (!m) {
        t.state = 'failed'
        if (t.chargeId) refund(s, t.chargeId)
        t.credits = 0
        finish(s, t.chargeId, 'failed')
        return publicTranscription(t)
      }
      const real = Number(m[1])
      const realCost = creditsForSeconds(real)
      t.durationSeconds = real
      t.state = 'used'
      if (realCost < t.credits && t.chargeId) refund(s, t.chargeId, t.credits - realCost)
      if (realCost > t.credits) charge(s, userId, realCost - t.credits, t.purpose === 'captions' ? 'captions' : 'transcribe', 'overrun').status = 'succeeded'
      t.credits = realCost
      finish(s, t.chargeId, 'succeeded')
      return publicTranscription(t)
    })),

    fail: (id, reason) => d.call(() => tx((s) => {
      const userId = me()
      const t = s.transcriptions[id]
      if (!t || t.userId !== userId) throw new PortError('not_found')
      if (t.state !== 'issued') throw new PortError('conflict', undefined, publicTranscription(t))
      t.failReason = reason ?? 'device'
      return publicTranscription(t)
    })),
  }

  /** The browser → provider upload, faked; the knob picks the provider's answer. */
  const speech: SpeechPort = {
    async send(upload, _audio, o) {
      await d.sleep(400)
      if (upload.provider !== 'fake') throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'provider_failed' })
      if (Date.parse(upload.expiresAt) <= d.now()) throw new PortError('ai_unavailable', undefined, undefined, undefined, { reason: 'expired' })
      return fakeSpeech(o.seconds, { language: o.language, purpose: o.purpose, mode: read().knobs.speech })
    },
  }

  /** /__mock controls (not part of the port). */
  const controls = {
    knobs: () => read().knobs,
    setKnobs: (patch: Partial<MockAiKnobs>) => tx((s) => {
      s.knobs = { ...s.knobs, ...patch }
    }),
    grant: (userId: string, amount: number, endsAt: string | null = null) => tx((s) => {
      ensureMonth(s, userId)
      add(s, userId, { kind: 'grant', amount, monthlyAmount: 0, endsAt, reason: 'mock' })
    }),
    /** Writes a correction so the balance becomes `n`. */
    setBalance: (userId: string, n: number) => tx((s) => {
      const diff = n - balance(s, userId)
      if (diff) add(s, userId, { kind: 'correction', amount: diff, monthlyAmount: diff, reason: 'mock' })
    }),
    balance: (userId: string) => tx(s => balance(s, userId)),
    expireSuggestion: (scriptId: string) => tx((s) => {
      const sg = s.suggestions[scriptId]
      if (sg) sg.expiresAt = iso(d.now() - 1000)
    }),
    /** Run the expiry housekeeping now (as `tilw:ai-expire`). */
    settleExpired: () => tx(s => settleExpired(s)),
    reset: () => d.kv.removeItem(KEY),
  }

  return { ai, speech, controls }
}
