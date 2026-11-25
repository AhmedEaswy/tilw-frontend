import { onScopeDispose, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * True once `busy` has stayed true for `ms`, false as soon as it goes false. For waits that are often instant (a
 * search keystroke, a filter switch answered from a fast service), so a skeleton only shows when there is really
 * something to wait for instead of flashing for a frame.
 */
export function useSkeletonDelay(busy: WatchSource<boolean>, ms = 150): Ref<boolean> {
  const shown = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(busy, (on) => {
    clearTimeout(timer)
    if (!on) {
      shown.value = false
      return
    }
    timer = setTimeout(() => (shown.value = true), ms)
  }, { immediate: true })
  onScopeDispose(() => clearTimeout(timer))
  return shown
}
