import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { knobs, signIn } from './r2'

// US3 (T035) — Google Drive link, copies, failures and takes from other devices, against the mock's fake Drive
// (quickstart scenarios 4–5).

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  acceptDownloads: true,
})

/** "تعذّر النسخ · Drive ممتلئ": the status shows the state and the reason as two lines (R2-7). */
function failedFull(page: Page) {
  return page.getByRole('status').filter({ hasText: 'تعذّر النسخ' }).filter({ hasText: 'Drive ممتلئ' }).first()
}

async function recordTake(page: Page) {
  await page.goto('/app/scripts/s_opening/record')
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await page.getByRole('button', { name: 'ابدأ التسجيل' }).click()
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'إيقاف وحفظ' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/)
}

async function linkDrive(page: Page, mode: 'يدوي' | 'متوقف' = 'يدوي') {
  await page.goto('/app/settings/storage')
  await expect(page.getByText('يرى تِلو في Drive الملفات التي ينشئها فقط')).toBeVisible()
  await page.getByRole('button', { name: 'ربط Google Drive' }).click()
  await expect(page.getByText('رُبط Google Drive بحساب layan@gmail.com.')).toBeVisible()
  await expect(page).toHaveURL(/\/app\/settings\/storage$/)
  if (mode !== 'متوقف') {
    await page.getByRole('radio', { name: new RegExp(mode) }).click()
    await expect(page.getByText(`النسخ الآن: ${mode}.`)).toBeVisible() // saved before the next page load
  }
}

test('links Drive, copies a take by hand, and shows it in Google Drive; the bytes never leave for the Tilw API', async ({ page }) => {
  await signIn(page)
  await linkDrive(page)
  await expect(page.getByRole('meter', { name: 'مساحة Google Drive' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  await recordTake(page)
  await expect(page.getByText('النسخ إلى Google Drive: يدوي.')).toBeVisible()
  const bodies: string[] = []
  page.on('request', r => r.postDataBuffer() && r.postDataBuffer()!.length > 2048 && bodies.push(r.url()))
  await page.getByRole('button', { name: 'نسخ إلى Drive' }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'في Google Drive' }).first()).toBeVisible()
  expect(bodies).toEqual([]) // the mock's Drive lives in the browser; nothing large is posted anywhere
})

test('Auto is locked on Free and opens the upgrade sheet', async ({ page }) => {
  await signIn(page)
  await linkDrive(page, 'متوقف')
  await page.getByRole('radio', { name: /تلقائي/ }).click()
  await expect(page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })).toBeVisible()
})

test('a full Drive fails the copy with the reason and Retry; the take still plays from the device', async ({ page }) => {
  await signIn(page)
  await linkDrive(page)
  await recordTake(page)
  await knobs(page, { driveMode: 'full' })
  await page.reload()
  await page.getByRole('button', { name: 'نسخ إلى Drive' }).first().click()
  await expect(failedFull(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'عرض المساحة' }).first()).toBeVisible()

  await knobs(page, { driveMode: 'ok' })
  await page.reload()
  await expect(failedFull(page)).toBeVisible() // the failure is remembered
  await page.getByRole('button', { name: 'أعد المحاولة' }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'في Google Drive' }).first()).toBeVisible()
})

test('a take from another device is In Drive only, plays from Drive, and can be deleted from Drive', async ({ page }) => {
  await signIn(page)
  await linkDrive(page)
  await page.goto('/__mock')
  await page.getByRole('button', { name: 'Add a take from another device' }).click()
  await expect(page.getByText('Added a take that is only in Drive')).toBeVisible()
  await page.goto('/app/recordings')
  await expect(page.getByText('في Drive فقط').first()).toBeVisible()
  await page.locator('a[href^="/app/recordings/r_"]').first().click()
  await expect(page.getByRole('heading', { name: 'في Google Drive فقط' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'تنزيل الملف الأصلي' }).click()
  expect((await download).suggestedFilename()).toMatch(/iPhone\.webm$/)
  await page.getByRole('button', { name: 'رجوع' }).click()
  await page.getByRole('button', { name: 'حذف المحاولة' }).click()
  await page.getByRole('dialog', { name: 'حذف المحاولة من Drive؟' }).getByRole('button', { name: 'حذف من Drive' }).click()
  await expect(page.getByText('حُذفت المحاولة من Drive.')).toBeVisible()
})

test('a take in both places asks where to delete it', async ({ page }) => {
  await signIn(page)
  await linkDrive(page)
  await recordTake(page)
  await page.getByRole('button', { name: 'نسخ إلى Drive' }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'في Google Drive' }).first()).toBeVisible()
  await page.getByRole('link', { name: /مراجعة/ }).first().click()
  await page.getByRole('button', { name: 'حذف المحاولة' }).click()
  const dialog = page.getByRole('dialog', { name: 'أين تريد حذف المحاولة؟' })
  await expect(dialog.getByRole('button', { name: 'من الجهاز ومن Drive' })).toBeVisible()
  await dialog.getByRole('button', { name: 'من هذا الجهاز فقط' }).click()
  // The Drive copy stays: the take is now In Drive only.
  await expect(page.getByRole('heading', { name: 'في Google Drive فقط' })).toBeVisible()
})

test('unlinking keeps device takes and marks Drive-only takes not reachable', async ({ page }) => {
  await signIn(page)
  await linkDrive(page)
  await page.goto('/__mock')
  await page.getByRole('button', { name: 'Add a take from another device' }).click()
  await expect(page.getByText('Added a take that is only in Drive')).toBeVisible()
  await page.goto('/app/settings/storage')
  await page.getByRole('button', { name: 'إلغاء الربط' }).click()
  await page.getByRole('dialog', { name: 'إلغاء ربط Google Drive؟' }).getByRole('button', { name: 'إلغاء الربط' }).click()
  await expect(page.getByText('غير مرتبط')).toBeVisible()
  await page.goto('/app/recordings')
  await expect(page.getByText('غير متاح').first()).toBeVisible()
})
