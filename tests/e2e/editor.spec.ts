import { expect, test, type Page } from '@playwright/test'

// T055 — editor flows against the static build and the in-browser mock.

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
}

test('edits autosave to the account and survive a reload', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  await body.click()
  await body.press('End')
  await page.keyboard.type(' سطر مضاف.')
  await expect(page.getByText('حُفظ في حسابك')).toBeVisible({ timeout: 5000 })
  await page.reload()
  await expect(page.getByLabel('نص الحلقة')).toHaveValue(/سطر مضاف\./)
})

test('undo reverts the last change', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  const before = await body.inputValue()
  await body.click()
  await page.keyboard.type('XYZ')
  await page.waitForTimeout(800)
  await page.keyboard.press('Control+z')
  await expect(body).toHaveValue(before)
})

test('a newer account copy opens the compare screen', async ({ page }) => {
  await signIn(page)
  await page.evaluate(() => localStorage.setItem('tilw:mock:knobs', JSON.stringify({ latencyMs: 50, forceConflictOnNextSave: true })))
  await page.goto('/app/scripts/s_backstage')
  await page.getByLabel('نص الحلقة').click()
  await page.keyboard.type(' تعديل')
  await expect(page.getByRole('heading', { name: 'تغير النص في مكان آخر' })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'احفظ تعديلاتي كنص جديد' }).click()
  await expect(page.getByText(/حُفظت تعديلاتك في/)).toBeVisible()
  await expect(page.getByText('حُفظ في حسابك')).toBeVisible()
})

test('search highlights matches and counts them', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_opening')
  await page.getByRole('button', { name: 'بحث في النص' }).click()
  await page.getByLabel('بحث في النص').last().fill('سؤال')
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible()
})
