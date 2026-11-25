import { isPortError } from '~/services/types'

/**
 * Turns a port error into a sentence that says what went wrong and how to fix it.
 * `overrides` lets a screen phrase a code its own way (e.g. invalid_credentials on sign in).
 */
export function useErrorText() {
  const { t } = useI18n()
  // Feature 006 (owner decision): the suspended message names the support email when one is configured.
  const support = String(useRuntimeConfig().public.supportEmail || '')
  return (e: unknown, overrides: Partial<Record<string, string>> = {}) => {
    const code = isPortError(e) ? e.code : 'unknown'
    if (overrides[code]) return overrides[code]!
    switch (code) {
      case 'network': return t('errors.network')
      case 'rate_limited': return t('errors.rateLimited')
      case 'token_expired': return t('errors.tokenExpired')
      case 'token_invalid': return t('errors.tokenInvalid')
      case 'unauthenticated': return t('errors.sessionEnded')
      case 'limit_reached': return t('errors.limitReached')
      case 'storage_full': return t('errors.storageFull')
      case 'storage_not_linked': return t('errors.storageNotLinked')
      case 'partner_offline': return t('errors.partnerOffline')
      case 'own_key_refused': return t('errors.ownKeyRefused')
      case 'ai_unavailable': return t('errors.aiUnavailable')
      case 'account_suspended': return support ? t('errors.accountSuspendedContact', { email: support }) : t('errors.accountSuspended')
      case 'signup_closed': return t('errors.signupClosed')
      // Feature 007: an admin without the section's level, and the locked super admin.
      case 'forbidden': return t('errors.forbidden')
      case 'super_admin_locked': return t('errors.superAdminLocked')
      default: return t('errors.unknown')
    }
  }
}
