import { expect, test } from '@playwright/test'

test('signed-out visitors are sent to sign-in with a return path', async ({ page }) => {
  await page.goto('/app/recordings')
  await expect(page).toHaveURL(/\/signin\?next=/)
  // The router may leave "/" unescaped in the query (RFC 3986 allows it), so read the parameter, not the raw string.
  expect(new URL(page.url()).searchParams.get('next')).toBe('/app/recordings')
})

test('the mock panel signs in the seed user and the app shell opens', async ({ page }) => {
  await page.goto('/__mock')
  await page.getByRole('button', { name: 'Sign in as Layan' }).click()
  await expect(page.getByText('Signed in as layan@example.com', { exact: true })).toBeVisible() // the mock answers after its latency
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/scripts$/)
  await expect(page.getByRole('navigation').first()).toBeVisible()
})
