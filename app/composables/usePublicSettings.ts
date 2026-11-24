import type { PublicSettings } from '~/services/types'

/**
 * Feature 006 (research R14): the sign-up mode and feature flags, read once per page load from the public settings.
 * Until the answer arrives (and when it can't be reached) the mode is invite-only, so nobody is sent to a sign-up
 * that would be refused.
 */
export function usePublicSettings() {
  const state = useState<PublicSettings | null>('public-settings', () => null)
  const loading = useState<boolean>('public-settings-loading', () => false)
  async function load(force = false) {
    if (!import.meta.client || loading.value || (state.value && !force)) return
    loading.value = true
    try {
      state.value = await useServices().settings.public()
    } catch {
      // Unreachable: treat as invite-only for this page load (a reload asks again).
      state.value ??= { signupMode: 'invite_only', flags: {} }
    } finally {
      loading.value = false
    }
  }
  onMounted(() => void load())
  const signupOpen = computed(() => state.value?.signupMode === 'open')
  const flag = (key: string) => state.value?.flags[key] === true
  return { settings: state, signupOpen, flag, load }
}
