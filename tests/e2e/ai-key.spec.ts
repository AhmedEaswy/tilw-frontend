import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { aiKnobs, mockState, signIn } from './r2'

// Feature 005 US4 (T023): the own text key, masked, used for formatting without credits (quickstart 5).

const KEY = 'sk-ant-api03-e2e-secret-value-1a2b'

async function saveKey(page: Page) {
  await page.goto('/app/settings/ai')
  const card = page.getByTestId('own-key')
  await card.getByLabel('المفتاح').fill(KEY)
  await card.getByTestId('own-key-save').click()
  await expect(card.getByTestId('own-key-masked')).toBeVisible()
  return card
}

test('saves a key masked, never keeps it, and formats on it without credits', async ({ page }) => {
  await signIn(page)
  const card = await saveKey(page)
  await expect(card.getByTestId('own-key-masked')).toHaveText('Anthropic · ••••1a2b')
  await expect(card.getByText('يعمل')).toBeVisible()
  await expect(card.getByLabel('المفتاح')).toHaveCount(0)
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  expect(stored).not.toContain('e2e-secret-value')
  expect(await page.content()).not.toContain('e2e-secret-value')
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="own-key"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  await page.goto('/app/scripts/s_opening')
  await expect(page.locator('#format-hint')).toHaveText('بمفتاحك الخاص · بلا رصيد')
  await page.getByTestId('tools-format').click()
  await expect(page.getByTestId('format-go')).toHaveText('تنسيق بمفتاحي')
  await page.getByTestId('format-go').click()
  await expect(page.getByText('بمفتاحك الخاص · لم يُخصم رصيد')).toBeVisible()

  await page.goto('/app/settings/ai')
  await expect(page.getByTestId('credits-balance')).toHaveText('20 رصيد')
  await expect(page.getByTestId('credit-entries').getByRole('listitem').first()).toContainText('بمفتاحك الخاص · تنسيق نص')
})

test('a refused key asks before using credits, and a refused key is not saved', async ({ page }) => {
  await signIn(page)
  await saveKey(page)
  await aiKnobs(page, { keyRefused: true })
  await page.goto('/app/scripts/s_opening')
  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-go').click()
  await expect(page.getByTestId('format-error')).toContainText('رفض المزوّد مفتاحك')
  await expect(page.getByTestId('format-error')).toContainText('لم يُخصم أي رصيد')
  await page.getByRole('button', { name: 'استخدم رصيد Tilw هذه المرة · 1 رصيد' }).click()
  await expect(page.getByText('خُصم 1 رصيد · رصيدك 19')).toBeVisible()

  await page.goto('/app/settings/ai')
  const card = page.getByTestId('own-key')
  await expect(card.getByText('رفضه المزوّد')).toBeVisible()
  await card.getByRole('button', { name: 'استبدال' }).click()
  await card.getByLabel('المفتاح').fill('sk-ant-api03-another-key-value-9z9z')
  await card.getByTestId('own-key-save').click()
  await expect(card.getByTestId('own-key-error')).toContainText('رفض المزوّد مفتاحك')
  await expect(card.getByLabel('المفتاح')).toHaveValue('')
})

test('deletes the key after confirming, and locks the card on a plan without own keys', async ({ page }) => {
  await signIn(page)
  const card = await saveKey(page)
  await card.getByRole('button', { name: 'حذف' }).click()
  await page.getByRole('dialog', { name: 'حذف مفتاحك؟' }).getByRole('button', { name: 'حذف' }).click()
  await expect(page.getByText('حُذف مفتاحك.')).toBeVisible()
  await expect(card.getByLabel('المفتاح')).toBeVisible()

  await mockState(page, `s.overrides.u_layan = { ...(s.overrides.u_layan || {}), 'byok.allowed': false }`)
  await expect(page.getByTestId('own-key')).toContainText('خطتك الحالية لا تسمح بالمفاتيح الخاصة.')
  await expect(page.getByTestId('own-key').getByLabel('المفتاح')).toHaveCount(0)
})
