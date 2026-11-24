/**
 * Feature 006 (review, gaps G-D10): the admin console's strings live in `i18n/admin/{ar,en}.json`, outside the
 * studio's locale files, so they never ship in the studio's entry chunk. The admin route middleware loads both
 * languages before an admin page renders (no raw keys on screen, and switching the language needs no second load),
 * and merges them again after every language switch in case the locale file was (re)loaded over them.
 */
type Lang = 'ar' | 'en'
interface MessageHost {
  mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void
}

const loaders: Record<Lang, () => Promise<{ default: Record<string, unknown> }>> = {
  ar: () => import('~~/i18n/admin/ar.json'),
  en: () => import('~~/i18n/admin/en.json'),
}
const cache: Partial<Record<Lang, Record<string, unknown>>> = {}
let hooked = false

export async function loadAdminMessages(i18n: MessageHost, langs: Lang[] = ['ar', 'en']): Promise<void> {
  await Promise.all(langs.map(async (l) => {
    cache[l] ??= (await loaders[l]()).default
    i18n.mergeLocaleMessage(l, cache[l]!)
  }))
}

/** Load once per app and keep the strings merged across language switches. */
export async function ensureAdminMessages(nuxtApp: { $i18n: unknown; hook: (name: never, fn: (...a: never[]) => unknown) => unknown }): Promise<void> {
  const i18n = nuxtApp.$i18n as MessageHost
  await loadAdminMessages(i18n)
  if (hooked) return
  hooked = true
  nuxtApp.hook('i18n:localeSwitched' as never, (() => {
    void loadAdminMessages(i18n)
  }) as never)
}
