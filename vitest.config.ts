import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for services, stores logic and utils. Component tests can opt into the Nuxt
// environment later with `// @vitest-environment nuxt` (@nuxt/test-utils is installed).
export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
