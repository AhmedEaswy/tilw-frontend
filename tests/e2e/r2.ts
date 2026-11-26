import { expect, type Page } from '@playwright/test'

// Release 2 helpers: sign in as the seed account and change the in-browser mock's state the way /__mock does.

export const DAY = 86_400_000

/**
 * Wait until Nuxt has hydrated a prerendered page. Text typed into its form before then is reset by v-model when the
 * page hydrates (the email field ends up empty and sign-in shows "اكتب بريدك الإلكتروني").
 */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const app = (document.querySelector('#__nuxt') as (Element & { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } }) | null)?.__vue_app__
    return !!app && app.$nuxt?.isHydrating === false
  })
}

export async function signIn(page: Page, next = /\/app\/scripts$/) {
  await page.goto('/signin')
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(next)
  await knobs(page, { latencyMs: 50 })
}

/** Merge mock knobs (latency, clock, Drive mode…). Takes effect on the next page load. */
export async function knobs(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((p) => {
    const cur = JSON.parse(localStorage.getItem('tilw:mock:knobs') ?? '{}')
    localStorage.setItem('tilw:mock:knobs', JSON.stringify({ ...cur, ...p }))
  }, patch)
}

/**
 * Edit the saved mock state (plans, limits, subscriptions…). The in-app mock writes its whole state on every change,
 * so the edit is made from a page that makes no service calls, then the original page is loaded again.
 */
export async function mockState(page: Page, fn: string, arg?: unknown) {
  const back = page.url()
  await page.goto('/privacy')
  await page.evaluate(([body, a]) => {
    const s = JSON.parse(localStorage.getItem('tilw:mock:v1')!)
    // eslint-disable-next-line no-new-func
    new Function('s', 'arg', body as string)(s, a)
    localStorage.setItem('tilw:mock:v1', JSON.stringify(s))
  }, [fn, arg] as const)
  await page.goto(back)
}

export const setFreeLimit = (page: Page, key: string, value: unknown) =>
  mockState(page, 's.plans.find(p => p.key === "free").limits[arg.key] = arg.value', { key, value })

/** Pro in force from now for one year (as the admin would grant it). */
export const grantPro = (page: Page) =>
  mockState(page, `const now = Date.now() + (JSON.parse(localStorage.getItem('tilw:mock:knobs') || '{}').clockOffsetMs || 0);
    s.subscriptions.push({ id: 'sub_e2e', userId: 'u_layan', plan: 'pro', period: 'yearly', startsAt: now - 1000, endsAt: now + 365 * ${DAY} })`)

/** A Deepgram key is added and Speech to text is on for the plans (`ai.cloud_speech`). Call from a signed-in page. */
export async function cloudSpeech(page: Page) {
  await aiKnobs(page, { cloudSpeech: true })
  await page.reload()
  await hydrated(page)
}

/**
 * Feature 005: change the AI mock's knobs (formatting, speech, own key refused) and, when given, set the balance
 * through /__mock (it writes a correction entry). Knobs are read on every call, so they apply at once.
 */
export async function aiKnobs(page: Page, patch: Record<string, unknown>, balance?: number) {
  await page.evaluate((p) => {
    const cur = JSON.parse(localStorage.getItem('tilw:mock:ai:v1') ?? '{}')
    cur.knobs = { ...cur.knobs, ...p }
    localStorage.setItem('tilw:mock:ai:v1', JSON.stringify(cur))
  }, patch)
  if (balance === undefined) return
  const back = page.url()
  await page.goto('/__mock')
  await page.getByLabel('Set balance').fill(String(balance))
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await expect(page.getByTestId('mock-ai-balance')).toHaveText(String(balance))
  await page.goto(back)
}
