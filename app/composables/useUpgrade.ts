import type { UpgradePeriod } from '~/services/types'

export type UpgradeOutcome =
  | { kind: 'opened'; reference: string }
  /** The new tab was blocked, or no sales number is set: show the reference, a copy control and the link. */
  | { kind: 'fallback'; reference: string; url: string | null }

/**
 * Release 2 (US2): the upgrade sheet (R2-4) and the WhatsApp hand-off (research §5).
 *
 * `start()` must run inside the click: it opens `about:blank` synchronously (popup blockers allow windows opened
 * from a user gesture), sends the request, then points that window at the returned wa.me link. When the window was
 * blocked (`window.open` → null) or the service has no sales number (`whatsappUrl: null`), the caller shows the
 * fallback panel instead.
 */
export function useUpgrade() {
  const isOpen = useState('upgrade-open', () => false)
  const plan = usePlanStore()
  // Whether a paid plan is on sale: entry points show "Upgrade" / "Renew" only while one is (the admin can disable Pro).
  if (import.meta.client) void plan.ensurePublic()
  const available = computed(() => plan.paidAvailable)

  function open() {
    useLimitError().close()
    if (!available.value) return
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }

  async function start(period: UpgradePeriod): Promise<UpgradeOutcome> {
    const win = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
    try {
      const { request, whatsappUrl } = await usePlanStore().requestUpgrade(period)
      if (win && whatsappUrl) {
        try {
          win.opener = null
        } catch { /* cross-origin already */ }
        win.location.href = whatsappUrl
        return { kind: 'opened', reference: request.reference }
      }
      win?.close()
      return { kind: 'fallback', reference: request.reference, url: whatsappUrl }
    } catch (e) {
      win?.close()
      throw e
    }
  }

  /** "Open WhatsApp again" from the pending panel: plain link opening, no new request. */
  function reopen(url: string) {
    const win = window.open(url, '_blank', 'noopener')
    return !!win
  }

  return { isOpen, available, open, close, start, reopen }
}
