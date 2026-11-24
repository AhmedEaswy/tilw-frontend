import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { signIn } from './r2'

// Feature 004, US3 (T036): Record and Stop from the phone (quickstart scenario 6). Its own file because the fake
// camera and microphone need launch options, which Playwright allows only per file.
test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
})

async function pairPhone(page: Page, context: BrowserContext) {
  await page.getByRole('button', { name: 'ربط الهاتف' }).first().click()
  const panel = page.getByRole('dialog', { name: 'ربط الهاتف' })
  const code = (await panel.locator('.code').textContent())!.replace(/\D/g, '')
  const phone = await context.newPage()
  await phone.goto('/remote')
  await phone.getByLabel('رمز من 6 أرقام').fill(code)
  await phone.getByRole('button', { name: 'اتصال' }).click()
  await expect(phone.getByText('متصل بالاستوديو')).toBeVisible()
  await panel.getByRole('button', { name: 'تم' }).click()
  return phone
}

test('Record and Stop from the phone; the take survives the phone leaving', async ({ page, context }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening/record')
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await expect(page.getByText('معاينة مباشرة')).toBeVisible()
  let phone = await pairPhone(page, context)

  await phone.getByRole('button', { name: 'تسجيل' }).click()
  await expect(phone.getByText('تم: تسجيل')).toBeVisible()
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible({ timeout: 8000 })
  await expect(phone.getByText(/يسجّل · \d+:\d\d/)).toBeVisible({ timeout: 8000 })

  // The phone page closes mid-take: the studio keeps recording.
  await phone.close()
  await page.waitForTimeout(1500)
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible()

  // Reopened, it reconnects without a code and stops the take, which is saved.
  phone = await context.newPage()
  await phone.goto('/remote')
  await expect(phone.getByText(/يسجّل · \d+:\d\d/)).toBeVisible({ timeout: 8000 })
  await phone.getByRole('button', { name: 'إيقاف التسجيل' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/, { timeout: 10_000 })
  await expect(page.getByText(/حُفظت المحاولة 1/)).toBeVisible()
  await expect(phone.getByText('حُفظت المحاولة', { exact: true })).toBeVisible()
})

test('Record is refused with the reason when the devices are off, and from rehearsal', async ({ page, context }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening/record')
  await expect(page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' })).toBeVisible()
  const phone = await pairPhone(page, context)
  await phone.getByRole('button', { name: 'تسجيل' }).click()
  await expect(phone.getByText('الكاميرا والميكروفون غير مفعّلين.')).toBeVisible()

  await page.goto('/app/scripts/s_opening/rehearse')
  await expect(phone.getByText(/الفقرة 1 من/)).toBeVisible({ timeout: 8000 })
  await phone.getByRole('button', { name: 'تسجيل' }).click()
  await expect(phone.getByText('افتح استوديو التسجيل لتسجّل.')).toBeVisible()
})
