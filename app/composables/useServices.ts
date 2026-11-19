import type { Services } from '~/services/ports'

/** The data ports. Components and stores must not reach storage or the network any other way. */
export function useServices(): Services {
  return useNuxtApp().$services as Services
}
