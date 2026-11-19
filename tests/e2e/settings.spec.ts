import { expect, test, type Page } from '@playwright/test'

// US8 (T090–T095) — preferences, export, legacy recovery, account edit and delete.

test.use({ acceptDownloads: true })

async function signIn(page: Page, password = 'password123') {
  await page.goto('/signin')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
  await page.evaluate(() => localStorage.setItem('tilw:mock:knobs', JSON.stringify({ latencyMs: 50 })))
}

test('appearance and reading settings save to the account', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings')
  await page.getByRole('radio', { name: 'داكن' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('button', { name: /إعدادات القراءة/ }).click()
  await page.getByRole('button', { name: 'زيادة كلمة في الدقيقة' }).click()
  await page.getByRole('button', { name: 'تم' }).click()
  await page.goto('/app/scripts/s_opening/rehearse')
  await expect(page.getByRole('button', { name: '130 كلمة/د' })).toBeVisible()
})

test('exports the account only after the password is confirmed', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/export')
  await page.getByLabel('أكد كلمة المرور').fill('wrong-pass')
  await page.getByRole('button', { name: 'تنزيل النسخة' }).click()
  await expect(page.getByText('كلمة المرور غير صحيحة')).toBeVisible()

  await page.getByLabel('أكد كلمة المرور').fill('password123')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'تنزيل النسخة' }).click()
  expect((await download).suggestedFilename()).toBe('tilw-account-v1.json')
  await expect(page.getByRole('heading', { name: 'أُرسل طلب التنزيل' })).toBeVisible()
})

test('recovers a legacy script after consent', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/recover')
  await page.getByRole('button', { name: 'عرض النصوص' }).click()
  await page.getByRole('button', { name: 'اختيار' }).first().click()
  await expect(page.getByRole('heading', { name: 'إضافة النص إلى حسابك؟' })).toBeVisible()
  await page.getByRole('button', { name: 'إضافة النسخة' }).click()
  await expect(page.getByText('أُضيف').first()).toBeVisible()
  await page.goto('/app/scripts')
  await expect(page.getByText('الافتتاحية الأولى')).toBeVisible()
})

test('changes the password and signs in with the new one', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/account')
  await page.getByLabel('كلمة المرور الحالية').fill('password123')
  await page.getByLabel('كلمة المرور الجديدة').fill('newpassword1')
  await page.getByLabel('أكد كلمة المرور').fill('newpassword1')
  await page.getByRole('button', { name: 'تغيير كلمة المرور' }).click()
  await expect(page.getByText('تغيّرت كلمة المرور.')).toBeVisible()

  await page.goto('/app/settings')
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await signIn(page, 'newpassword1')
})

test('deletes the account and signs out', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/delete')
  await expect(page.getByText(/يبقى: التسجيلات/)).toBeVisible()
  await page.getByLabel('أكد كلمة المرور').fill('password123')
  await page.getByRole('button', { name: 'حذف الحساب نهائياً' }).click()
  await expect(page.getByRole('heading', { name: 'حُذف حسابك' })).toBeVisible()
  await page.getByRole('button', { name: 'إلى الصفحة الرئيسية' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app/scripts')
  await expect(page).toHaveURL(/\/signin/)
})
