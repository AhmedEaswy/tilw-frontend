import { defineStore } from 'pinia'
import { createLinkHost, linkStatus, type HostState, type LinkHost, type LinkPlayer } from '~/services/link/host'
import type { CommandType } from '~/services/types'

/**
 * Feature 004 (phone link), studio side: mirrors services/link/host.ts for the panel, the masthead indicator and the
 * reading pages. One link host for the whole studio session, so moving between rehearse, record and the library
 * keeps the link (spec edge case). Reset on sign-out.
 */
let host: LinkHost | null = null

export const useLinkStore = defineStore('link', () => {
  const state = shallowRef<HostState | null>(null)

  function h(): LinkHost {
    if (host) return host
    const services = useServices()
    host = createLinkHost({
      links: services.links,
      quietLinks: useNuxtApp().$servicesQuiet.links,
      relay: services.relay,
      realtime: services.realtime,
      tab: import.meta.client ? useHostTab() : undefined,
    })
    host.subscribe(s => (state.value = { ...s }))
    return host
  }

  const status = computed(() => (state.value ? linkStatus(state.value) : 'idle'))
  const link = computed(() => state.value?.link ?? null)
  const code = computed(() => state.value?.code ?? null)
  const pendingRemote = computed(() => state.value?.pendingRemote ?? null)
  /** US4: the Tilw app reads and this studio is the remote (Figma L7). */
  const studioIsRemote = computed(() => state.value?.phase === 'open' && state.value.link?.player === 'remote')

  return {
    state,
    status,
    link,
    code,
    pendingRemote,
    studioIsRemote,
    open: (scriptId: string) => {
      // FR-004: when the plan is known to exclude phone link, show the locked state and never start a link.
      if (usePlanStore().limit('phone_link.allowed') === false) return h().lock()
      return h().open(scriptId)
    },
    resume: (scriptId: string) => h().resume(scriptId),
    newCode: () => h().newCode(),
    setPreviews: (on: boolean) => h().setPreviews(on),
    end: () => h().end(),
    acceptRemote: () => h().acceptRemote(),
    declineRemote: () => h().declineRemote(),
    moveHere: (scriptId: string) => h().moveHere(scriptId),
    requestRoles: (player: 'host' | 'remote') => h().requestRoles(player),
    answerRoles: (accept: boolean) => h().answerRoles(accept),
    send: (type: CommandType, extra?: { paragraph?: number; wpm?: number }) => h().send(type, extra),
    setPlayer: (p: LinkPlayer | null) => h().setPlayer(p),
    clearPlayer: (p: LinkPlayer) => host?.clearPlayer(p),
    changed: () => host?.changed(),
    flush: () => host?.flush() ?? Promise.resolve(),
    reset: () => host?.reset(),
  }
})
