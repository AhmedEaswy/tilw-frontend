import { defineConfig, devices } from '@playwright/test'

// Flow tests run against the static build (the same files a host would serve) with the mock backend.
// First run: `npx playwright install chromium`.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3100', locale: 'ar' },
  webServer: {
    command: 'npx nuxt generate && npx serve .output/public -l 3100 --single',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})
