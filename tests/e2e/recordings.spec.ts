import { expect, test, type Page } from '@playwright/test'

// US7 (T080–T083) — recordings kept in this browser. Takes are made with Chromium's fake devices.

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  acceptDownloads: true,
})

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
  await page.evaluate(() => localStorage.setItem('tilw:mock:knobs', JSON.stringify({ latencyMs: 50 })))
}

async function recordTake(page: Page, script = 's_opening') {
  await page.goto(`/app/scripts/${script}/record`)
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await page.getByRole('button', { name: 'ابدأ التسجيل' }).click()
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'إيقاف وحفظ' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/)
}

test('first visit explains where takes appear', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/recordings')
  await expect(page.getByRole('heading', { name: 'هنا تجد محاولتك الأولى' })).toBeVisible()
  await page.getByRole('link', { name: 'اختيار نص' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
})

test('reviews, downloads, stars and deletes a take', async ({ page }) => {
  await signIn(page)
  await recordTake(page)
  await recordTake(page)

  await page.getByRole('link', { name: /مراجعة المحاولة/ }).click()
  await expect(page.getByRole('heading', { name: 'مراجعة المحاولة' })).toBeVisible()
  await expect(page.getByText('المحاولات')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'تنزيل الملف الأصلي' }).click()
  expect((await download).suggestedFilename()).toMatch(/^افتتاحية الحلقة - المحاولة 2\.(webm|mp4)$/)
  await expect(page.getByRole('heading', { name: 'أُرسل طلب التنزيل' })).toBeVisible()
  await page.getByRole('button', { name: 'رجوع' }).click()

  await page.getByRole('button', { name: 'تمييز كأفضل محاولة' }).click()
  await expect(page.getByText('الأفضل').first()).toBeVisible()

  await page.getByRole('button', { name: 'حذف المحاولة' }).click()
  await page.getByRole('button', { name: 'حذف نهائي' }).click()
  await expect(page.getByText('حُذفت المحاولة ٢.')).toBeVisible()
  await expect(page.getByText('المحاولة ١')).toBeVisible()
})
