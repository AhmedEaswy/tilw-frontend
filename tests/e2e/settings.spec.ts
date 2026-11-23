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
  await expect(page).toHaveURL(/\/signin/) // signed out before signing in again
  await signIn(page, 'newpassword1')
})

test('deleting schedules the account for 14 days; signing in cancels it (release 2)', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/delete')
  await expect(page.getByText(/يبقى: التسجيلات/)).toBeVisible()
  await page.getByLabel('أكد كلمة المرور').fill('password123')
  await page.getByRole('button', { name: 'حذف الحساب', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'سيُحذف حسابك بعد 14 يوماً' })).toBeVisible()
  await expect(page.getByText('سجّل الدخول قبل هذا التاريخ ويُلغى الحذف', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'إلى الصفحة الرئيسية' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app/scripts')
  await expect(page).toHaveURL(/\/signin/)

  await signIn(page)
  await expect(page.getByText('أُلغي حذف حسابك. أهلاً بعودتك.')).toBeVisible()
})

test('changes the email through a confirmation link (release 2)', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/account')
  await page.getByRole('button', { name: 'تغيير البريد' }).click()
  await page.getByLabel('البريد الجديد').fill('layan.new@example.com')
  await page.getByLabel('كلمة المرور الحالية').first().fill('password123')
  await page.getByRole('button', { name: 'إرسال رابط التأكيد' }).click()
  await expect(page.getByText('بانتظار التأكيد على')).toBeVisible()
  await expect(page.getByText('layan.new@example.com').first()).toBeVisible()

  const link = await page.evaluate(() => JSON.parse(localStorage.getItem('tilw:mock:v1')!).outbox.find((m: { kind: string }) => m.kind === 'email').link as string)
  await page.goto(new URL(link).pathname + new URL(link).search)
  await expect(page.getByRole('heading', { name: 'تأكد بريدك الجديد' })).toBeVisible()
  await page.goto(new URL(link).pathname + new URL(link).search)
  await expect(page.getByRole('heading', { name: 'هذا الرابط لا يعمل' })).toBeVisible()
})

test('lists devices and signs a phone out (release 2)', async ({ page }) => {
  await signIn(page)
  await page.goto('/privacy') // no service calls here, so the app can't overwrite the edit below
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tilw:mock:v1')!)
    const at = new Date().toISOString()
    s.devices.u_layan = [...(s.devices.u_layan ?? []), { id: 'dev_e2e', name: 'iPhone 15', platform: 'ios', createdAt: at, lastUsedAt: at, current: false }]
    localStorage.setItem('tilw:mock:v1', JSON.stringify(s))
  })
  await page.goto('/app/settings/account')
  await expect(page.getByText('هذا المتصفح')).toBeVisible()
  await expect(page.getByText('iPhone 15')).toBeVisible()
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await page.getByRole('dialog', { name: 'تسجيل الخروج من iPhone 15؟' }).getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(page.getByText('سُجّل الخروج من iPhone 15.')).toBeVisible()
  await expect(page.locator('.dev')).toHaveCount(1)
})
