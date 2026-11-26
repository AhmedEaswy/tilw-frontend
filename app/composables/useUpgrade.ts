import type { UpgradePeriod } from '~/services/types'

/**
 * Release 2 (US2): the upgrade sheet (R2-4) and the phone dialog behind its button. The person leaves their WhatsApp
 * number with the request and the admin writes to them; nothing opens on their side.
 *
 * `askPhone()` opens the phone dialog (over the sheet, or on its own to change the number of a pending request).
 */
export function useUpgrade() {
  const isOpen = useState('upgrade-open', () => false)
  /** The period being asked for while the phone dialog is open. */
  const phonePeriod = useState<UpgradePeriod | null>('upgrade-phone', () => null)
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
    phonePeriod.value = null
  }

  function askPhone(period: UpgradePeriod) {
    phonePeriod.value = period
  }
  function closePhone() {
    phonePeriod.value = null
  }

  return { isOpen, phonePeriod, available, open, close, askPhone, closePhone }
}
