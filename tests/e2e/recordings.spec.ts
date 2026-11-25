import { expect, test, type Page } from '@playwright/test'
import { hydrated } from './r2'

// US7 (T080–T083) — recordings kept in this browser. Takes are made with Chromium's fake devices.

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  acceptDownloads: true,
})

async function signIn(page: Page) {
  await page.goto('/signin')
  await hydrated(page)
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

  await page.locator('a[href^="/app/recordings/"]').first().click() // the latest take's card
  await expect(page.getByRole('heading', { name: 'مراجعة المحاولة' })).toBeVisible()
  await expect(page.getByText('المحاولات', { exact: true })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'تنزيل الملف الأصلي' }).click()
  expect((await download).suggestedFilename()).toMatch(/^افتتاحية الحلقة - المحاولة 2\.(webm|mp4)$/)
  await expect(page.getByRole('status').filter({ hasText: 'أُرسل طلب التنزيل' })).toBeVisible() // an h2 announced as a status
  await page.getByRole('button', { name: 'رجوع' }).click()

  await page.getByRole('button', { name: 'تمييز كأفضل محاولة' }).click()
  await expect(page.getByText('الأفضل').first()).toBeVisible()

  await page.getByRole('button', { name: 'حذف المحاولة' }).click()
  await page.getByRole('button', { name: 'حذف نهائي' }).click()
  await expect(page.getByText('حُذفت المحاولة ٢.')).toBeVisible()
  await expect(page.getByText('المحاولة ١')).toBeVisible()
})

test('a script’s tabs switch between the script and only its recordings', async ({ page }) => {
  await signIn(page)
  await recordTake(page, 's_opening')

  await page.goto('/app/scripts/s_opening')
  const tabs = page.getByRole('navigation', { name: 'عرض النص' })
  await expect(tabs.getByRole('link', { name: 'النص' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('link', { name: 'التسجيلات' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_opening\/recordings$/)
  await expect(tabs.getByRole('link', { name: 'التسجيلات' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 1, name: 'افتتاحية الحلقة' })).toBeVisible()
  await expect(page.locator('a[href^="/app/recordings/"]').first()).toBeVisible()

  // Another script with no takes shows its own empty state, offering to record it.
  await page.goto('/app/scripts/s_backstage/recordings')
  await expect(page.getByRole('heading', { name: 'لا تسجيلات لهذا النص بعد' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'سجّل هذا النص' })).toHaveAttribute('href', '/app/scripts/s_backstage/record')
  await tabs.getByRole('link', { name: 'النص' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_backstage$/)
})

test('the library counts each script’s recordings, and recordings link back to their script', async ({ page, isMobile }) => {
  await signIn(page)
  await recordTake(page, 's_opening')

  // Recordings list: "Open script" is in the take's "…" menu (desktop card, phone feature card).
  await page.getByTestId('take-more').first().locator('button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'فتح النص' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_opening$/)

  // Take details: open its script from the header.
  await page.goto('/app/recordings')
  await page.locator('a[href^="/app/recordings/"]').first().click()
  // Phone hides the header links and keeps "back to script" at the foot of the page.
  if (isMobile) await page.getByRole('link', { name: 'العودة إلى النص' }).click()
  else await page.getByTestId('take-open-script').click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_opening$/)

  // The library row shows how many recordings the script has.
  await page.goto('/app/scripts')
  const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: /افتتاحية الحلقة/ }) })
  await expect(row.getByTestId('script-takes')).toHaveText('1 تسجيل')
})
