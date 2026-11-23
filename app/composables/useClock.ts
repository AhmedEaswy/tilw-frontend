import type { MockBackend } from '~/services/mock'

/** "Now" as the services see it: the mock's clock can be moved from /__mock; the real service uses real time. */
export function useClock(): () => number {
  const mock = useNuxtApp().$mock as MockBackend | null
  return mock ? () => mock.knobs.now() : () => Date.now()
}
