import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Unit tests for services, stores logic and utils. Component tests can opt into the Nuxt
// environment later with `// @vitest-environment nuxt` (@nuxt/test-utils is installed). Plain component tests (the
// form controls in components/ui) mount .vue files with the Vue plugin under `// @vitest-environment happy-dom`.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '~~': fileURLToPath(new URL('./', import.meta.url)), '~': fileURLToPath(new URL('./app', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
