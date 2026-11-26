import { expect, test } from '@playwright/test'
import { cloudSpeech, signIn } from './r2'

// Feature 005 US5 (T025): SRT and VTT captions from a take, built in the browser (quickstart 6). Chromium's fake
// devices record the take; the mock answers with fake word timings.

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  acceptDownloads: true,
})

test('makes SRT and VTT captions for a take', async ({ page }) => {
  await signIn(page)
  await cloudSpeech(page)
  await page.goto('/app/scripts/s_opening/record')
  await page.getByRole('button', { name: 'تفعيل الكاميرا والميكروفون' }).click()
  await page.getByRole('button', { name: 'ابدأ التسجيل' }).click()
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'إيقاف وحفظ' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/)
  await page.locator('a[href^="/app/recordings/t_"]').first().click()

  await page.getByTestId('take-captions').click()
  const dialog = page.getByTestId('captions-dialog')
  await expect(dialog.getByTestId('transcribe-cost')).toHaveText('1 رصيد')
  await dialog.getByTestId('transcribe-go').click()
  await expect(dialog.getByTestId('captions-ready')).toBeVisible()
  const srt = page.waitForEvent('download')
  await dialog.getByTestId('captions-srt').click()
  const file = await srt
  expect(file.suggestedFilename()).toMatch(/\.srt$/)
  const text = await (await file.createReadStream()).toArray().then(c => Buffer.concat(c).toString('utf8'))
  expect(text).toMatch(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\n/)
  const vtt = page.waitForEvent('download')
  await dialog.getByTestId('captions-vtt').click()
  expect((await vtt).suggestedFilename()).toMatch(/\.vtt$/)
})
