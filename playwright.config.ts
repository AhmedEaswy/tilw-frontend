import { defineConfig, devices } from '@playwright/test'

// Flow tests run against the static build (the same files a host would serve) with the mock backend.
// First run: `npx playwright install chromium`.
// E2E_PORT picks another port when 3100 is taken by something else (Playwright would otherwise reuse that server).
const port = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${port}`, locale: 'ar' },
  webServer: {
    command: `npx nuxt generate && node tests/e2e/static-server.mjs .output/public ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})
