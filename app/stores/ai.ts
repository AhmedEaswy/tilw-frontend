import { defineStore } from 'pinia'
import { isPortError, type AiProvider, type Credits, type FormatSuggestion, type OwnKey, type Script } from '~/services/types'

/**
 * Feature 005: AI writing tools state (data-model `useAiStore`). Server state only: the own key is never kept here in
 * full (SC-003), and no transcript or audio is stored. Every charging answer carries the balance, so the balance shown
 * follows each action without a reload (research R8).
 */
export const useAiStore = defineStore('ai', () => {
  const credits = ref<Credits | null>(null)
  const balance = ref<number | null>(null)
  const key = ref<OwnKey | null>(null)
  const keyLoaded = ref(false)
  /** Waiting suggestion per script: null = none, missing = not asked yet. */
  const suggestions = ref<Record<string, FormatSuggestion | null>>({})
  /** A format request is running for this script (it survives closing the drawer; research R7). */
  const formatting = ref<Record<string, boolean>>({})

  const api = () => useServices().ai
  const negative = computed(() => typeof balance.value === 'number' && balance.value < 0)

  function setBalance(n: number | null | undefined) {
    if (typeof n === 'number') balance.value = n
  }

  async function loadCredits() {
    const c = await api().credits()
    credits.value = c
    balance.value = c.balance
    return c
  }
  /** Background refresh after a settlement; errors are ignored (the next load shows them). */
  function refreshCredits() {
    void loadCredits().catch(() => {})
  }

  async function loadKey() {
    const list = await api().keys()
    key.value = list.find(k => k.capability === 'text') ?? null
    keyLoaded.value = true
    return key.value
  }
  /** The key text goes straight to the port and is not kept anywhere in the app. */
  async function saveKey(provider: AiProvider, secret: string) {
    key.value = await api().saveKey({ provider, key: secret })
    keyLoaded.value = true
    return key.value
  }
  async function checkKey() {
    key.value = await api().checkKey()
    return key.value
  }
  async function deleteKey() {
    await api().deleteKey()
    key.value = null
  }

  async function estimate(scriptId: string) {
    const e = await api().formatEstimate(scriptId)
    setBalance(e.balance)
    return e
  }

  async function loadSuggestion(scriptId: string) {
    const s = await api().suggestion(scriptId)
    suggestions.value = { ...suggestions.value, [scriptId]: s }
    if (s) setBalance(s.balance)
    return s
  }

  async function format(scriptId: string, opts: { useCredits?: boolean } = {}) {
    formatting.value = { ...formatting.value, [scriptId]: true }
    try {
      const s = await api().format(scriptId, opts)
      suggestions.value = { ...suggestions.value, [scriptId]: s }
      setBalance(s.balance)
      refreshCredits()
      return s
    } catch (e) {
      // A refused or failed call may have refunded credits, or changed the key's check result.
      refreshCredits()
      throw e
    } finally {
      formatting.value = { ...formatting.value, [scriptId]: false }
    }
  }

  function forget(scriptId: string) {
    suggestions.value = { ...suggestions.value, [scriptId]: null }
  }

  async function discard(scriptId: string) {
    try {
      await api().discard(scriptId)
    } catch (e) {
      if (!isPortError(e, 'not_found')) throw e
    }
    forget(scriptId)
  }

  /** Applies the waiting suggestion; rethrows `conflict` (the script changed) and `not_found` (gone). */
  async function apply(scriptId: string): Promise<Script> {
    try {
      const s = await api().apply(scriptId)
      forget(scriptId)
      return s
    } catch (e) {
      if (isPortError(e, 'not_found')) forget(scriptId)
      throw e
    }
  }

  function reset() {
    credits.value = null
    balance.value = null
    key.value = null
    keyLoaded.value = false
    suggestions.value = {}
    formatting.value = {}
  }

  return {
    credits, balance, key, keyLoaded, suggestions, formatting, negative,
    setBalance, loadCredits, refreshCredits, loadKey, saveKey, checkKey, deleteKey,
    estimate, loadSuggestion, format, discard, apply, forget, reset,
  }
})
