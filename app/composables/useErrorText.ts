import { isPortError } from '~/services/types'

/**
 * Turns a port error into a sentence that says what went wrong and how to fix it.
 * `overrides` lets a screen phrase a code its own way (e.g. invalid_credentials on sign in).
 */
export function useErrorText() {
  const { t } = useI18n()
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
      default: return t('errors.unknown')
    }
  }
}
