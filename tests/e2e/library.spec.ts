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

test('sort by title, pin, and archive / restore', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'الأحدث أولاً' }).click()
  await page.getByText('حسب العنوان').click()
  await page.getByRole('button', { name: 'تم', exact: true }).click() // not "خيارات رسالة إلى المستمع"
  await expect(page.getByRole('button', { name: 'حسب العنوان' })).toBeVisible()

  await page.getByRole('button', { name: 'خيارات وراء الكواليس' }).click()
  await page.getByRole('button', { name: 'تثبيت' }).click()
  await page.getByRole('tab', { name: 'المثبتة' }).click()
  await expect(page.getByRole('link', { name: /وراء الكواليس/ })).toBeVisible()

  await page.getByRole('tab', { name: 'الكل' }).click()
  await page.getByRole('button', { name: 'خيارات رسالة إلى المستمع' }).click()
  await page.getByRole('button', { name: 'نقل إلى الأرشيف' }).click()
  await expect(page.getByRole('link', { name: /رسالة إلى المستمع/ })).toHaveCount(0)
  await page.getByRole('tab', { name: 'المؤرشفة' }).click()
  await page.getByRole('button', { name: 'خيارات رسالة إلى المستمع' }).click()
  await page.getByRole('button', { name: 'إعادة من الأرشيف' }).click()
  await expect(page.getByText('لا نصوص في الأرشيف.')).toBeVisible()
})

test('new script opens the editor; import rejects non-text files', async ({ page, isMobile }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'نص جديد' }).first().click()
  await page.getByLabel('عنوان النص').fill('نص تجريبي')
  await page.getByRole('button', { name: 'فتح المحرر' }).click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_/)

  // Phone (6:20) has no import in the library header; it is offered on the empty library only.
  if (isMobile) return
  await page.goto('/app/scripts')
  await page.getByRole('button', { name: 'استيراد ملف' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'اختيار ملف TXT' }).click()
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toContainText('هذا ليس ملف TXT')
})

test('renames from the actions sheet', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'خيارات وراء الكواليس' }).click()
  await page.getByRole('button', { name: 'تغيير العنوان' }).click()
  await page.getByLabel('عنوان النص').fill('كواليس الحلقة')
  await page.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByRole('link', { name: /كواليس الحلقة/ })).toBeVisible()
})
