import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { knobs, setFreeLimit, signIn } from './r2'

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

// US2 (T031): a dropped signal (quickstart scenarios 4–5). The mock's per-tab "offline for phone link" flag lives in
// sessionStorage, so the studio tab goes offline (or back) with a reload, as a studio whose network drops and returns.
const setStudioOffline = async (page: Page, off: boolean) => {
  await page.evaluate(o => (o ? sessionStorage.setItem('tilw:mock:link-offline', '1') : sessionStorage.removeItem('tilw:mock:link-offline')), off)
  await page.reload()
}

test('the phone rides out a dropped studio, a reload of its own, and ends after 10 idle minutes', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  const code = (await panel.locator('.code').textContent())!.replace(/\D/g, '')
  let phone = await context.newPage()
  await phone.goto('/remote')
  await phone.getByLabel('رمز من 6 أرقام').fill(code)
  await phone.getByRole('button', { name: 'اتصال' }).click()
  await phone.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(phone.getByText(/الفقرة 2 من 3/)).toBeVisible()

  // Studio offline: the phone says so within 10 s and its controls can't send.
  await setStudioOffline(page, true)
  await expect(phone.getByText('الاستوديو غير متصل')).toBeVisible({ timeout: 10_000 })
  await expect(phone.getByRole('button', { name: 'الفقرة التالية' })).toBeDisabled()

  // Back online: connected again and driving the studio (a reloaded studio numbers its states above the old ones).
  await setStudioOffline(page, false)
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible({ timeout: 10_000 })
  await phone.getByRole('button', { name: 'من البداية' }).click()
  await expect(phone.getByText(/الفقرة 1 من 3/)).toBeVisible()
  await phone.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(phone.getByText(/الفقرة 2 من 3/)).toBeVisible()

  // The phone reloads: it reconnects without a code and shows where the studio is.
  await phone.reload()
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()
  await expect(phone.getByText(/الفقرة 2 من 3/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'الهاتف متصل' })).toBeVisible()

  // Both sides gone for more than 10 minutes: the link ends as idle; the phone, reopened, says it ended.
  await phone.close()
  await setStudioOffline(page, true)
  await knobs(page, { clockOffsetMs: 11 * 60_000 })
  phone = await context.newPage()
  await phone.goto('/remote')
  await expect(phone.getByRole('heading', { name: 'انتهى الربط' })).toBeVisible()
  await expect(phone.getByRole('button', { name: 'إدخال رمز جديد' })).toBeVisible()
})

// US4 (T041): manage the link from the studio (quickstart scenarios 7, 8 and 11).
async function pairNewPhone(page: Page, context: BrowserContext, panel: ReturnType<Page['getByRole']>) {
  const code = (await panel.locator('.code').first().textContent())!.replace(/\D/g, '')
  const phone = await freshPhone(context)
  await phone.getByLabel('رمز من 6 أرقام').fill(code)
  await phone.getByRole('button', { name: 'اتصال' }).click()
  return phone
}

/** Another phone in the same browser: the mock lives in shared storage, so drop the pairing the last phone kept. */
async function freshPhone(context: BrowserContext) {
  const phone = await context.newPage()
  await phone.addInitScript(() => localStorage.removeItem('tilw:remote:v1'))
  await phone.goto('/remote')
  return phone
}

test('a second phone takes over after Accept; another is declined', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  const first = await pairNewPhone(page, context, panel)
  await expect(first.getByText('متصل بالاستوديو')).toBeVisible()

  await panel.getByRole('button', { name: 'رمز جديد' }).click()
  const second = await pairNewPhone(page, context, panel)
  await expect(second.getByRole('heading', { name: 'بانتظار موافقة الاستوديو' })).toBeVisible()
  await panel.getByRole('button', { name: 'قبول' }).click()
  await expect(first.getByText('تولّى هاتف آخر التحكم.')).toBeVisible()
  await expect(second.getByText('متصل بالاستوديو')).toBeVisible()

  await panel.getByRole('button', { name: 'رمز جديد' }).click()
  const third = await pairNewPhone(page, context, panel)
  await expect(third.getByRole('heading', { name: 'بانتظار موافقة الاستوديو' })).toBeVisible()
  await panel.getByRole('button', { name: 'رفض' }).click()
  await expect(third.getByText('لم يقبل الاستوديو هذا الهاتف.')).toBeVisible()
})

test('the request popover answers a second phone while the panel is closed', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  const first = await pairNewPhone(page, context, panel)
  await expect(first.getByText('متصل بالاستوديو')).toBeVisible()
  await panel.getByRole('button', { name: 'رمز جديد' }).click()
  const code = (await panel.locator('.code').first().textContent())!.replace(/\D/g, '')
  await panel.getByRole('button', { name: 'تم' }).click()
  const second = await freshPhone(context)
  await second.getByLabel('رمز من 6 أرقام').fill(code)
  await second.getByRole('button', { name: 'اتصال' }).click()
  const pop = page.locator('[data-link-request]')
  await expect(pop).toContainText('يريد التحكم في هذا الاستوديو.')
  await pop.getByRole('button', { name: 'قبول' }).click()
  await expect(second.getByText('متصل بالاستوديو')).toBeVisible()
  await expect(first.getByText('تولّى هاتف آخر التحكم.')).toBeVisible()
})

