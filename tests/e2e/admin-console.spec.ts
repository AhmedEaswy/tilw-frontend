import { expect, test } from '@playwright/test'
import { asAdmin, asLayan } from './admin'

// Feature 006 · US1 (frame and dashboard), US2 (people and actions), US3 (waitlist and invitations), US7 (audit).
// The console is desktop-first; the phone project runs only the access rules.

test('signed-out visitors go to sign-in; a non-admin goes to the library; old addresses forward', async ({ page }) => {
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/signin\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe('/admin/users')

  await asLayan(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/app\/scripts$/)
  await expect(page.getByRole('link', { name: 'لوحة الإدارة' })).toHaveCount(0)
})

test.describe('desktop console', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'The admin console is desktop-first (spec assumptions).'))

  test('dashboard: figures, period in the address, attention links, demo badge', async ({ page }) => {
    await asAdmin(page)
    await expect(page.getByRole('heading', { level: 1, name: 'لوحة المتابعة' })).toBeVisible()
    await expect(page.getByTestId('env-badge')).toHaveText('بيانات تجريبية')
    await expect(page.getByText('مشرفون 2')).toBeVisible()
    await expect(page.getByRole('link', { name: 'موقوفون 1' })).toBeVisible()
    await expect(page.getByRole('figure').getByRole('img')).toBeVisible()
    await page.getByRole('button', { name: '7 يومًا' }).click()
    await expect(page).toHaveURL(/\?days=7$/)
    await expect(page.getByText('آخر 7 يومًا')).toBeVisible()
    await page.getByRole('link', { name: /طلبات ترقية بانتظار الدفع/ }).click()
    await expect(page).toHaveURL(/\/admin\/subscriptions\?tab=requests&state=pending$/)
    await expect(page.getByRole('row').filter({ hasText: 'بانتظار الدفع' })).toHaveCount(3)
  })

  test('old /app/admin addresses forward into the console', async ({ page }) => {
    await asAdmin(page)
    await page.goto('/app/admin')
    await expect(page).toHaveURL(/\/admin\/waitlist$/)
    await page.goto('/app/admin/invitations')
    await expect(page).toHaveURL(/\/admin\/invitations$/)
  })

  test('users: top-bar search, filters in the address, load more', async ({ page }) => {
    await asAdmin(page, '/admin/users')
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(50)
    await page.getByRole('button', { name: 'تحميل المزيد' }).click()
    await expect(rows).toHaveCount(53)
    await expect(page.getByText('هذا كل شيء.')).toBeVisible()

    await page.locator('.adm-toolbar select').nth(1).selectOption('suspended')
    await expect(page).toHaveURL(/status=suspended/)
    await expect(rows).toHaveCount(1)

    await page.getByRole('searchbox', { name: 'ابحث عن شخص بالبريد أو الاسم' }).fill('layan')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/admin\/users\?q=layan$/)
    await expect(rows).toHaveCount(1)
    await rows.first().getByRole('link').click()
    await expect(page).toHaveURL(/\/admin\/users\/u_layan$/)
  })

  test('user detail: suspend with the typed email, then unsuspend; each is in the audit log', async ({ page }) => {
    await asAdmin(page, '/admin/users/u_layan')
    await expect(page.getByTestId('status')).toHaveText('نشط')
    await page.getByRole('button', { name: 'إيقاف', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('السبب (مطلوب)').fill('اختبار')
    const confirm = dialog.getByRole('button', { name: 'إيقاف', exact: true })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel(/للتأكيد/).fill('LAYAN@example.com ')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByTestId('status')).toHaveText('موقوف')
    await expect(page.getByText(/أوقفه admin@example.com/)).toBeVisible()

    await page.getByRole('button', { name: 'رفع الإيقاف' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'رفع الإيقاف' }).click()
    await expect(page.getByTestId('status')).toHaveText('نشط')

    await page.getByRole('link', { name: 'عرض السجل كاملًا ←' }).click()
    await expect(page).toHaveURL(/\/admin\/audit\?targetType=User&targetId=u_layan$/)
    await expect(page.getByRole('row').filter({ hasText: 'user.suspend' })).toHaveCount(1)
    await expect(page.getByRole('row').filter({ hasText: 'user.unsuspend' })).toHaveCount(1)
  })

  test('user detail: credits granted once on a double-click; the admin\'s own actions are disabled', async ({ page }) => {
    await asAdmin(page, '/admin/users/u_layan')
    const balance = page.getByTestId('balance')
    await expect(balance).not.toHaveText('')
    const before = Number(await balance.textContent())
    await page.getByRole('button', { name: 'منح رصيد' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('السبب (مطلوب)').fill('تعويض')
    await dialog.getByRole('button', { name: 'منح 50 رصيدًا' }).dblclick()
    await expect(balance).toHaveText(String(before + 50))
    await page.waitForTimeout(400)
    await expect(balance).toHaveText(String(before + 50))

    await page.goto('/admin/users/u_admin')
    await expect(page.getByRole('button', { name: 'إيقاف', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'جدولة الحذف' })).toBeDisabled()
    await expect(page.getByTestId('why')).toHaveText('هذا حسابك أنت: استخدم إعدادات حسابك.')
  })

  test('user detail: change the plan and schedule then cancel a deletion', async ({ page }) => {
    await asAdmin(page, '/admin/users/u_layan')
    await page.getByRole('button', { name: 'تغيير الخطة' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('ملاحظة (مطلوبة)').fill('دفع عبر واتساب')
    await dialog.getByRole('button', { name: 'تغيير الخطة' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(/تغيّرت الخطة إلى/)).toBeVisible()

    await page.getByRole('button', { name: 'جدولة الحذف' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('السبب (مطلوب)').fill('طلب الحذف')
    await dialog.getByLabel(/للتأكيد/).fill('layan@example.com')
    await dialog.getByRole('button', { name: 'جدولة الحذف' }).click()
    await expect(page.getByTestId('status')).toHaveText('حذف مجدول')
    await expect(page.getByText('جدوله مشرف: تسجيل الدخول لا يلغيه.')).toBeVisible()
    await page.getByRole('button', { name: 'إلغاء الحذف' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء الحذف' }).click()
    await expect(page.getByTestId('status')).toHaveText('نشط')
  })

  test('waitlist: filter, invite, remove; invitations: withdraw', async ({ page }) => {
    await asAdmin(page, '/admin/waitlist')
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(13)
    await expect(page.getByRole('row').filter({ hasText: 'لديه حساب' })).toHaveCount(1)
    await page.getByRole('button', { name: 'بلا دعوة' }).click()
    await expect(page).toHaveURL(/invited=false/)
    const waiting = await rows.count()
    await rows.first().getByRole('button', { name: 'دعوة', exact: true }).click()
    await expect(rows).toHaveCount(waiting - 1)
    await rows.first().getByRole('button', { name: 'إزالة' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'إزالة' }).click()
    await expect(rows).toHaveCount(waiting - 2)

    await page.getByRole('link', { name: 'الدعوات' }).click()
    const withdraw = page.getByRole('button', { name: 'سحب الدعوة' })
    await expect(withdraw.first()).toBeVisible()
    const n = await withdraw.count()
    await withdraw.first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'سحب الدعوة' }).click()
    await expect(withdraw).toHaveCount(n - 1)
  })
})
