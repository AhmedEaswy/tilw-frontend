import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { aiKnobs, mockState, setFreeLimit, signIn } from './r2'

// Feature 005 US1 (T014): format for reading, from the cost line to apply or discard (quickstart 1).

const words = (s: string) => s.split(/\s+/).filter(Boolean).join(' ')

async function openDrawer(page: Page, id = 's_opening') {
  await page.goto(`/app/scripts/${id}`)
  await page.getByTestId('tools-format').click()
  const drawer = page.getByTestId('format-drawer')
  await expect(drawer).toBeVisible()
  return drawer
}

test('shows the cost first, formats with the same words, and applies with an AI version in History', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening')
  const body = page.getByLabel('نص الحلقة')
  const before = await body.inputValue()
  await expect(page.getByTestId('tools-format')).toBeVisible()
  await expect(page.locator('#format-hint')).toHaveText('1 رصيد · رصيدك 20')

  await page.getByTestId('tools-format').click()
  const drawer = page.getByTestId('format-drawer')
  await expect(drawer.getByTestId('format-cost')).toContainText('1 رصيد')
  await expect(drawer.getByTestId('format-balance')).toHaveText('رصيدك الآن: 20')
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="format-drawer"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  await drawer.getByTestId('format-go').click()
  const preview = drawer.getByTestId('format-preview')
  await expect(preview).toBeVisible()
  await expect(drawer.getByText('خُصم 1 رصيد · رصيدك 19')).toBeVisible()
  const previewWords = await preview.evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement
    c.querySelectorAll('.chip').forEach(x => x.remove())
    return [...c.querySelectorAll('p')].map(x => x.textContent ?? '').join(' ')
  })
  expect(words(previewWords)).toBe(words(before))
  await expect(body).toHaveValue(before) // nothing changes until Apply

  await drawer.getByTestId('format-apply').click()
  await expect(page.getByText('طُبّق التنسيق. النص السابق في السجل.')).toBeVisible()
  const after = await body.inputValue()
  expect(after).not.toBe(before)
  expect(words(after)).toBe(words(before))

  await page.getByRole('button', { name: 'السجل' }).click()
  await expect(page.getByRole('dialog', { name: 'السجل' }).getByText(/تعديل بالذكاء الاصطناعي/).first()).toBeVisible()
})

test('discards a suggestion and keeps the script; a waiting suggestion opens again later', async ({ page }) => {
  await signIn(page)
  const drawer = await openDrawer(page, 's_letter')
  const before = await page.getByLabel('نص الحلقة').inputValue()
  await drawer.getByTestId('format-go').click()
  await expect(drawer.getByTestId('format-preview')).toBeVisible()
  await drawer.getByRole('button', { name: 'إغلاق' }).click()

  await page.reload()
  await expect(page.locator('#format-hint')).toHaveText('اقتراح بانتظارك')
  await page.getByTestId('tools-format').click()
  await expect(page.getByTestId('format-preview')).toBeVisible()
  await page.getByTestId('format-discard').click()
  await expect(page.getByText('تُجوهل الاقتراح ولم يتغير نصك. يبقى الرصيد مخصوماً.')).toBeVisible()
  await expect(page.getByLabel('نص الحلقة')).toHaveValue(before)
})

test('says the formatter changed words and refunds; says AI is unavailable with the wait', async ({ page }) => {
  await signIn(page)
  await aiKnobs(page, { format: 'changed_words' })
  const drawer = await openDrawer(page)
  await drawer.getByTestId('format-go').click()
  await expect(drawer.getByTestId('format-error')).toContainText('حاول المنسّق تغيير كلماتك فأوقفناه')
  await expect(drawer.getByTestId('format-error')).toContainText('أُعيد إليك الرصيد')
  await aiKnobs(page, { format: 'unavailable' })
  await drawer.getByRole('button', { name: 'إعادة المحاولة' }).click()
  await expect(drawer.getByTestId('format-balance')).toHaveText('رصيدك الآن: 20')
  await drawer.getByTestId('format-go').click()
  await expect(drawer.getByTestId('format-error')).toContainText('حاول مرة أخرى بعد 30 ثانية')
})

test('offers Format again when the script changed since the suggestion', async ({ page }) => {
  await signIn(page)
  const drawer = await openDrawer(page)
  await drawer.getByTestId('format-go').click()
  await expect(drawer.getByTestId('format-preview')).toBeVisible()
  // An edit from another device.
  await mockState(page, `const sc = s.scripts.u_layan.find(x => x.id === 's_opening'); sc.body += ' (من جهاز آخر)'; sc.version += 1`)
  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-apply').click()
  await expect(page.getByTestId('format-error')).toContainText('تغيّر النص منذ صنع الاقتراح')
  await page.getByRole('button', { name: 'نسّق من جديد' }).click()
  await expect(page.getByTestId('format-go')).toBeEnabled()
})

test('disables Format when the balance is short, and for an empty script', async ({ page }) => {
  await signIn(page)
  await aiKnobs(page, {}, 0)
  const drawer = await openDrawer(page)
  await expect(drawer.getByTestId('format-short')).toContainText('رصيدك لا يكفي')
  await expect(drawer.getByTestId('format-go')).toBeDisabled()
  await aiKnobs(page, {}, 20)
  await page.goto('/app/scripts')
  await page.getByRole('button', { name: 'نص جديد' }).first().click()
  await page.getByRole('menuitem', { name: 'إنشاء نص' }).click()
  await page.getByLabel('عنوان النص').fill('نص فارغ')
  await page.getByRole('button', { name: 'فتح المحرر' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_/)
  await page.getByTestId('tools-format').click()
  await expect(page.getByTestId('format-drawer').getByText('اكتب شيئاً أولاً.')).toBeVisible()
  await expect(page.getByTestId('format-go')).toBeDisabled()
})

test('waits when the pending edits can\'t be saved, and keeps them (review fix)', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  const before = await body.inputValue()
  // The plan allows exactly this many words, so the next added word can't be saved (limit_reached).
  await setFreeLimit(page, 'scripts.max_words', before.split(/\s+/).filter(Boolean).length)
  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-go').click()
  await expect(page.getByTestId('format-preview')).toBeVisible()
  await page.getByTestId('format-drawer').getByRole('button', { name: 'إغلاق' }).click()

  await body.click()
  await body.press('Control+End')
  await body.pressSequentially(' زيادة')
  await expect(page.getByRole('dialog').filter({ hasText: 'النص أطول من حد خطتك' })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  await page.getByTestId('tools-format').click()
  await page.getByTestId('format-apply').click()
  await expect(page.getByTestId('format-error')).toContainText('لم يُحفظ آخر تعديل')
  await expect(body).toHaveValue(/زيادة$/)
  // The refused save shows the plan-limit dialog again, over the drawer.
  await page.getByRole('dialog', { name: 'النص أطول من حد خطتك' }).getByRole('button', { name: 'رجوع' }).click()
  await page.getByTestId('format-error').getByRole('button', { name: 'رجوع' }).click()
  await expect(page.getByTestId('format-preview')).toBeVisible()
})
