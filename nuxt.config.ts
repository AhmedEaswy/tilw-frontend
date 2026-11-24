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
      /** 'mock' (in-browser) or 'http' (Laravel API). Override with NUXT_PUBLIC_SERVICES_MODE. */
      servicesMode: 'mock',
      /** Laravel API origin for servicesMode 'http' (NUXT_PUBLIC_API_BASE_URL). Cookie auth needs the same site. */
      apiBaseUrl: 'http://localhost:8000',
      /** Placeholder until the owner supplies the real address (G16). */
      contactEmail: 'contact@example.com',
      /** Feature 006: the admin console's environment badge: local, staging or production (NUXT_PUBLIC_ENVIRONMENT). */
      environment: 'local',
      /** Feature 006: named in the "account suspended" message when set (NUXT_PUBLIC_SUPPORT_EMAIL). */
      supportEmail: '',
      /**
       * Release 2: plans shown on the prerendered landing when GET /api/plans can't be reached. The real prices and
       * limits always come from the service (FR-001); these are only the starting values, in US cents.
       */
      landingPlansFallback: {
        free: { priceMonthlyCents: 0, priceYearlyCents: 0 },
        pro: { priceMonthlyCents: 800, priceYearlyCents: 7700 },
      },
      /**
       * Feature 004 (phone link): the realtime server the studio connects to (Laravel Reverb, Pusher protocol).
       * NUXT_PUBLIC_REALTIME_KEY / _HOST / _PORT / _SCHEME. An empty key in http mode means phone link is unavailable.
       * The phone remote gets these from the pairing answer instead.
       */
      realtime: { key: '', host: '', port: 443, scheme: 'https' },
    },
  },

  routeRules: {
    // The studio is client-rendered; its HTML shell is still prerendered for static hosting.
    '/app/**': { ssr: false },
    // Feature 006: the admin console, client-rendered like the studio.
    '/admin/**': { ssr: false },
    '/admin': { ssr: false },
    '/__mock': { ssr: false },
    // Release 2: the email-confirmation link carries its token in the query; render it in the browser like the app.
    '/confirm-email': { ssr: false },
    // Feature 004: the public phone remote. Its pairing secret is in the hash; it runs only in the browser.
    '/remote': { ssr: false },
  },

  nitro: {
    preset: 'static',
    // Dev only: when the API is on another site (e.g. https://tilw-backend.test), browsers block its session cookie as
    // third-party. Set DEV_API_PROXY to the API origin and NUXT_PUBLIC_API_BASE_URL=/_api so the API is same-origin.
    devProxy: process.env.DEV_API_PROXY
      ? { '/_api': { target: process.env.DEV_API_PROXY, changeOrigin: true, secure: false } }
      : {},
    prerender: {
      crawlLinks: false,
      // Add routes here as their pages land (waitlist, forgot-password, privacy, terms…).
      routes: ['/', '/signin', '/forgot-password', '/forgot-password/sent', '/reset-password', '/waitlist', '/waitlist/confirmed', '/privacy', '/terms', '/app', '/__mock', '/remote'],
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
      // The SPA shell (200.html) for client-rendered routes (/app/**) ships before any page sets its own head, so it
      // needs a language and a title of its own (WCAG html-has-lang, document-title). app.vue and pages override both.
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'tilwprompter',
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
