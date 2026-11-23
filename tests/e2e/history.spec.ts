import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { knobs, setFreeLimit, signIn } from './r2'

// US5 (T050) — script history: open, preview without changing the editor, restore (quickstart scenario 7).

test('lists earlier versions, previews one, and restores it', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  await body.fill('النص الأول للتجربة.')
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ في حسابك' })).toBeVisible({ timeout: 5000 })

  await knobs(page, { clockOffsetMs: 11 * 60_000 })
  await page.reload()
  await body.fill('النص الثاني بعد عشر دقائق.')
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ في حسابك' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'السجل' }).click()
  const drawer = page.getByRole('dialog', { name: 'السجل' })
  await expect(drawer.getByText('تحفظ خطتك آخر 5 نسخ من كل نص.')).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('.history').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  await drawer.getByRole('button', { name: /تعديل/ }).first().click()
  await expect(page.getByText('معاينة نسخة سابقة')).toBeVisible()
  await expect(page.getByText('النص الأول للتجربة.').first()).toBeVisible()
  await expect(body).toHaveValue('النص الثاني بعد عشر دقائق.') // the editor is unchanged while previewing

  await page.getByRole('button', { name: 'استعادة هذه النسخة' }).click()
  await page.getByRole('dialog', { name: 'استعادة هذه النسخة؟' }).getByRole('button', { name: 'استعادة هذه النسخة' }).click()
  await expect(page.getByText('استُعيدت النسخة. النص السابق محفوظ في السجل.')).toBeVisible()
  await expect(body).toHaveValue('النص الأول للتجربة.')

  await page.getByRole('button', { name: 'السجل' }).click()
  await expect(page.getByRole('dialog', { name: 'السجل' }).getByText(/قبل الاستعادة/).first()).toBeVisible()
})

test('a read-only script can view history but not restore', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  await page.getByLabel('نص الحلقة').fill('نسخة قبل خفض الحد.')
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ في حسابك' })).toBeVisible({ timeout: 5000 })
  await knobs(page, { clockOffsetMs: 11 * 60_000 })
  await page.reload()
  await page.getByLabel('نص الحلقة').fill('نسخة ثانية.')
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ في حسابك' })).toBeVisible({ timeout: 5000 })

  await setFreeLimit(page, 'scripts.max_active', 0)
  await page.reload()
  await page.getByRole('button', { name: 'السجل' }).click()
  await page.getByRole('dialog', { name: 'السجل' }).getByRole('button', { name: /تعديل/ }).first().click()
  await expect(page.getByRole('button', { name: 'استعادة هذه النسخة' })).toBeDisabled()
  await expect(page.getByText('الاستعادة غير متاحة لأن هذا النص للقراءة فقط', { exact: false })).toBeVisible()
})
