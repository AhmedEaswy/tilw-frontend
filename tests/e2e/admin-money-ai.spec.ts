import { expect, test } from '@playwright/test'
import { asAdmin } from './admin'

// Feature 006 · US4 (plans, subscriptions, requests, payments) and US5 (AI usage, calls, ledger).

test.beforeEach(({ isMobile }) => test.skip(isMobile, 'The admin console is desktop-first (spec assumptions).'))

test('plans: a price change is saved and reaches the public catalogue; a limit goes back to its default', async ({ page }) => {
  await asAdmin(page, '/admin/plans')
  const monthly = page.getByLabel('شهريًا (دولار) pro')
  await monthly.fill('9.50')
  await page.getByRole('region', { name: 'pro' }).getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByRole('region', { name: 'pro' }).getByText('$9.50 / $77')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('شهريًا (دولار) pro')).toHaveValue('9.50')
  await expect(page.getByRole('checkbox', { name: /مفعّلة/ }).first()).toBeDisabled()

  await page.getByRole('button', { name: 'مدة المحاولة (دقائق) · pro: 60' }).click()
  await page.getByRole('dialog').getByRole('spinbutton').fill('90')
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByRole('button', { name: 'مدة المحاولة (دقائق) · pro: 90' })).toBeVisible()
  await page.getByRole('button', { name: 'مدة المحاولة (دقائق) · pro: 90' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'استخدم الافتراضي' }).click()
  await expect(page.getByRole('button', { name: 'مدة المحاولة (دقائق) · pro: غير محدود' })).toBeVisible()
})

test('requests: mark one paid; it appears under payments with the total for the range', async ({ page }) => {
  await asAdmin(page, '/admin/payments')
  const count = page.getByText('عدد المدفوعات').locator('..').locator('strong')
  await expect(count).not.toHaveText('')
  const before = Number(await count.textContent())

  await page.goto('/admin/subscriptions?tab=requests&state=pending')
  const rows = page.getByRole('row').filter({ hasText: 'بانتظار الدفع' })
  await expect(rows).toHaveCount(3)
  await rows.first().getByRole('button', { name: 'تم الدفع' }).click()
  await page.getByRole('dialog').getByLabel('ملاحظة (مطلوبة)').fill('تحويل بنكي')
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الدفع وبدء الاشتراك' }).click()
  await expect(rows).toHaveCount(2)

  await page.goto('/admin/payments')
  await expect(count).toHaveText(String(before + 1))
})

test('subscriptions: filter by state and end one early', async ({ page }) => {
  await asAdmin(page, '/admin/subscriptions')
  await page.getByRole('combobox', { name: 'الحالة' }).click()
  await page.getByRole('option', { name: 'سارٍ' }).click()
  await expect(page).toHaveURL(/state=active/)
  const ends = page.getByRole('button', { name: 'إنهاء الآن' })
  const n = await ends.count()
  expect(n).toBeGreaterThan(0)
  await ends.first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'إنهاء الآن' }).click()
  await expect(ends).toHaveCount(n - 1)
})

test('AI: usage by provider and by day, failures, the ledger and a grant from it', async ({ page }) => {
  await asAdmin(page, '/admin/ai/usage')
  await expect(page.getByRole('row').filter({ hasText: 'anthropic' })).toBeVisible()
  await page.getByRole('button', { name: 'حسب اليوم' }).click()
  await expect(page).toHaveURL(/groupBy=day/)
  await expect(page.getByRole('figure').getByRole('img', { name: 'الرصيد يومًا بيوم' })).toBeVisible()

  await page.goto('/admin/ai/calls')
  await page.getByRole('button', { name: 'الفاشلة' }).click()
  await expect(page).toHaveURL(/status=failed/)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  expect(await rows.filter({ hasNotText: 'فشل' }).count()).toBe(0)

  await page.goto('/admin/ai/ledger')
  await expect(page.getByRole('row').filter({ hasText: 'admin@example.com' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'منح رصيد' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').fill('layan')
  await dialog.getByRole('option').first().click()
  await dialog.getByRole('button', { name: 'التالي' }).click()
  const grant = page.getByRole('dialog').filter({ hasText: 'رصيد ليان سالم' })
  await grant.getByLabel('السبب (مطلوب)').fill('من السجل')
  await grant.getByRole('button', { name: 'منح 50 رصيدًا' }).click()
  await expect(page.locator('tbody tr').first()).toContainText('ليان سالم')
  await expect(page.locator('tbody tr').first()).toContainText('+50')
})
