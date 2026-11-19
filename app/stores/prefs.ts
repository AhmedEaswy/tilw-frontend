import { defineStore } from 'pinia'
import type { Theme } from '~/services/types'

const THEME_KEY = 'tp-theme' // shared with the landing page's theme switch

/** Device-level appearance. Applied to <html data-theme>; 'system' removes the attribute. */
export const usePrefsStore = defineStore('prefs', () => {
  const theme = ref<Theme>('system')

  function apply(t: Theme) {
    if (!import.meta.client) return
    const root = document.documentElement
    if (t === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', t)
  }

  function load() {
    if (!import.meta.client) return
    try {
      const t = localStorage.getItem(THEME_KEY)
      theme.value = t === 'light' || t === 'dark' ? t : 'system'
    } catch {
      theme.value = 'system'
    }
    apply(theme.value)
  }

  function setTheme(t: Theme) {
    theme.value = t
    apply(t)
    try {
      localStorage.setItem(THEME_KEY, t === 'system' ? 'auto' : t)
    } catch {
      /* private mode: keep in memory only */
    }
  }

  return { theme, load, setTheme }
})
