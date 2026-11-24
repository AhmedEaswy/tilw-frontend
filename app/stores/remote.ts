import { defineStore } from 'pinia'
import { createLinkRemote, localPairingStore, type LinkRemoteClient, type RemoteState } from '~/services/link/remote'
import type { CommandType } from '~/services/types'

/** A short, recognisable name for the studio's panel ("iPhone", "Android phone"…). Nothing else about the phone. */
function phoneName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet'
  return 'Phone browser'
}

/**
 * Feature 004 (phone link), phone side: mirrors services/link/remote.ts for pages/remote.vue. The phone has no
 * account; it only keeps the pairing needed to reconnect (research R9).
 */
let client: LinkRemoteClient | null = null

export const useRemoteStore = defineStore('remote', () => {
  const state = shallowRef<RemoteState | null>(null)

  function c(): LinkRemoteClient {
    if (client) return client
    const services = useServices()
    client = createLinkRemote({
      relay: services.relay,
      realtime: services.realtime,
      store: localPairingStore(),
      deviceName: phoneName(),
    })
    client.subscribe(s => (state.value = { ...s }))
    return client
  }

  return {
    state,
    start: (secret?: string | null) => c().start(secret),
    pairWithCode: (code: string) => c().pairWithCode(code),
    send: (type: CommandType, extra?: { paragraph?: number; wpm?: number }) => c().send(type, extra),
    leave: () => c().leave(),
    wake: () => c().wake(),
    again: () => c().again(),
  }
})
