/**
 * Feature 004, US5 (T049, research R15): one plain-words text for why a link ended, shared by the studio panel, the
 * phone's end screen and Settings → Phone links. Unknown reasons (a newer server) fall back to a generic text.
 */
const KNOWN = new Set([
  'owner', 'remote', 'idle', 'script_deleted', 'signed_out', 'device_revoked', 'email_changed', 'account_deleted', 'limit',
  'replaced', 'declined', 'lapsed', 'left',
])

export function linkEndText(t: (key: string) => string, reason: string | null | undefined): string {
  return reason && KNOWN.has(reason) ? t(`link.ended.${reason}`) : t('link.ended.unknown')
}
