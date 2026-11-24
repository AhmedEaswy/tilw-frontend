import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { aiKnobs, signIn } from './r2'

// Feature 005 US2 (T018): credits, what used them, the negative balance, and the plan rows (quickstart 2).

test('shows the balance, the month entries after a format and a refund, and the Settings and plan rows', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/settings')
  await expect(page.getByTestId('settings-ai')).toContainText('رصيدك: 20')
  await page.getByTestId('settings-ai').click()
  await expect(page).toHaveURL(/\/app\/settings\/ai$/)
  await expect(page.getByTestId('credits-balance')).toHaveText('20 رصيد')
  await expect(page.getByTestId('credit-entries')).toContainText('رصيد الشهر')
  const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  // One format, then one that the formatter refuses (refunded).
  await page.goto('/app/scripts/s_opening')
  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-go').click()
  await expect(page.getByTestId('format-preview')).toBeVisible()
  await aiKnobs(page, { format: 'changed_words' })
  await page.goto('/app/scripts/s_letter')
  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-go').click()
  await expect(page.getByTestId('format-error')).toBeVisible()

  await page.goto('/app/settings/ai')
  await expect(page.getByTestId('credits-balance')).toHaveText('19 رصيد')
  const entries = page.getByTestId('credit-entries').getByRole('listitem')
  await expect(entries).toHaveCount(4)
  await expect(entries.nth(0)).toContainText('إعادة رصيد · تنسيق نص')
  await expect(entries.nth(0)).toContainText('+1')
  await expect(entries.nth(0)).toContainText('عن خصم')
  await expect(entries.nth(1)).toContainText('فشل')
  await expect(entries.nth(2)).toContainText('تنسيق نص')
  await expect(entries.nth(2)).toContainText('-1')
  await expect(entries.nth(3)).toContainText('+20')

  await page.goto('/app/settings/plan')
  await expect(page.getByText('رصيد الذكاء الاصطناعي الشهري')).toBeVisible()
  await expect(page.getByText('20 شهرياً')).toBeVisible()
  await expect(page.getByText('قريباً')).toHaveCount(0)
})

test('explains a negative balance and pauses credit-paid formatting', async ({ page }) => {
  await signIn(page)
  await aiKnobs(page, {}, -4)
  await page.goto('/app/settings/ai')
  await expect(page.getByTestId('credits-balance')).toHaveText('-4 رصيد')
  await expect(page.getByTestId('credits-negative')).toContainText('رصيدك سالب: -4')
  await page.goto('/app/scripts/s_opening')
  await page.getByTestId('tools-format').click()
  await expect(page.getByTestId('format-short')).toContainText('رصيدك سالب: -4')
  await expect(page.getByTestId('format-go')).toBeDisabled()
})
