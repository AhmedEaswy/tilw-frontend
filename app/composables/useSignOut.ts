/** Sign out from anywhere in the app (settings 6:65, phone settings 6:104). T025. */
export function useSignOut() {
  const auth = useAuthStore()
  const { t } = useI18n()
  const { show } = useToast()
  const errorText = useErrorText()
  const busy = ref(false)

  async function signOut() {
    if (busy.value) return
    busy.value = true
    try {
      await auth.signOut()
      show(t('auth.signedOut'), 'info')
      await navigateTo('/signin', { replace: true })
    } catch (e) {
      show(errorText(e), 'error')
    } finally {
      busy.value = false
    }
  }

  return { signOut, busy }
}
