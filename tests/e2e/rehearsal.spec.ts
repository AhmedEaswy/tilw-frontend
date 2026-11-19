import { expect, test, type Page } from '@playwright/test'

// T067 — rehearsal flows against the static build and the in-browser mock.

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
}

async function knobs(page: Page, k: Record<string, unknown>) {
  await page.evaluate(v => localStorage.setItem('tilw:mock:knobs', JSON.stringify({ latencyMs: 50, ...v })), k)
}

test('plays after the countdown and pauses with Space', async ({ page }) => {
  await signIn(page)
  await knobs(page, {})
  await page.goto('/app/scripts/s_opening/rehearse')
  await expect(page.getByText('الفقرة 1 من 3')).toBeVisible()

  await page.keyboard.press('Space')
  await expect(page.getByRole('status', { name: /يبدأ التدريب بعد/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'إيقاف مؤقت' })).toBeVisible()
  // First paragraph is 5 words: 3 s countdown + 2.5 s at 120 WPM.
  await expect(page.getByText('الفقرة 2 من 3')).toBeVisible({ timeout: 8000 })

  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'تشغيل' })).toBeVisible()
})

test('manual mode steps one paragraph with the arrow keys', async ({ page }) => {
  await signIn(page)
  await knobs(page, {})
  await page.goto('/app/scripts/s_backstage/rehearse')
  await page.getByRole('button', { name: 'إعدادات القراءة' }).click()
  await page.getByRole('radio', { name: 'يدوي' }).click()
  await page.getByRole('button', { name: 'تم' }).click()

  await expect(page.getByRole('button', { name: 'تشغيل' })).toBeDisabled()
  await page.keyboard.press('ArrowLeft') // next in an Arabic script
  await expect(page.getByText('الفقرة 2 من 4')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('الفقرة 1 من 4')).toBeVisible()
})

test('reading settings are saved to the account', async ({ page }) => {
  await signIn(page)
  await knobs(page, {})
  await page.goto('/app/scripts/s_letter/rehearse')
  await page.getByRole('button', { name: 'إعدادات القراءة' }).click()
  await page.getByRole('button', { name: 'زيادة كلمة في الدقيقة' }).click()
  await page.getByRole('switch', { name: 'انعكاس المرآة' }).click()
  await page.getByRole('button', { name: 'خيارات إضافية' }).click()
  await page.getByRole('radio', { name: 'بدون' }).click()
  await page.keyboard.press('Escape') // back to the main view
  await page.keyboard.press('Escape') // close
  await page.waitForTimeout(1200)

  await page.reload()
  await expect(page.getByRole('button', { name: '130 كلمة/د' })).toBeVisible()
  await page.getByRole('button', { name: 'إعدادات القراءة' }).click()
  await expect(page.getByRole('switch', { name: 'انعكاس المرآة' })).toHaveAttribute('aria-checked', 'true')
})

test('a failed position save opens recovery and lets the user pick a paragraph', async ({ page }) => {
  await signIn(page)
  await knobs(page, { failPositionSave: true })
  await page.goto('/app/scripts/s_opening/rehearse')
  await page.keyboard.press('ArrowLeft')

  await expect(page.getByText('تعذر حفظ موضع القراءة')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'اختيار فقرة' }).click()
  await expect(page.getByRole('heading', { name: 'اختر فقرة' })).toBeVisible()
  await page.getByRole('button', { name: /^3/ }).click()
  await expect(page.getByText('الفقرة 3 من 3')).toBeVisible()
})

test('stepping past the last paragraph shows the end state', async ({ page }) => {
  await signIn(page)
  await knobs(page, {})
  await page.goto('/app/scripts/s_letter/rehearse')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'الفقرة التالية' }).click()
  await expect(page.getByRole('heading', { name: 'انتهى النص' })).toBeVisible()
  await page.getByRole('button', { name: 'من البداية' }).click()
  await expect(page.getByText('الفقرة 1 من 3')).toBeVisible()
})
