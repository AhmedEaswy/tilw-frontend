import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { DAY, grantPro, knobs, mockState, signIn } from './r2'

// US2 (T024) — Upgrade to Pro through WhatsApp, the pending request and the Pro banners (quickstart scenario 3).

test('the upgrade sheet shows the home-page poster, switches period, and falls back when the tab is blocked', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan')
  await page.getByRole('button', { name: 'الترقية إلى Pro' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })
  await expect(sheet.getByRole('button', { name: 'خطتك الحالية' })).toBeDisabled()
  await expect(sheet.getByText('$77')).toBeVisible()
  await sheet.getByRole('radio', { name: 'شهري' }).click()
  await expect(sheet.getByText('$8')).toBeVisible()
  await sheet.getByRole('radio', { name: 'سنوي' }).click()

  const axe = await new AxeBuilder({ page }).include('dialog[open]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(axe.violations.map(v => v.id)).toEqual([])

  // The browser blocks the new tab: the sheet shows the reference and the link.
  await page.evaluate(() => (window.open = () => null))
  await sheet.getByRole('button', { name: 'متابعة على واتساب' }).click()
  await expect(sheet.getByText(/^TLW-[A-Z2-9]{4}$/)).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'فتح رابط واتساب' })).toBeVisible()
  await sheet.getByRole('link', { name: 'إلى صفحة الخطة' }).click()

  // The pending panel, and cancelling it.
  await expect(page.getByRole('heading', { name: 'طلب الترقية قيد الانتظار' })).toBeVisible()
  await expect(page.getByText('سنوي', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'إلغاء الطلب' }).click()
  await page.getByRole('dialog', { name: 'إلغاء طلب الترقية؟' }).getByRole('button', { name: 'إلغاء الطلب' }).click()
  await expect(page.getByText('أُلغي طلب الترقية.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'طلب الترقية قيد الانتظار' })).toHaveCount(0)
})

test('the WhatsApp link carries plan, period, price and reference only', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan')
  await page.evaluate(() => {
    const w = { opener: null as unknown, location: { href: '' }, close() {} }
    ;(window as unknown as { __wa: typeof w }).__wa = w
    window.open = (() => w) as unknown as typeof window.open
  })
  await page.getByRole('button', { name: 'الترقية إلى Pro' }).first().click()
  await page.getByRole('button', { name: 'متابعة على واتساب' }).click()
  await expect(page.getByText(/فتحنا واتساب برسالة جاهزة/)).toBeVisible()
  const href = await page.evaluate(() => (window as unknown as { __wa: { location: { href: string } } }).__wa.location.href)
  const text = new URL(href).searchParams.get('text')!
  expect(new URL(href).host).toBe('wa.me')
  expect(text).toMatch(/Pro .*\$77 .*TLW-/)
  expect(text).not.toMatch(/layan|ليان/)
})

test('Pro starts once, warns before it ends, and says when it is back on Free', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan')
  await expect(page.getByText('المجانية', { exact: true })).toBeVisible() // the plan is read once (seen: free)
  await grantPro(page)
  await page.reload()
  await expect(page.getByText(/Pro مفعّلة حتى/)).toBeVisible()
  await expect(page.getByText('Tilw Pro', { exact: true }).first()).toBeVisible()

  await knobs(page, { clockOffsetMs: 359 * DAY })
  await page.reload()
  await expect(page.getByText(/تنتهي Pro في/)).toBeVisible()
  await page.getByRole('button', { name: 'إخفاء التنبيه' }).click()
  await expect(page.getByText(/تنتهي Pro في/)).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/تنتهي Pro في/)).toHaveCount(0) // hidden for 24 hours

  await knobs(page, { clockOffsetMs: 367 * DAY })
  await mockState(page, 's.storage.u_layan = { state: "linked", accountEmail: "layan@gmail.com", syncMode: "auto" }')
  await page.reload()
  await expect(page.getByText(/انتهت Pro وعدت إلى الخطة المجانية/)).toBeVisible()
  await page.goto('/app/settings/storage')
  await expect(page.getByRole('radio', { name: /يدوي/ })).toHaveAttribute('aria-checked', 'true')
})
