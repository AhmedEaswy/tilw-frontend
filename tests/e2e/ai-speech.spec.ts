import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { aiKnobs, signIn } from './r2'

// Feature 005 US3 (T020): dictation and a new script from an audio file (quickstart 3, 4).
// Chromium's fake microphone records; the mock answers with a fake transcript.

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

async function dictate(page: Page) {
  await page.getByTestId('tools-dictate').click()
  const dialog = page.getByTestId('dictate-dialog')
  await expect(dialog.getByTestId('dictate-stop')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(1200)
  await dialog.getByTestId('dictate-stop').click()
  await expect(dialog.getByTestId('transcribe-cost')).toHaveText('1 رصيد')
  return dialog
}

test('dictates into the editor at the cursor and charges by the minute', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/scripts/s_letter')
  const body = page.getByLabel('نص الحلقة')
  await body.click()
  await body.press('Control+End')
  const dialog = await dictate(page)
  await expect(dialog.getByText('المفاتيح الخاصة لا تنطبق على الكلام')).toBeVisible()
  await expect(dialog.getByText('يذهب الصوت من متصفحك مباشرة إلى مزوّد تحويل الكلام')).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="dictate-dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])
  await dialog.getByTestId('transcribe-go').click()
  await expect(page.getByText('أُدرج النص عند المؤشر.')).toBeVisible()
  await expect(body).toHaveValue(/فاكتبه لنا\. ربما يكون سؤالك هو الحكاية التالية\. كل حكاية تبدأ بسؤال صغير\./)

  await page.goto('/app/settings/ai')
  await expect(page.getByTestId('credits-balance')).toHaveText('19 رصيد')
  await expect(page.getByTestId('credit-entries')).toContainText('تحويل كلام')
})

test('says when the provider failed, without inserting anything', async ({ page }) => {
  await signIn(page)
  await aiKnobs(page, { speech: 'failed' })
  await page.goto('/app/scripts/s_letter')
  const before = await page.getByLabel('نص الحلقة').inputValue()
  const dialog = await dictate(page)
  await dialog.getByTestId('transcribe-go').click()
  await expect(dialog.getByTestId('transcribe-error')).toContainText('فشل تحويل الكلام')
  await expect(page.getByLabel('نص الحلقة')).toHaveValue(before)
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
