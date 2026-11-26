import { expect, test } from '@playwright/test'
import { hydrated } from './r2'
import { adminState, asAdmin, asLayan, signOutMock } from './admin'

// Feature 006 · US6 (sign-up mode, platform keys, flags, public sign-up) and US8 (suspended accounts).

test('invite-only: /signup explains and points to the waitlist; the landing keeps the waitlist form', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByTestId('signup-closed')).toBeVisible()
  await expect(page.getByRole('link', { name: 'انضم لقائمة الانتظار' })).toBeVisible()
  await page.goto('/')
  await hydrated(page)
  await expect(page.locator('#jn-form')).toBeVisible()
  await expect(page.getByTestId('join-open')).toHaveCount(0)
})

test('open sign-up: the landing offers Create account, /signup creates the account and opens the studio', async ({ page }) => {
  await page.goto('/privacy')
  await adminState(page, 's.signupMode = "open"')
  await page.goto('/')
  await hydrated(page)
  await expect(page.getByTestId('join-open')).toBeVisible()
  await expect(page.locator('#jn-form')).toBeHidden()

  await page.goto('/signup')
  await hydrated(page)
  await page.getByLabel('الاسم').fill('ندى')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page.getByText('لهذا البريد حساب بالفعل. سجّل الدخول.')).toBeVisible()
  await page.getByLabel('البريد الإلكتروني').fill('nada.new@example.com')
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
})

test('a suspended person is signed out at the next call and told why; sign-in says the same', async ({ page }) => {
  await asLayan(page)
  await adminState(page, 's.suspensions = { ...(s.suspensions || {}), u_layan: { at: Date.now(), reason: "e2e", byId: "u_admin" } }')
  await page.goto('/app/scripts')
  await expect(page).toHaveURL(/\/signin\?suspended=1$/)
  await expect(page.getByText('هذا الحساب موقوف.')).toBeVisible()
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page.getByText('هذا الحساب موقوف.')).toBeVisible()
  await expect(page).toHaveURL(/\/signin/)
})

test.describe('desktop settings', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'The admin console is desktop-first (spec assumptions).'))

  test('sign-up mode switch with confirmation, then sign-up works', async ({ page }) => {
    await asAdmin(page, '/admin/settings')
    await expect(page.getByTestId('signup-mode')).toHaveText('بالدعوة فقط')
    const toggle = page.getByRole('switch', { name: 'فتح التسجيل للجميع' })
    await expect(toggle).not.toBeChecked()
    // Cancelling the confirmation leaves the switch off.
    await toggle.check()
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click()
    await expect(toggle).not.toBeChecked()
    await toggle.check()
    await page.getByRole('dialog').getByRole('button', { name: 'فتح التسجيل' }).click()
    await expect(toggle).toBeChecked()
    await expect(page.getByTestId('signup-mode')).toHaveText('مفتوح للجميع')
    await signOutMock(page)
    await page.goto('/signin')
    await expect(page.getByRole('link', { name: 'أنشئ حسابًا' })).toBeVisible()
  })

  test('a platform key is sent once and never shown or kept (SC-004); flags add and remove', async ({ page }) => {
    const secret = 'sk-ant-e2e-secret-9999wxyz'
    await asAdmin(page, '/admin/settings')
    const row = page.getByTestId('key-anthropic')
    await row.getByRole('button', { name: 'إضافة مفتاح' }).click()
    await row.getByLabel('مفتاح جديد').fill(secret)
    await row.getByRole('button', { name: 'حفظ' }).click()
    await expect(row.getByText('…wxyz')).toBeVisible()
    // Admin strings come from their own file, loaded before the page renders: no raw keys anywhere.
    expect(await page.locator('body').innerText()).not.toMatch(/admin\.[a-z]+\./)
    await expect(row.getByText('محفوظ', { exact: true })).toBeVisible()
    expect(await page.content()).not.toContain(secret)
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(secret)
    expect(page.url()).not.toContain(secret)

    await page.getByLabel('المفتاح', { exact: true }).fill('ai.captions')
    await page.getByRole('button', { name: 'إضافة', exact: true }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ai.captions' })).toBeVisible()
    await page.getByRole('button', { name: 'حذف ai.captions' }).click()
    // Removing a flag asks first (review fix); nothing changes until it is confirmed.
    await expect(page.getByRole('dialog')).toContainText('حذف المفتاح ai.captions؟')
    await expect(page.getByRole('listitem').filter({ hasText: 'ai.captions' })).toHaveCount(1)
    await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ai.captions' })).toHaveCount(0)
  })

  test('credit formatting moves to a provider only once its key is stored, after a confirmation', async ({ page }) => {
    await asAdmin(page, '/admin/settings')
    const select = page.getByTestId('format-provider').getByRole('combobox')
    await expect(select).toContainText('Anthropic')
    await select.click()
    await expect(page.getByRole('option', { name: 'DeepSeek' })).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')

    const row = page.getByTestId('key-deepseek')
    await row.getByRole('button', { name: 'إضافة مفتاح' }).click()
    await row.getByLabel('مفتاح جديد').fill('sk-ds-e2e-secret-4321')
    await row.getByRole('button', { name: 'حفظ' }).click()
    await expect(row.getByText('…4321')).toBeVisible()

    await select.click()
    await page.getByRole('option', { name: 'DeepSeek' }).click()
    await expect(page.getByRole('dialog')).toContainText('DeepSeek')
    await page.getByRole('dialog').getByRole('button', { name: 'استخدام DeepSeek' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(select).toContainText('DeepSeek')

    await row.getByRole('button', { name: 'حذف المفتاح المحفوظ' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'حذف المفتاح المحفوظ' }).click()
    await expect(page.getByText('اختر مزوّدًا آخر قبل حذف مفتاحه.')).toBeVisible()
    await expect(row.getByText('…4321')).toBeVisible()
  })

  test('the account menu switches appearance and language, and links to the website', async ({ page }) => {
    await asAdmin(page, '/admin/payments')
    const button = page.getByRole('button', { name: 'قائمة الحساب' })
    await button.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'قائمة الحساب' })
    await expect(menu.getByRole('menuitem', { name: 'الإعدادات' })).toBeFocused()
    await expect(menu.getByRole('menuitem', { name: /فتح الموقع/ })).toHaveAttribute('target', '_blank')
    await menu.getByRole('menuitemradio', { name: 'داكن' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(menu.getByRole('menuitemradio', { name: 'داكن' })).toHaveAttribute('aria-checked', 'true')
    await menu.getByRole('menuitemradio', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payments')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeFocused()
  })

  test('the console is usable by keyboard: search, open a person, a dialog traps and Esc closes it', async ({ page }) => {
    await asAdmin(page, '/admin')
    await page.getByRole('searchbox', { name: 'ابحث عن شخص بالبريد أو الاسم' }).focus()
    await page.keyboard.type('layan')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/admin\/users\?q=layan$/)
    const link = page.locator('tbody tr').first().getByRole('link')
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/admin\/users\/u_layan$/)
    const suspend = page.getByRole('button', { name: 'إيقاف', exact: true })
    await suspend.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(suspend).toBeFocused()
  })
})
