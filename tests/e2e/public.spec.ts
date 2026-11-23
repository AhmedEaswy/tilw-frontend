import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// US9 (T100–T105) — public pages, system states, and WCAG 2.2 AA checks with axe on the key routes.

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
  await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/app\/scripts$/)
}

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).exclude('#nuxt-devtools-container').analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test('landing calls to action lead to real pages', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /جرّب الملقّن مجاناً/ })).toHaveAttribute('href', '/waitlist')
  await expect(page.getByRole('link', { name: /ابدأ مجاناً/ })).toHaveAttribute('href', '/waitlist')
  await expect(page.getByRole('link', { name: 'دخول' }).first()).toHaveAttribute('href', '/signin')
})

test('unknown pages show the 404 screen', async ({ page }) => {
  const res = await page.goto('/no-such-page')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'لم نجد هذه الصفحة' })).toBeVisible()
})

test('going offline shows a notice in the app', async ({ page, context }) => {
  await signIn(page)
  await context.setOffline(true)
  await expect(page.getByText(/أنت غير متصل/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('عاد الاتصال.')).toBeVisible()
})

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const path of ['/signin', '/forgot-password', '/waitlist', '/privacy']) {
    test(`public ${path}`, async ({ page }) => {
      await page.goto(path)
      await axe(page)
    })
  }

  for (const path of ['/app/scripts', '/app/scripts/s_opening', '/app/scripts/s_opening/rehearse', '/app/scripts/s_opening/record', '/app/recordings', '/app/settings']) {
    test(`app ${path}`, async ({ page }) => {
      await signIn(page)
      await page.goto(path)
      await axe(page)
    })
  }
})

// Release 2 (US4, T046) — the landing plans poster reads prices from the service, with a build-time fallback.
test.describe('landing plans', () => {
  test('shows the service prices and switches monthly / yearly', async ({ page }) => {
    await page.goto('/')
    const poster = page.locator('.pl-poster')
    await expect(poster.locator('.pl-big', { hasText: 'Tilw Pro' })).toBeVisible()
    await expect(poster.getByText('$77')).toBeVisible()
    await expect(poster.getByText('وفّر 20٪')).toBeVisible()
    await poster.getByRole('radio', { name: 'شهري' }).click()
    await expect(poster.getByText('$8')).toBeVisible()
    await expect(page.getByText('Tilw Plus')).toHaveCount(0)
  })

  test('a price changed in the service shows after a reload; the baked-in prices cover an outage', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('tilw:mock:v1') ?? 'null')
      if (!s) return
      s.plans.find((p: { key: string }) => p.key === 'pro').priceYearlyCents = 9900
      localStorage.setItem('tilw:mock:v1', JSON.stringify(s))
    })
    await page.reload()
    await expect(page.locator('.pl-poster').getByText('$99')).toBeVisible()

    await page.evaluate(() => localStorage.setItem('tilw:mock:knobs', JSON.stringify({ plansDown: true })))
    await page.reload()
    await expect(page.locator('.pl-poster').getByText('$77')).toBeVisible()
  })

  test('Get Tilw Pro goes through sign-in to the upgrade sheet', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'احصل على Tilw Pro' }).click()
    await expect(page).toHaveURL(/\/signin\?next=/)
    await page.getByLabel('البريد الإلكتروني').fill('layan@example.com')
    await page.getByLabel('كلمة المرور', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
    await expect(page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })).toBeVisible()

    await page.goto('/')
    await page.getByRole('button', { name: 'احصل على Tilw Pro' }).click()
    await expect(page.getByRole('dialog', { name: 'الترقية إلى Tilw Pro' })).toBeVisible()
  })
})
