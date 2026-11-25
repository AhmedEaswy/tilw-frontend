/**
 * Language and appearance choices shared by the account menu, the auth-layout language switch and (later) the admin
 * console. A choice applies at once on this device and, when someone is signed in, is saved to the account in the
 * background (a failed save shows a toast; the local choice stays).
 */
import type { Locale, Theme } from '~/services/types'
import { LOCALE_COOKIE } from '~/plugins/locale.client'

/** The interface languages, each named in its own language. */
export const LOCALE_OPTIONS: readonly { code: Locale; name: string }[] = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
]

/** Saves `locale` / `theme` to the signed-in account. Does nothing when signed out. */
export function useAccountPrefs() {
  const auth = useAuthStore()
  const { show } = useToast()
  const errorText = useErrorText()
  async function save(patch: { locale?: Locale; theme?: Theme }) {
    if (!auth.user) return
    try {
      auth.setUser(await useServices().account.updatePrefs(patch))
    } catch (e) {
      show(errorText(e), 'error')
    }
  }
  return { save }
}

/** UI language: the `tilw-locale` cookie, i18n's `setLocale`, then the account. */
export function useLocaleChoice() {
  const { locale, setLocale } = useI18n()
  const cookie = useCookie<Locale | null>(LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const { save } = useAccountPrefs()
  const current = computed(() => locale.value as Locale)
  const other = computed(() => LOCALE_OPTIONS.find(o => o.code !== current.value)!)

  async function choose(l: Locale) {
    if (l === current.value) return
    cookie.value = l
    await setLocale(l)
    void save({ locale: l })
  }
  return { locale: current, options: LOCALE_OPTIONS, other, choose }
}

/** Appearance: the device preference (`prefs.setTheme`), then the account. */
export function useThemeChoice() {
  const prefs = usePrefsStore()
  const { save } = useAccountPrefs()
  const theme = computed(() => prefs.theme)
  function choose(th: Theme) {
    if (th === prefs.theme) return
    prefs.setTheme(th)
    void save({ theme: th })
  }
  return { theme, choose }
}
