import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './r2'

// Feature 005 US3 (T020): dictation on the device (G-A5, quickstart 3) and a new script from an audio file (quickstart 4).
// Dictation hears the mock's scripted recognizer; New from audio records with Chromium's fake microphone.

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  acceptDownloads: true,
})

/** A silent 8 kHz mono WAV of `seconds`. */
function wav(seconds: number): Buffer {
  const rate = 8000
  const n = rate * seconds
  const b = Buffer.alloc(44 + n, 128)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate, 28)
  b.writeUInt16LE(1, 32)
  b.writeUInt16LE(8, 34)
  b.write('data', 36)
  b.writeUInt32LE(n, 40)
  return b
}

/** G-A5: the scripted recognizer in the mock (services/mock/recognition.ts); `ok` says three phrases. */
async function recognition(page: Page, mode: 'ok' | 'unsupported' | 'denied' | 'network') {
  await page.addInitScript(m => localStorage.setItem('tilw:mock:recognition', m), mode)
}

test('dictates on the device: words appear live, Insert puts them at the cursor, no credits used', async ({ page }) => {
  await recognition(page, 'ok')
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  await body.click()
  await body.press('Control+End')
  await page.getByTestId('tools-dictate').click()
  const dialog = page.getByTestId('dictate-dialog')
  await expect(dialog.getByTestId('dictate-listening')).toContainText('يستمع')
  await expect(dialog.getByText('لا يصل أي صوت إلى Tilw ولا يُخصم أي رصيد')).toBeVisible()
  // Live, then final; the browser ends the session once and the app listens on.
  await expect(dialog.getByTestId('dictate-text')).toHaveText('فاكتبه لنا. ربما يكون سؤالك هو الحكاية التالية. كل حكاية تبدأ بسؤال صغير.')
  await page.waitForTimeout(600)
  await expect(dialog.getByTestId('dictate-listening')).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="dictate-dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])
  await dialog.getByTestId('dictate-stop').click()
  await dialog.getByTestId('dictate-insert').click()
  await expect(page.getByText('أُدرج النص عند المؤشر.')).toBeVisible()
  await expect(body).toHaveValue(/فاكتبه لنا\. ربما يكون سؤالك هو الحكاية التالية\. كل حكاية تبدأ بسؤال صغير\.$/)

  await page.goto('/app/settings/ai')
  await expect(page.getByTestId('credits-balance')).toHaveText('20 رصيد')
  await expect(page.getByTestId('credit-entries')).not.toContainText('تحويل كلام')
})

test('the chosen dialect is remembered; English scripts listen in English', async ({ page }) => {
  await recognition(page, 'ok')
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  await page.getByTestId('tools-dictate').click()
  const dialog = page.getByTestId('dictate-dialog')
  await expect(dialog.getByTestId('dictate-lang')).toContainText('العربية (مصر)')
  await dialog.getByTestId('dictate-lang').click()
  await page.getByRole('option', { name: 'العربية (السعودية)' }).click()
  expect(await page.evaluate(() => localStorage.getItem('tilw:dictate:lang'))).toBe('ar-SA')
})

test('microphone refused: says how to allow it and inserts nothing', async ({ page }) => {
  await recognition(page, 'denied')
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const before = await page.getByLabel('نص الحلقة').inputValue()
  await page.getByTestId('tools-dictate').click()
  const dialog = page.getByTestId('dictate-dialog')
  await expect(dialog.getByRole('alert')).toContainText('اسمح بالميكروفون')
  await expect(dialog.getByTestId('dictate-insert')).toHaveCount(0)
  await expect(page.getByLabel('نص الحلقة')).toHaveValue(before)
})

test('API there but failing at once (Brave, Opera): not available here', async ({ page }) => {
  await recognition(page, 'network')
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  await page.getByTestId('tools-dictate').click()
  await expect(page.getByTestId('dictate-dialog').getByRole('alert')).toContainText('الإملاء غير متاح في هذا المتصفح')
})

test('no speech recognition: Dictate shows disabled and its tooltip says why', async ({ page, isMobile }) => {
  await recognition(page, 'unsupported')
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const button = page.getByTestId('tools-dictate')
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  const tip = page.getByRole('tooltip')
  const text = 'الإملاء غير متاح في هذا المتصفح. استخدم ميكروفون لوحة المفاتيح، أو افتح Tilw في Chrome أو Safari.'
  // aria-disabled: Playwright treats it as not enabled, so force the pointer (people can still tap and hover it).
  if (isMobile) {
    // Centre it: at the bottom edge the phone's sticky action bar covers it.
    await button.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await button.tap({ force: true })
  } else {
    await button.hover({ force: true })
  }
  await expect(tip).toBeVisible()
  await expect(tip).toHaveText(text)
  await expect(page.getByTestId('dictate-dialog')).toHaveCount(0)
  const { violations } = await new AxeBuilder({ page }).include('aside').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
  if (!isMobile) {
    await button.focus()
    await expect(tip).toBeVisible()
    await expect(button).toHaveAccessibleDescription(new RegExp(text.slice(0, 20)))
  }
})

test('makes a new script from an audio file, and refuses a file that is not audio', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone library has no header actions (6:20); the empty library card offers them.')
  await signIn(page)
  await page.getByTestId('new-from-audio').click()
  const dialog = page.getByTestId('audio-import')
  await dialog.getByTestId('audio-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(dialog.getByTestId('audio-refused')).toContainText('هذا ليس ملفاً صوتياً')
  await expect(dialog.getByTestId('audio-refused')).toContainText('لم يُخصم أي رصيد')

  await dialog.getByTestId('audio-file').setInputFiles({ name: 'مقابلة.wav', mimeType: 'audio/wav', buffer: wav(3) })
  await expect(dialog.getByTestId('transcribe-cost')).toHaveText('1 رصيد')
  await expect(dialog.getByText('مقابلة.wav')).toBeVisible()
  await dialog.getByTestId('transcribe-go').click()
  await expect(dialog.getByTestId('audio-result')).toContainText('كل حكاية تبدأ بسؤال صغير.')
  await dialog.getByTestId('audio-save').click()
  await expect(page).toHaveURL(/\/app\/scripts\/s_/)
  await expect(page.getByLabel('عنوان النص')).toHaveValue('مقابلة')
  await expect(page.getByLabel('نص الحلقة')).toHaveValue(/كل حكاية تبدأ بسؤال صغير\./)
})

test('new from audio: a file from Google Drive (Picker) goes through the same checks; without Drive it asks to link it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone library has no header actions (6:20); the empty library card offers them.')
  await signIn(page)
  await page.getByTestId('new-from-audio').click()
  let dialog = page.getByTestId('audio-import')
  await expect(dialog.getByTestId('audio-drop')).toContainText('أو أفلِت ملفاً صوتياً هنا')
  // Drive not linked yet: no Drive button, a link to Storage instead.
  await expect(dialog.getByTestId('audio-from-drive')).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: 'ربط Google Drive' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/app/settings/storage')
  await page.getByRole('button', { name: 'ربط Google Drive' }).click()
  await expect(page.getByText('رُبط Google Drive بحساب layan@gmail.com.')).toBeVisible()

  await page.goto('/app/scripts')
  await page.getByTestId('new-from-audio').click()
  dialog = page.getByTestId('audio-import')
  await dialog.getByTestId('audio-from-drive').click()
  // The mock Picker returns a 3-second recording; it is checked and priced like a local file.
  await expect(dialog.getByTestId('transcribe-cost')).toHaveText('1 رصيد')
  await expect(dialog.getByText('Drive interview.wav')).toBeVisible()
})
