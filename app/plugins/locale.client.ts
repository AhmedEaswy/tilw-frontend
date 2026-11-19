/**
 * Restores the UI language the user chose (cookie `tilw-locale`). Arabic is the default and the
 * browser's language is deliberately ignored (constitution I: Arabic-first).
 */
export const LOCALE_COOKIE = 'tilw-locale'

export default defineNuxtPlugin({
  name: 'tilw-locale',
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    const saved = useCookie<'ar' | 'en' | null>(LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    const i18n = nuxtApp.$i18n as { locale: Ref<string>; setLocale: (l: 'ar' | 'en') => Promise<void> }
    if (saved.value === 'en' && i18n.locale.value !== 'en') await i18n.setLocale('en')
  },
})