test('previews off: the phone shows only the title and position', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  const phone = await pairNewPhone(page, context, panel)
  await expect(phone.getByText(/الفقرة 1 من/)).toBeVisible()
  await panel.getByRole('switch', { name: 'عرض بداية الفقرة على الهاتف' }).click()
  await expect(phone.getByText('عرض النص على الهاتف متوقف.')).toBeVisible()
  await expect(phone.getByText(/الفقرة 1 من/)).toBeVisible()
})

test('with the Tilw app paired, swapping roles makes the studio the remote', async ({ page, context }) => {
  await signIn(page)
  const panel = await openPanel(page)
  const code = (await panel.locator('.code').first().textContent())!.replace(/\D/g, '')
  const app = await context.newPage()
  await app.goto('/__mock')
  await app.getByLabel('Studio code for the mock app').fill(code)
  await app.getByRole('button', { name: 'Pair the mock Tilw app' }).click()
  await expect(app.locator('[data-mock-app]')).toContainText('paired')

  await panel.getByRole('button', { name: 'اجعل التطبيق يقرأ' }).click()
  await expect(app.locator('[data-mock-app]')).toContainText('reads: yes')
  await panel.getByRole('button', { name: 'تم' }).click()
  const studioRemote = page.locator('[data-studio-remote]')
  await expect(studioRemote).toContainText('تطبيق Tilw يقرأ الآن')
  await studioRemote.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(app.locator('[data-mock-app]')).toContainText('paragraph 2')
  await expect(studioRemote.getByText(/الفقرة 2 من 3/)).toBeVisible()

  await studioRemote.getByRole('button', { name: 'القراءة هنا مجدداً' }).click()
  await expect(app.locator('[data-mock-app]')).toContainText('reads: no')
  await expect(studioRemote).toHaveCount(0)
})

test('a second studio tab offers Move here', async ({ page, context }) => {
  await signIn(page)
  await openPanel(page)
  const other = await context.newPage()
  await other.goto(REHEARSE)
  await other.getByRole('button', { name: 'ربط الهاتف' }).first().click()
  const panel2 = other.getByRole('dialog', { name: 'ربط الهاتف' })
  await expect(panel2.getByText('ربط الهاتف مفتوح في تبويب آخر لهذا الاستوديو.')).toBeVisible()
  await panel2.getByRole('button', { name: 'انقله إلى هنا' }).click()
  await expect(panel2.getByText('ربط الهاتف مفتوح في تبويب آخر لهذا الاستوديو.')).toHaveCount(0)
})

// US5 (T047): see my phone links and why one ended (quickstart scenario 9).
test('Settings → Phone links: empty, then open and ended links; End from there ends it on the phone', async ({ page, context }) => {
  await signIn(page)
  await page.goto('/app/settings')
  await page.getByRole('link', { name: /روابط الهاتف/ }).click()
  await expect(page.getByRole('heading', { name: 'لا توجد روابط هاتف بعد' })).toBeVisible()

  const panel = await openPanel(page)
  const phone = await pairNewPhone(page, context, panel)
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()

  await page.goto('/app/settings/phone-links')
  const history = page.locator('[data-link-history]')
  await expect(history.getByRole('listitem')).toHaveCount(1)
  await expect(history).toContainText('متصفح الهاتف')
  await history.getByRole('button', { name: 'إنهاء' }).click()
  await expect(phone.getByText('أنهى الاستوديو هذا الربط.')).toBeVisible()
  await expect(history).toContainText('أنهى الاستوديو هذا الربط.')
  await expect(history.getByRole('button', { name: 'إنهاء' })).toHaveCount(0)
})

for (const [reason, text] of [
  ['script_deleted', 'حُذف السكربت.'],
  ['signed_out', 'سُجّل الخروج من كل الأجهزة.'],
  ['limit', 'خطتك لم تعد تتضمن ربط الهاتف.'],
] as const) {
  test(`an account action (${reason}) ends the link with its reason on both sides`, async ({ page, context }) => {
    await signIn(page)
    const panel = await openPanel(page)
    const phone = await pairNewPhone(page, context, panel)
    await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()
    const mock = await context.newPage()
    await mock.goto('/__mock')
    await mock.getByLabel('End reason').selectOption(reason)
    await mock.getByRole('button', { name: 'End the open link' }).click()
    await expect(phone.getByText(text)).toBeVisible()
    await expect(panel.getByText(text)).toBeVisible()
  })
}
