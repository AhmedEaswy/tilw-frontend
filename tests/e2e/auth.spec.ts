import { expect, test, type Page } from '@playwright/test'
import { hydrated } from './r2'

// T026 / T033 — auth flows against the static build and the in-browser mock.
// Each test starts from a fresh mock (empty localStorage in a new context).

const SEED = { email: 'layan@example.com', password: 'password123' }

async function signIn(page: Page, email = SEED.email, password = SEED.password) {
  await page.goto('/signin')
  await hydrated(page)
  await page.getByLabel('البريد الإلكتروني').fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
}

async function outboxLink(page: Page, kind: 'reset' | 'invite') {
  return page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem('tilw:mock:v1') ?? '{}')
    return (s.outbox ?? []).find((m: { kind: string }) => m.kind === k)?.link as string
  }, kind)
}

test('signs in and returns to the page that asked for it', async ({ page }) => {
  await page.goto('/app/recordings')
  await expect(page).toHaveURL(/\/signin\?next=/)
  await page.getByLabel('البريد الإلكتروني').fill(SEED.email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(SEED.password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/recordings$/)
})

test('wrong password shows a non-enumerating error and clears the field', async ({ page }) => {
  await signIn(page, SEED.email, 'wrong-password')
  await expect(page.getByRole('alert')).toContainText('البريد أو كلمة المرور غير صحيحة')
  await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveValue('')
})

test('validates the form before calling the service', async ({ page }) => {
  await page.goto('/signin')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page.getByText('اكتب بريدك الإلكتروني.')).toBeVisible()
  await expect(page.getByText('اكتب كلمة المرور.')).toBeVisible()
})

test('password reset round-trip through the mock outbox', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('البريد الإلكتروني').fill(SEED.email)
  await page.getByRole('button', { name: 'إرسال رابط الاستعادة' }).click()
  await expect(page).toHaveURL(/\/forgot-password\/sent$/)

  const link = await outboxLink(page, 'reset')
  expect(link).toContain('/reset-password?token=')
  await page.goto(new URL(link).pathname + new URL(link).search)
  await page.getByLabel('كلمة المرور الجديدة').fill('new-password-1')
  await page.getByLabel('أكد كلمة المرور').fill('new-password-1')
  await page.getByRole('button', { name: 'حفظ ودخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)

  // The link works once.
  await page.goto(new URL(link).pathname + new URL(link).search)
  await expect(page.getByRole('heading', { name: 'هذا الرابط لا يعمل' })).toBeVisible()
})

test('waitlist confirms the email without putting it in the URL', async ({ page }) => {
  await page.goto('/waitlist')
  await page.getByLabel('البريد الإلكتروني').fill('new.person@example.com')
  await page.getByRole('button', { name: 'انضم للقائمة' }).click()
  await expect(page).toHaveURL(/\/waitlist\/confirmed$/)
  await expect(page.getByText('new.person@example.com')).toBeVisible()
})

test('accepting an invitation creates the account and opens the library', async ({ page }) => {
  await page.goto('/invite/demo-invite')
  await expect(page.getByLabel('البريد الإلكتروني')).toHaveValue('invited@example.com')
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password-1')
  await page.getByLabel('أكد كلمة المرور').fill('password-1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)

  await page.goto('/invite/unknown-token')
  await expect(page).toHaveURL(/\/app\/scripts$/) // signed-in users skip invites
})

test('sign out from settings', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/app\/scripts$/) // let the sign-in finish before leaving the page
  await page.goto('/app/settings')
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(page).toHaveURL(/\/signin$/)
  await page.goto('/app/scripts')
  await expect(page).toHaveURL(/\/signin\?next=/)
})
