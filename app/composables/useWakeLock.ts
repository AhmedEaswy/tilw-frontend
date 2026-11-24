/**
 * Feature 004 (US2, T034): keep the phone's screen on while it drives the studio, so the remote doesn't sleep in the
 * middle of a take. The browser drops the lock whenever the page is hidden, so it is asked for again when the page is
 * visible. Where the Screen Wake Lock API is missing (or refused), nothing happens: the remote still works.
 */
interface WakeLockSentinelLike { released: boolean; release(): Promise<void> }
interface WakeLockLike { request(type: 'screen'): Promise<WakeLockSentinelLike> }

export function useWakeLock(active: () => boolean) {
  let sentinel: WakeLockSentinelLike | null = null
  const api = (): WakeLockLike | null =>
    (typeof navigator !== 'undefined' && 'wakeLock' in navigator ? (navigator as unknown as { wakeLock: WakeLockLike }).wakeLock : null)

  async function acquire() {
    const wl = api()
    if (!wl || !active() || document.visibilityState !== 'visible') return
    if (sentinel && !sentinel.released) return
    try {
      sentinel = await wl.request('screen')
    } catch {
      sentinel = null // refused (battery saver, no user gesture yet): carry on without it
    }
  }
  function release() {
    const s = sentinel
    sentinel = null
    if (s && !s.released) void s.release().catch(() => {})
  }
  const onVisible = () => { if (document.visibilityState === 'visible') void acquire() }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisible)
    watch(active, on => (on ? void acquire() : release()), { immediate: true })
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    release()
  })
}
