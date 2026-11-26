import { expect, test, type Page } from '@playwright/test'
import { hydrated } from './r2'

// T047 — library flows against the static build and the in-browser mock.

async function signIn(page: Page) {
  await page.goto('/signin')
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
}

test('lists seeded scripts with the last opened card', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'آخر نص فتحته' }).or(page.getByText('آخر نص فتحته'))).toBeVisible()
  await expect(page.getByRole('link', { name: /وراء الكواليس/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /رسالة إلى المستمع/ })).toBeVisible()
})

test('search filters by body text', async ({ page, isMobile }) => {
  await signIn(page)
  // Phone (6:20) folds the search field behind its toggle.
  if (isMobile) await page.getByRole('button', { name: 'ابحث في نصوصك' }).click()
  await page.getByPlaceholder('ابحث في نصوصك').fill('المستمع')
  await expect(page.getByRole('link', { name: /رسالة إلى المستمع/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /وراء الكواليس/ })).toHaveCount(0)
})

test('sort and reverse, pin, and archive / restore', async ({ page }) => {
  await signIn(page)
  const rows = page.locator('.rows .title')
  const sortBy = page.getByRole('combobox', { name: 'ترتيب النصوص' })
  await sortBy.click()
  await page.getByRole('option', { name: 'العنوان' }).click()
  await expect(sortBy).toContainText('العنوان')
  await expect(page.getByTestId('sort-dir')).toHaveAttribute('data-dir', 'asc')
  const titles = ['افتتاحية الحلقة', 'رسالة إلى المستمع', 'وراء الكواليس']
  await expect(rows).toHaveText(titles)
  await page.getByRole('button', { name: 'عكس الترتيب' }).click()
  await expect(rows).toHaveText([...titles].reverse())
  await sortBy.click()
  await page.getByRole('option', { name: 'التسجيلات' }).click()
  await expect(page.getByTestId('sort-dir')).toHaveAttribute('data-dir', 'desc')
  await expect(rows).toHaveCount(3)

  await page.getByRole('button', { name: 'خيارات وراء الكواليس' }).click()
  await page.getByRole('menuitem', { name: 'تثبيت' }).click()
  await page.getByRole('tab', { name: 'المثبتة' }).click()
  await expect(page.getByRole('link', { name: /وراء الكواليس/ })).toBeVisible()

  await page.getByRole('tab', { name: 'الكل' }).click()
  await page.getByRole('button', { name: 'خيارات رسالة إلى المستمع' }).click()
  await page.getByRole('menuitem', { name: 'نقل إلى الأرشيف' }).click()
  await expect(page.getByRole('link', { name: /رسالة إلى المستمع/ })).toHaveCount(0)
  await page.getByRole('tab', { name: 'المؤرشفة' }).click()
  await page.getByRole('button', { name: 'خيارات رسالة إلى المستمع' }).click()
  await page.getByRole('menuitem', { name: 'إعادة من الأرشيف' }).click()
  await expect(page.getByText('لا نصوص في الأرشيف.')).toBeVisible()
})

test('new script opens the editor; import rejects non-text files', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'نص جديد' }).first().click()
  await page.getByRole('menuitem', { name: 'إنشاء نص' }).click()
  await page.getByLabel('عنوان النص').fill('نص تجريبي')
  await page.getByRole('button', { name: 'فتح المحرر' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_/)

  await page.goto('/app/scripts')
  await page.getByRole('button', { name: 'نص جديد' }).first().click()
  await page.getByRole('menuitem', { name: 'استيراد ملف' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'اختيار ملف TXT' }).click()
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toContainText('هذا ليس ملف TXT')
})

test('renames from the options menu', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'خيارات وراء الكواليس' }).click()
  await page.getByRole('menuitem', { name: 'تغيير العنوان' }).click()
  await page.getByLabel('عنوان النص').fill('كواليس الحلقة')
  await page.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByRole('link', { name: /كواليس الحلقة/ })).toBeVisible()
})

test('script options open as a dropdown menu, not a dialog', async ({ page }) => {
  await signIn(page)
  const more = page.getByRole('button', { name: 'خيارات وراء الكواليس' })
  await more.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  // Focus starts on the first item; arrows move, Esc closes and returns focus to the button.
  await expect(menu.getByRole('menuitem', { name: 'تغيير العنوان' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(more).toBeFocused()
  // A click outside closes it too.
  await more.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('heading', { level: 1 }).first().click()
  await expect(page.getByRole('menu')).toBeHidden()
})
