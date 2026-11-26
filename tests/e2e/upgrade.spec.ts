import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { asAdmin, signOutMock } from './admin'
import { DAY, grantPro, knobs, mockState, signIn } from './r2'

// US2 (T024) — Asking for Pro with a WhatsApp number, the pending request and the Pro banners (quickstart scenario 3).

async function noViolations(page: Page, include: string) {
  const axe = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(axe.violations.map(v => v.id)).toEqual([])
}

/** Counts attempts to open a window: asking for Pro must never open one. */
async function countPopups(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __opened: number }
    w.__opened = 0
    window.open = () => (w.__opened++, null)
  })
}
const popups = (page: Page) => page.evaluate(() => (window as unknown as { __opened: number }).__opened)

test('asking for Pro takes a WhatsApp number, opens nothing, and shows the pending request', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan')
  await page.getByRole('button', { name: 'الترقية إلى Pro' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })
  await expect(sheet.getByRole('button', { name: 'خطتك الحالية' })).toBeDisabled()
  await expect(sheet.getByText('$77')).toBeVisible()
  await sheet.getByRole('radio', { name: 'شهري' }).click()
  await expect(sheet.getByText('$8')).toBeVisible()
  await sheet.getByRole('radio', { name: 'سنوي' }).click()
  await noViolations(page, 'dialog[open]')

  await countPopups(page)
  await sheet.getByRole('button', { name: 'طلب الترقية' }).click()
  const ask = page.getByRole('dialog', { name: 'رقم واتساب الخاص بك' })
  const field = ask.getByLabel('رقم واتساب')
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute('dir', 'ltr')

  // A number without its country code is refused in place.
  await field.fill('01001234567')
  await ask.getByRole('button', { name: 'إرسال الطلب' }).click()
  await expect(ask.getByRole('alert')).toContainText('أدخل رقمك مع رمز البلد')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await noViolations(page, 'dialog[open].phone-dialog')

  await field.fill('+20 100 123 4567')
  await field.press('Enter')
  await expect(page.getByText(/أُرسل طلبك/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await popups(page)).toBe(0)

  // The pending panel, changing the number, and cancelling.
  await expect(page.getByRole('heading', { name: 'طلب الترقية قيد الانتظار' })).toBeVisible()
  await expect(page.getByRole('main').getByText('سنوي', { exact: true })).toBeVisible()
  await expect(page.getByText('+201001234567', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'تغيير الرقم' }).click()
  await expect(field).toHaveValue('+201001234567')
  await field.fill('00966501234567')
  await ask.getByRole('button', { name: 'إرسال الطلب' }).click()
  await expect(page.getByText('+966501234567', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'إلغاء الطلب' }).click()
  await page.getByRole('dialog', { name: 'إلغاء طلب الترقية؟' }).getByRole('button', { name: 'إلغاء الطلب' }).click()
  await expect(page.getByText('أُلغي طلب الترقية.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'طلب الترقية قيد الانتظار' })).toHaveCount(0)
})

test('going back from the number returns to the plans, and the admin can open a chat with it', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan?upgrade=1')
  const sheet = page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })
  await sheet.getByRole('button', { name: 'طلب الترقية' }).click()
  const ask = page.getByRole('dialog', { name: 'رقم واتساب الخاص بك' })
  await ask.getByRole('button', { name: 'رجوع' }).click()
  await expect(ask).toHaveCount(0)
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: 'طلب الترقية' }).click()
  await ask.getByLabel('رقم واتساب').fill('+20 111 222 3333')
  await ask.getByRole('button', { name: 'إرسال الطلب' }).click()
  await expect(page.getByRole('heading', { name: 'طلب الترقية قيد الانتظار' })).toBeVisible()

  await signOutMock(page)
  await asAdmin(page, '/admin/subscriptions?tab=requests&q=layan@example.com')
  const chat = page.getByRole('link', { name: /\+201112223333/ })
  await expect(chat).toHaveAttribute('href', 'https://wa.me/201112223333')
  await expect(chat).toHaveAttribute('target', '_blank')
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
