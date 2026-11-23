import { expect, type Page } from '@playwright/test'

// Release 2 helpers: sign in as the seed account and change the in-browser mock's state the way /__mock does.

export const DAY = 86_400_000

export async function signIn(page: Page, next = /\/app\/scripts$/) {
  await page.goto('/signin')
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
