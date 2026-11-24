/**
 * Feature 004 (research R6): a reading page lends its reader (and, on the record page, its recorder) to the phone
 * link. `apply` must use the same functions as the page's own buttons and shortcuts, so a command from the phone
 * behaves exactly like a press in the studio. Call `changed()` whenever something the phone shows changes.
 */
import type { LinkPlayer } from '~/services/link/host'

export function useLinkPlayer(player: LinkPlayer | (() => LinkPlayer)) {
  const link = useLinkStore()
  const get = typeof player === 'function' ? player : () => player
  // A stable object whose methods always read the page's current values.
  const proxy: LinkPlayer = {
    get scriptId() { return get().scriptId },
    apply: cmd => get().apply(cmd),
    snapshot: () => get().snapshot(),
  }
  onMounted(() => link.setPlayer(proxy))
  onBeforeUnmount(() => link.clearPlayer(proxy))
  return { changed: () => link.changed() }
}
