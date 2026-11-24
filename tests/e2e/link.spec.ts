import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { setFreeLimit, signIn } from './r2'

// Feature 004, US1 (T022): pair a phone and drive rehearsal (quickstart scenarios 1–3, 10).
// The studio and the "phone" are two pages of one browser context: they share the mock through localStorage and
// BroadcastChannel, as two tabs do.

const REHEARSE = '/app/scripts/s_opening/rehearse'

async function openPanel(page: Page) {
  await page.goto(REHEARSE)
  await page.getByRole('button', { name: 'ربط الهاتف' }).first().click()
  const panel = page.getByRole('dialog', { name: 'ربط الهاتف' })
  await expect(panel.getByRole('img', { name: 'رمز QR لعنوان التحكم من الهاتف' })).toBeVisible()
  return panel
}

test('pair by code, then Play, Next and Faster from the phone drive the studio', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  await expect(panel.getByText(/يعمل الرمز \d:\d\d دقيقة/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'بانتظار الهاتف' })).toBeVisible()
  const code = (await panel.locator('.code').textContent())!.replace(/\D/g, '')
  expect(code).toMatch(/^\d{6}$/)

  const phone = await context.newPage()
  await phone.goto('/remote')
  await phone.getByLabel('رمز من 6 أرقام').fill(code)
  await phone.getByRole('button', { name: 'اتصال' }).click()
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()
  await expect(phone.getByText(/الفقرة 1 من 3/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'الهاتف متصل' })).toBeVisible()

  await phone.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(phone.getByText('تم: الفقرة التالية')).toBeVisible()
  await expect(phone.getByText(/الفقرة 2 من 3/)).toBeVisible()

  await phone.getByRole('button', { name: 'أسرع' }).click()
  await expect(phone.getByText(/130 كلمة\/د/)).toBeVisible()

  await phone.getByRole('button', { name: 'الفقرة التالية' }).click()
  await phone.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(phone.getByText('وصلت إلى آخر فقرة.')).toBeVisible()

  const studioA11y = await new AxeBuilder({ page }).include('[data-link-panel]').analyze()
  expect(studioA11y.violations).toEqual([])
  const phoneA11y = await new AxeBuilder({ page: phone }).analyze()
  expect(phoneA11y.violations).toEqual([])
})

test('a wrong code gets one calm message', async ({ page, context }) => {
  await signIn(page)
  await openPanel(page)
  const phone = await context.newPage()
  await phone.goto('/remote')
  await phone.getByLabel('رمز من 6 أرقام').fill('000001')
  await phone.getByRole('button', { name: 'اتصال' }).click()
  await expect(phone.getByRole('alert')).toHaveText('هذا الرمز لا يعمل. اطلب من الاستوديو رمزاً جديداً.')
})

test('the QR address pairs without typing, and the secret leaves the address bar', async ({ page, context }) => {
  await signIn(page)
  await openPanel(page)
  // The QR encodes `<origin>/remote#<secret>`; the mock keeps the secret with the code.
  const secret = await page.evaluate(() => JSON.parse(localStorage.getItem('tilw:mock:links:v1')!).codes.at(-1).secret as string)
  const phone = await context.newPage()
  await phone.goto(`/remote#${secret}`)
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()
  expect(new URL(phone.url()).hash).toBe('')
})

test('Connect phone is locked when the plan does not include it', async ({ page }) => {
  await signIn(page)
  await setFreeLimit(page, 'phone_link.allowed', false)
  await page.goto(REHEARSE)
  await page.getByRole('button', { name: 'ربط الهاتف' }).first().click()
  const panel = page.getByRole('dialog', { name: 'ربط الهاتف' })
  await expect(panel.getByText('ربط الهاتف غير متاح في خطتك')).toBeVisible()
  await expect(panel.getByRole('button', { name: /الترقية/ })).toBeVisible()
})
