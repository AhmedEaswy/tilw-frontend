import { beforeEach, describe, expect, it } from 'vitest'
import { createHttpServices } from '~/services/http'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'
import { formatPrice, yearlySaving } from '~/utils/money'
import { normalizePhone, whatsappChatUrl } from '~/utils/phone'

// US2 (T023): upgrade requests, the WhatsApp number they carry and the one-time plan notices.

const noSleep = () => Promise.resolve()
const DAY = 86_400_000
const phone = '+201001234567'

describe('upgrade requests in the mock', () => {
  let m: ReturnType<typeof createMockServices>
  let userId: string
  beforeEach(async () => {
    m = createMockServices(memoryKV(), { sleep: noSleep })
    userId = (await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })).id
  })

  it('returns the same TLW-XXXX reference when asked twice, updating the period and price', async () => {
    const a = await m.services.plans.requestUpgrade({ plan: 'pro', period: 'monthly', phone })
    expect(a.request.reference).toMatch(/^TLW-[A-Z2-9]{4}$/)
    expect(a.request.priceCents).toBe(800)
    const b = await m.services.plans.requestUpgrade({ plan: 'pro', period: 'yearly', phone })
    expect(b.request.reference).toBe(a.request.reference)
    expect(b.request).toMatchObject({ period: 'yearly', priceCents: 7700, state: 'pending' })
    expect((await m.services.plans.myPlan()).pendingRequest?.reference).toBe(a.request.reference)
  })

  it('keeps the number with its country code, and takes the newest one on the pending request', async () => {
    const a = await m.services.plans.requestUpgrade({ plan: 'pro', period: 'yearly', phone: '0020 (100) 123-4567' })
    expect(a.request.phone).toBe(phone)
    expect(a).not.toHaveProperty('whatsappUrl')
    await m.services.plans.requestUpgrade({ plan: 'pro', period: 'yearly', phone: '+966 50 123 4567' })
    expect((await m.services.plans.myPlan()).pendingRequest?.phone).toBe('+966501234567')
  })

  it('refuses a number without a country code', async () => {
    const e = await m.services.plans.requestUpgrade({ plan: 'pro', period: 'yearly', phone: '01001234567' }).catch(e => e)
    expect(isPortError(e, 'validation') && e.fields?.phone).toBeTruthy()
    expect((await m.services.plans.myPlan()).pendingRequest).toBeNull()
  })

  it('validates plan and period, and cancels the pending request', async () => {
    expect(isPortError(await m.services.plans.requestUpgrade({ plan: 'free', period: 'yearly', phone }).catch(e => e), 'validation')).toBe(true)
    await m.services.plans.requestUpgrade({ plan: 'pro', period: 'monthly', phone })
    await m.services.plans.cancelRequest()
    expect((await m.services.plans.myPlan()).pendingRequest).toBeNull()
    expect(isPortError(await m.services.plans.cancelRequest().catch(e => e), 'not_found')).toBe(true)
  })

  it('expires a request after 30 days', async () => {
    await m.services.plans.requestUpgrade({ plan: 'pro', period: 'monthly', phone })
    m.db.setKnobs({ clockOffsetMs: 31 * DAY })
    expect((await m.services.plans.myPlan()).pendingRequest).toBeNull()
  })

  it('reports pro_started once after fulfilment, then pro_ended once after the period', async () => {
    await m.services.plans.myPlan() // first read: nothing to announce
    await m.services.plans.requestUpgrade({ plan: 'pro', period: 'yearly', phone })
    expect(m.knobs.fulfil(userId)).toBe(true)
    const started = await m.services.plans.myPlan()
    expect(started).toMatchObject({ notice: 'pro_started', period: 'yearly', pendingRequest: null })
    expect(started.plan.key).toBe('pro')
    expect(Date.parse(started.endsAt!) - Date.now()).toBeGreaterThan(364 * DAY)
    expect((await m.services.plans.myPlan()).notice).toBeNull()

    m.db.setKnobs({ clockOffsetMs: 367 * DAY })
    const ended = await m.services.plans.myPlan()
    expect(ended).toMatchObject({ notice: 'pro_ended' })
    expect(ended.plan.key).toBe('free')
    expect((await m.services.plans.myPlan()).notice).toBeNull()
  })

  it('formats prices with $ and Western digits, and the yearly saving', () => {
    expect(formatPrice(7700)).toBe('$77')
    expect(formatPrice(800)).toBe('$8')
    expect(formatPrice(750)).toBe('$7.50')
    expect(yearlySaving(800, 7700)).toBe(20)
    expect(yearlySaving(0, 0)).toBe(0)
  })
})

describe('phone numbers', () => {
  it('accepts how people type them and stores + and digits', () => {
    for (const typed of ['+20 100 123 4567', '0020 100.123.4567', '+٢٠ ١٠٠ ١٢٣ ٤٥٦٧', '\u200F+20-100-123-4567']) {
      expect(normalizePhone(typed)).toBe(phone)
    }
  })

  it('refuses a local number, junk and wrong lengths', () => {
    for (const typed of ['', '01001234567', '201001234567', '+1234567', '+1234567890123456', '+20 100 CALL ME', '+20+1001234567', '+0201001234567']) {
      expect(normalizePhone(typed)).toBeNull()
    }
  })

  it('builds the chat link the admin opens', () => {
    expect(whatsappChatUrl(phone)).toBe('https://wa.me/201001234567')
  })
})

describe('upgrade requests over HTTP', () => {
  it('posts plan, period and phone', async () => {
    const calls: { method: string; url: string; body?: unknown }[] = []
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? 'GET', url: String(url), body: init.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204, headers: { 'X-CSRF-TOKEN': 't' } })
      return new Response(JSON.stringify({ request: { reference: 'TLW-7K3Q' } }), { status: 201 })
    }) as unknown as typeof fetch
    const { services } = createHttpServices({ baseUrl: 'http://api.test', fetch: f, readCookie: () => null })
    const r = await services.plans.requestUpgrade({ plan: 'pro', period: 'monthly', phone })
    expect(r).toEqual({ request: { reference: 'TLW-7K3Q' } })
    expect(calls.at(-1)).toMatchObject({ method: 'POST', url: 'http://api.test/api/user/subscription-requests', body: { plan: 'pro', period: 'monthly', phone } })
  })
})
