import { expect, test, type Page } from '@playwright/test'
import { asAdmin } from './admin'
import { hydrated, knobs } from './r2'

// Feature 007 (backend 007-admin-insights): analytics, the user detail tabs, admins and per-section permissions,
// in mock mode. The console is desktop-first.

test.beforeEach(({ isMobile }) => test.skip(isMobile, 'The admin console is desktop-first (spec assumptions).'))

/** Signs in as the mock's second admin (users edit, money view, ai view, audit view; no plans, settings, admins). */
async function asOps(page: Page, next = '/admin') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`)
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill('ops@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(url => url.pathname === next.split('?')[0])
  await knobs(page, { latencyMs: 30 })
  await page.goto(next)
}

test('dashboard headlines open analytics; analytics follows the period in the address', async ({ page }) => {
  await asAdmin(page)
  const headlines = page.getByTestId('headlines')
  await expect(headlines.getByText('جلسات التدريب')).toBeVisible()
  await expect(headlines.getByText('بمفتاح خاص')).toBeVisible()
  await page.getByRole('button', { name: '90 يومًا' }).click()
  await page.getByTestId('hl-takes').click()
  await expect(page).toHaveURL(/\/admin\/analytics\?days=90$/)
  await expect(page.getByRole('heading', { level: 1, name: 'التحليلات' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'التحليلات' })).toHaveAttribute('aria-current', 'page')

  // Recordings by length: every range has a row; the hidden tables give screen readers the numbers.
  const lengths = page.getByTestId('an-recordings').getByRole('table', { name: 'حسب الطول' })
  await expect(lengths.getByRole('row')).toHaveCount(6)
  await expect(lengths.getByRole('rowheader', { name: 'أكثر من ٣٠ دقيقة' })).toBeVisible()
  await expect(page.getByTestId('recorded-share')).toHaveText(/^\d+%$/)
  await expect(page.getByTestId('an-keys').getByText('Anthropic')).toBeVisible()
  await expect(page.getByTestId('an-keys').getByText('OpenAI')).toBeVisible()
  const ai = page.getByTestId('an-ai')
  await expect(ai.getByRole('row').filter({ hasText: 'مفتاح خاص' })).not.toHaveCount(0)
  await expect(ai.getByRole('row').filter({ hasText: 'رصيد تلو' })).not.toHaveCount(0)

  await page.getByRole('button', { name: '7 يومًا' }).click()
  await expect(page).toHaveURL(/\/admin\/analytics\?days=7$/)
  await expect(page.getByText('آخر 7 يومًا')).toBeVisible()
})

test('user detail tabs: each tab in the address, loading its own list', async ({ page }) => {
  await asAdmin(page, '/admin/users/u_seed00')
  const tabs = page.getByTestId('user-tabs')
  await expect(tabs.getByRole('link', { name: 'نظرة عامة' })).toHaveAttribute('aria-current', 'page')

  await tabs.getByRole('link', { name: 'التسجيلات' }).click()
  await expect(page).toHaveURL(/\?tab=takes$/)
  await expect(page.getByTestId('tab-takes').locator('tbody tr')).not.toHaveCount(0)
  await expect(page.getByTestId('tab-takes').getByText('محفوظ').first()).toBeVisible()

  await tabs.getByRole('link', { name: 'النصوص' }).click()
  await expect(page).toHaveURL(/\?tab=scripts$/)
  await expect(page.getByTestId('tab-scripts').locator('tbody tr')).not.toHaveCount(0)

  await tabs.getByRole('link', { name: 'الاتصالات' }).click()
  await expect(page.getByTestId('tab-connections').getByText('مرتبط', { exact: true })).toBeVisible()
  await expect(page.getByTestId('phone-links').locator('tbody tr')).not.toHaveCount(0)

  await tabs.getByRole('link', { name: 'الإعدادات' }).click()
  await expect(page.getByTestId('tab-settings').getByText('للعرض فقط')).toBeVisible()
  await expect(page.getByTestId('tab-settings').getByText('120 كلمة في الدقيقة')).toBeVisible()

  await tabs.getByRole('link', { name: 'النشاط' }).click()
  await expect(page.getByTestId('tab-activity')).toBeVisible()

  // An own AI key shows its provider and last four only.
  await page.goto('/admin/users/u_seed02?tab=connections')
  await expect(page.getByTestId('own-key').getByText(/^…\w{4}$/)).toBeVisible()
  await expect(page.getByTestId('own-key').getByText('OpenAI')).toBeVisible()
})

test('admins: super admin locked; add with people search, edit permissions, remove', async ({ page }) => {
  await asAdmin(page, '/admin/admins')
  const superRow = page.getByTestId('admin-row-u_admin')
  await expect(superRow.getByText('المشرف الأعلى')).toBeVisible()
  await expect(superRow.getByTestId('locked')).toBeVisible()
  await expect(superRow.getByTestId('edit-admin')).toBeDisabled()
  await expect(superRow.getByTestId('remove-admin')).toBeDisabled()

  await page.getByTestId('add-admin').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').fill('layan')
  await dialog.getByRole('option', { name: /ليان سالم/ }).click()
  await dialog.getByTestId('perm-money-edit').check()
  await dialog.getByTestId('perms-save').click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const row = page.getByTestId('admin-row-u_layan')
  await expect(row.getByText('المال · تعديل')).toBeVisible()
  await expect(row.getByText('الأشخاص · عرض')).toBeVisible()

  await row.getByTestId('edit-admin').click()
  await page.getByRole('dialog').getByTestId('perm-money-none').check()
  await page.getByRole('dialog').getByTestId('perm-settings-view').check()
  await page.getByRole('dialog').getByTestId('perms-save').click()
  await expect(row.getByText('الإعدادات · عرض')).toBeVisible()
  await expect(row.getByText(/^المال/)).toHaveCount(0)

  await row.getByTestId('remove-admin').click()
  await page.getByRole('dialog').getByRole('button', { name: 'إزالة المشرف' }).click()
  await expect(page.getByTestId('admin-row-u_layan')).toHaveCount(0)

  await page.goto('/admin/audit')
  await expect(page.getByRole('row').filter({ hasText: 'user.admin_permissions' })).toHaveCount(1)
})

test('a limited admin: hidden sections, read-only views, and a 403 explained', async ({ page }) => {
  await asOps(page, '/admin')
  const nav = page.getByRole('navigation', { name: 'لوحة الإدارة' })
  await expect(nav.getByRole('link', { name: 'التحليلات' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'الإعدادات' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'المشرفون' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'الخطط والحدود' })).toHaveCount(0)

  await page.goto('/admin/admins')
  await expect(page.getByTestId('admins-forbidden')).toBeVisible()
  await page.goto('/admin/settings')
  await expect(page.getByText('ليست لديك صلاحية لهذا الجزء من لوحة الإدارة. اطلبها من المشرف الأعلى.')).toBeVisible()

  // money: view, ai: view → no plan change or credits; users: edit → suspend stays.
  await page.goto('/admin/users/u_layan')
  await expect(page.getByTestId('status')).toBeVisible()
  await expect(page.getByRole('button', { name: 'تغيير الخطة' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'منح رصيد' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'إيقاف', exact: true })).toBeVisible()

  // The super admin's account is locked for everyone else.
  await page.goto('/admin/users/u_admin')
  await expect(page.getByTestId('super-chip')).toBeVisible()
  await expect(page.getByRole('button', { name: 'إيقاف', exact: true })).toBeDisabled()
  await expect(page.getByTestId('why')).toHaveText('هذا هو المشرف الأعلى: لا يمكن لأحد تغيير حسابه.')
})
