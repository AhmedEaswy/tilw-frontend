import { defineStore } from 'pinia'
import type { ReadingPosition, ReadingSettings, Script, TextDirection } from '~/services/types'
import { DEFAULT_READING, isPortError } from '~/services/types'

/**
 * Rehearsal state (US5).
 * - Reading settings are account-wide (G15): changes apply at once and are saved to the account shortly
 *   after, so settings (US8) shows the same values.
 * - Text direction is per script and saved on the script.
 * - The reading position is saved every few seconds while playing and on pause; when that fails the
 *   page shows the recovery screen (6:79) instead of losing the place silently.
 */
const SETTINGS_SAVE_MS = 600

export const useReaderStore = defineStore('reader', () => {
  const script = ref<Script | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
  const loadError = ref<unknown>(null)
  const settings = ref<ReadingSettings>({ ...DEFAULT_READING })
  const settingsError = ref(false)
  /** Set when the last position save failed (shows 6:79). */
  const positionError = ref(false)

  let settingsTimer: ReturnType<typeof setTimeout> | undefined
  let lastSaved = ''

  const api = () => useServices()

  const paragraphs = computed(() => splitParagraphs(script.value?.body ?? ''))
  const paragraphWords = computed(() => paragraphs.value.map(countWords))
  const direction = computed<'rtl' | 'ltr'>(() => {
    const d = script.value?.direction ?? 'auto'
    return d === 'auto' ? detectDirection(script.value?.body || script.value?.title || 'ا') : d
  })

  async function load(id: string) {
    reset()
    status.value = 'loading'
    const auth = useAuthStore()
    if (auth.user) settings.value = { ...DEFAULT_READING, ...auth.user.reading }
    try {
      script.value = await api().scripts.get(id)
      lastSaved = JSON.stringify(script.value.lastPosition)
      status.value = 'ready'
    } catch (e) {
      loadError.value = e
      status.value = isPortError(e, 'not_found') ? 'missing' : 'error'
    }
  }

  // ---------- settings (account-wide) ----------
  function updateSettings(patch: Partial<ReadingSettings>) {
    settings.value = { ...settings.value, ...patch }
    if (settingsTimer) clearTimeout(settingsTimer)
    settingsTimer = setTimeout(() => void saveSettings(), SETTINGS_SAVE_MS)
  }

  async function saveSettings() {
    settingsTimer = undefined
    try {
      const user = await api().account.updateReading({ ...settings.value })
      useAuthStore().setUser(user)
      settingsError.value = false
    } catch {
      settingsError.value = true
    }
  }

  /** Save pending settings now (leaving the page). */
  function flushSettings() {
    if (settingsTimer) {
      clearTimeout(settingsTimer)
      void saveSettings()
    }
  }

  // ---------- direction (per script) ----------
  async function setDirection(d: TextDirection) {
    const s = script.value
    if (!s || s.direction === d) return
    const before = s.direction
    s.direction = d
    try {
      let saved: Script
      try {
        saved = await api().scripts.update(s.id, { direction: d }, s.version)
      } catch (e) {
        if (!isPortError(e, 'conflict')) throw e
        // Only the direction changes here, so apply it on top of the newer account copy.
        const current = e.current as Script
        saved = await api().scripts.update(s.id, { direction: d }, current.version)
      }
      script.value = { ...saved }
      useScriptsStore().upsert(saved)
    } catch (e) {
      s.direction = before
      throw e
    }
  }

  // ---------- position ----------
  async function savePosition(pos: ReadingPosition) {
    const s = script.value
    if (!s) return
    const key = JSON.stringify(pos)
    if (key === lastSaved && !positionError.value) return
    try {
      await api().scripts.savePosition(s.id, pos)
      lastSaved = key
      s.lastPosition = pos
      positionError.value = false
    } catch {
      positionError.value = true
    }
  }

  function reset() {
    if (settingsTimer) clearTimeout(settingsTimer)
    settingsTimer = undefined
    script.value = null
    status.value = 'idle'
    loadError.value = null
    positionError.value = false
    settingsError.value = false
    lastSaved = ''
  }

  return {
    script, status, loadError, settings, settingsError, positionError, paragraphs, paragraphWords, direction,
    load, updateSettings, flushSettings, setDirection, savePosition, reset,
  }
})
