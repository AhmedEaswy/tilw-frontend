/** Shared mounting options for the components/ui form-control tests (happy-dom, real vue-i18n, UiGlyph stubbed). */
import { createI18n } from 'vue-i18n'
import ar from '~~/i18n/locales/ar.json'
import en from '~~/i18n/locales/en.json'

export function uiGlobal(locale: 'en' | 'ar' = 'en') {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { en, ar }, missingWarn: false, fallbackWarn: false })
  return { plugins: [i18n], stubs: { UiGlyph: true } }
}

export function key(k: string, extra: KeyboardEventInit = {}) {
  return { key: k, ...extra }
}
