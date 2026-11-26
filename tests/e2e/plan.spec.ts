import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockState, setFreeLimit, signIn } from './r2'

// US1 (T013) — Plan & usage, the limit-reached dialog and read-only scripts (quickstart scenarios 1–2).

test('Plan & usage shows the plan, meters with a warning at 80 %, and hides unknown limits', async ({ page }) => {
  await signIn(page)
  await setFreeLimit(page, 'scripts.max_active', 3)
  await mockState(page, `s.limitDefinitions.push({ key: 'teleport.max', type: 'int', default: 1, counted: false, label: { ar: 'انتقال', en: 'Teleport' } })`)
  await page.goto('/app/settings/plan')
  await expect(page.getByRole('heading', { name: 'الخطة والاستخدام' })).toBeVisible()
  await expect(page.getByText('المجانية', { exact: true })).toBeVisible()
  const active = page.getByRole('meter', { name: 'النصوص النشطة' })
  await expect(active).toHaveAttribute('aria-valuetext', '3 من 3')
  await expect(page.locator('.meter-row.warn')).toHaveCount(1)
  await expect(page.getByText('انتقال')).toHaveCount(0)
  await expect(page.getByText('رصيد الذكاء الاصطناعي الشهري')).toBeVisible() // greyed until feature 004
})

test('a new script at the limit opens the limit dialog with Archive and Upgrade', async ({ page }) => {
  await signIn(page)
  await setFreeLimit(page, 'scripts.max_active', 3)
  await page.goto('/app/scripts')
  await expect(page.getByText('3 من 3 نصاً نشطاً')).toBeVisible()
  await page.getByRole('button', { name: 'نص جديد' }).first().click()
  await page.getByRole('menuitem', { name: 'إنشاء نص' }).click()
  await page.getByLabel('عنوان النص').fill('نص رابع')
  await page.getByRole('button', { name: 'فتح المحرر' }).click()
  const dialog = page.getByRole('dialog', { name: 'وصلت إلى حد النصوص النشطة' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('تسمح خطتك بـ3 نصاً نشطاً، ولديك 3.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'أرشفة نص' })).toBeVisible()
  await dialog.getByRole('button', { name: 'الترقية إلى Pro' }).click()
  await expect(page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })).toBeVisible()
})

test('a lowered limit makes older scripts read-only; rehearse and record stay open', async ({ page }) => {
  await signIn(page)
  await setFreeLimit(page, 'scripts.max_active', 1)
  await page.goto('/app/scripts/s_letter')
  await expect(page.getByText('هذا النص للقراءة فقط')).toBeVisible()
  await expect(page.getByRole('status').getByText('للقراءة فقط', { exact: true })).toBeVisible()
  await expect(page.getByLabel('نص الحلقة')).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: 'تراجع' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'السجل' })).toBeEnabled()
  await page.getByRole('link', { name: 'تدرب', exact: true }).first().click()
  await expect(page).toHaveURL(/\/rehearse$/)
})

test('axe: Plan & usage has no WCAG 2.2 AA violations', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings/plan')
  await expect(page.getByRole('heading', { name: 'الخطة والاستخدام' })).toBeVisible()
  await expect(page.getByRole('meter').first()).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])
})
