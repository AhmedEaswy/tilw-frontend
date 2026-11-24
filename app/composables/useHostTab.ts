/**
 * Feature 004 (research R8): only one studio tab hosts a phone link, so a command is never applied twice.
 * The tab holds the Web Lock `tilw-link-host`; another tab asks it to let go over BroadcastChannel('tilw-link').
 * Without Web Locks (old browsers) every tab may host, as before release 2.
 */
import type { HostTab } from '~/services/link/host'

const LOCK = 'tilw-link-host'
const CHANNEL = 'tilw-link'

let instance: HostTab | null = null

export function useHostTab(): HostTab {
  if (instance) return instance
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  let release: (() => void) | null = null
  const releaseCbs = new Set<() => void>()

  channel?.addEventListener('message', (e: MessageEvent<{ kind: string }>) => {
    if (e.data?.kind !== 'release' || !release) return
    releaseCbs.forEach(cb => cb())
    tab.release()
  })

  function request(wait: boolean, signal?: AbortSignal): Promise<boolean> {
    if (!locks) return Promise.resolve(true)
    if (release) return Promise.resolve(true)
    return new Promise((resolve) => {
      void locks.request(LOCK, wait ? { signal } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false)
          return undefined
        }
        resolve(true)
        // Held until release() is called (or the tab closes).
        return new Promise<void>(r => (release = r))
      }).catch(() => resolve(false)) // aborted while queued
    })
  }

  const tab: HostTab = {
    acquire: () => request(false),
    release() {
      release?.()
      release = null
    },
    onReleaseRequested(cb) {
      releaseCbs.add(cb)
      return () => { releaseCbs.delete(cb) }
    },
    async takeOver() {
      channel?.postMessage({ kind: 'release' })
      // Wait for the holder to let go (it does so as soon as it hears the message).
      // A queued request that outlives the wait is withdrawn, so this tab never ends up holding the lock unused.
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 3000)
      const ok = await request(true, ac.signal)
      clearTimeout(timer)
      return ok
    },
  }
  instance = tab
  return tab
}
