import { expect, test, type Page } from '@playwright/test'
import { hydrated } from './r2'

// US6 (T070–T076) — recording studio against Chromium's fake camera and microphone.

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
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

async function takeCount(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('tilw-takes')
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('takes')) return resolve(0)
      const keys = db.transaction('takes').objectStore('takes').getAllKeys()
      keys.onsuccess = () => resolve(keys.result.filter(k => String(k).startsWith('tilw:take-meta:')).length)
    }
    req.onerror = () => resolve(0)
  }))
}

test('records a video take with the prompter and keeps it in the browser', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening/record')
  await expect(page.getByRole('heading', { name: 'اختبر الصورة والصوت' })).toBeVisible()

  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await expect(page.getByText('معاينة مباشرة')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'الميكروفون' })).toBeVisible() // the "الأجهزة" label is desktop only

  await page.getByRole('button', { name: 'ابدأ التسجيل' }).click()
  await expect(page.getByText('يبدأ التسجيل بعد')).toBeVisible()
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible({ timeout: 6000 })
  await expect(page.getByText('الفقرة 1 من 3')).toBeVisible()
  await page.waitForTimeout(2000)

  await page.getByRole('button', { name: 'إيقاف وحفظ' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/)
  await expect(page.getByText(/حُفظت المحاولة 1/)).toBeVisible()
  expect(await takeCount(page)).toBe(1)
})

test('audio mode shows the sound check instead of the camera', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter/record')
  await page.getByRole('radio', { name: 'صوت', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'اختبر صوتك' })).toBeVisible()
  await page.getByRole('button', { name: 'تفعيل الميكروفون' }).click()
  await expect(page.getByText('صوتك الآن')).toBeVisible()
  // The floating mini player keeps a hidden <video> mounted; the record page itself shows none.
  await expect(page.locator('video:visible')).toHaveCount(0)
})

test('denied permission offers retry and rehearsal without recording', async ({ page }) => {
  await signIn(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await page.goto('/app/scripts/s_opening/record')
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await expect(page.getByRole('heading', { name: 'تعذر الوصول إلى الكاميرا والميكروفون' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible()
  await page.getByRole('link', { name: 'متابعة التدريب' }).click()
  await expect(page).toHaveURL(/\/rehearse$/)
})

test('cancelling the countdown returns to setup without recording', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening/record')
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await page.getByRole('button', { name: 'ابدأ التسجيل' }).click()
  await page.getByRole('button', { name: 'إلغاء' }).click()
  await expect(page.getByRole('button', { name: 'ابدأ التسجيل' })).toBeVisible()
  expect(await takeCount(page)).toBe(0)
})
