import type { LimitInfo } from '~/services/types'
import { isPortError } from '~/services/types'

/**
 * Release 2 (US1, FR-003): every refusal with `limit_reached` opens the one limit dialog (R2-2), mounted by the app
 * layout, instead of the generic error. `handle(e)` returns true when it took care of the error.
 * It also refreshes the plan, since a refusal means the cached limits or usage may be stale (research §3).
 */
export function useLimitError() {
  const current = useState<LimitInfo | null>('limit-dialog', () => null)

  function show(limit: LimitInfo) {
    current.value = limit
    void usePlanStore().load()
  }

  function handle(e: unknown): boolean {
    if (!isPortError(e, 'limit_reached')) return false
    show(e.limit ?? { key: 'unknown', value: null, usage: null })
    return true
  }

  return { current, show, handle, close: () => (current.value = null) }
}
