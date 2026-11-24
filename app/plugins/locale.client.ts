/**
 * Restores the UI language the user chose (cookie `tilw-locale`). Arabic is the default and the
 * browser's language is deliberately ignored (constitution I: Arabic-first).
 *
 * Feature 004: the phone remote (/remote) has no account and is often opened on someone's own phone, so it follows
 * the phone's language the first time (English when the phone is in English, Arabic otherwise) and then remembers a
 * manual choice on that phone (`tilw:remote:locale`, research R9). The studio's behaviour is unchanged.
 */
export const LOCALE_COOKIE = 'tilw-locale'
export const REMOTE_LOCALE_KEY = 'tilw:remote:locale'

export function remoteLocale(saved: string | null, phoneLanguage: string | undefined): 'ar' | 'en' {
  if (saved === 'ar' || saved === 'en') return saved
  return phoneLanguage?.toLowerCase().startsWith('en') ? 'en' : 'ar'
}

export default defineNuxtPlugin({
  name: 'tilw-locale',
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    const i18n = nuxtApp.$i18n as { locale: Ref<string>; setLocale: (l: 'ar' | 'en') => Promise<void> }
    if (window.location.pathname.replace(/\/+$/, '') === '/remote') {
      let saved: string | null = null
      try { saved = localStorage.getItem(REMOTE_LOCALE_KEY) } catch { /* private mode */ }
      const want = remoteLocale(saved, navigator.language)
      if (i18n.locale.value !== want) await i18n.setLocale(want)
      return
    }
    const saved = useCookie<'ar' | 'en' | null>(LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    if (saved.value === 'en' && i18n.locale.value !== 'en') await i18n.setLocale('en')
  },
})
