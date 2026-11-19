// https://nuxt.com/docs/api/configuration/nuxt-config
// Phase 1 ships as a static site (`npm run generate`): no server runtime, data via the in-browser mock.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/i18n', '@vueuse/nuxt'],

  // Components register by file name only (components/scripts/ScriptRow.vue → <ScriptRow>).
  // Folders organise files; they don't prefix names.
  components: [{ path: '~/components', pathPrefix: false }],

  // Landing styles are imported by pages/index.vue only, so they never leak into the app.
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  runtimeConfig: {
    public: {
      /** 'mock' (Phase 1) or 'http' (Laravel adapter, later). */
      servicesMode: 'mock',
      /** Placeholder until the owner supplies the real address (G16). */
      contactEmail: 'contact@example.com',
    },
  },

  routeRules: {
    // The studio is client-rendered; its HTML shell is still prerendered for static hosting.
    '/app/**': { ssr: false },
    '/__mock': { ssr: false },
  },

  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: false,
      // Add routes here as their pages land (waitlist, forgot-password, privacy, terms…).
      routes: ['/', '/signin', '/forgot-password', '/forgot-password/sent', '/reset-password', '/waitlist', '/waitlist/confirmed', '/privacy', '/terms', '/app', '/__mock'],
    },
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'ar',
    locales: [
      { code: 'ar', language: 'ar', dir: 'rtl', name: 'العربية', file: 'ar.json' },
      { code: 'en', language: 'en', dir: 'ltr', name: 'English', file: 'en.json' },
    ],
    // Arabic is the default for everyone; English only when the user picks it (plugins/locale.client.ts).
    detectBrowserLanguage: false,
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
        },
      ],
      script: [
        {
          // Apply the saved theme before first paint (shared key with the landing page's theme switch).
          innerHTML:
            "try{var t=localStorage.getItem('tp-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          tagPosition: 'head',
        },
      ],
    },
  },

  typescript: { strict: true },
})
