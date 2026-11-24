import { expect, type Page } from '@playwright/test'
import { hydrated, knobs } from './r2'

// Feature 006 helpers: sign in as the mock's demo admin, and edit the admin mock's own state.

export const ADMIN = 'admin@example.com'

/** Signs in as the demo admin and opens `next` (an /admin page) with a short mock latency. */
export async function asAdmin(page: Page, next = '/admin') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`)
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill(ADMIN)
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  // Match the path, not the end of the address: the sign-in page's own address ends with `?next=<next>`.
  await expect(page).toHaveURL(url => url.pathname === next.split('?')[0])
  await knobs(page, { latencyMs: 30 })
  await page.goto(next)
}

/** Signs in as the seed person (Layan). */
export async function asLayan(page: Page) {
  await page.goto('/signin')
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
  await knobs(page, { latencyMs: 30 })
}

/** Edits the admin mock's state (`tilw:mock:admin:v1`) from a page that makes no service calls, then comes back. */
export async function adminState(page: Page, body: string) {
  const back = page.url()
  await page.goto('/privacy')
  await page.evaluate((b) => {
    const s = JSON.parse(localStorage.getItem('tilw:mock:admin:v1') ?? '{}')
    // eslint-disable-next-line no-new-func
    new Function('s', b)(s)
    localStorage.setItem('tilw:mock:admin:v1', JSON.stringify(s))
  }, body)
  await page.goto(back)
}

/** Ends the mock session (as signing out elsewhere would). */
export async function signOutMock(page: Page) {
  await page.goto('/privacy')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tilw:mock:v1')!)
    s.sessionUserId = null
    localStorage.setItem('tilw:mock:v1', JSON.stringify(s))
  })
}
