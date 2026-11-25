import { defineStore } from 'pinia'
import type { TakeMeta } from '~/services/takes'

/**
 * Floating mini player (YouTube-style). One media element, owned by `<MiniPlayer>`, plays a take while the
 * person keeps using the app. A take starts here from the header's recordings menu, from the take page's
 * "mini player" button, or by leaving the take page while it plays. Opening the take page of the take that is
 * playing hands the file and position back to the page player, so playback carries on without reloading.
 *
 * The store owns the object URL while the take is here; `handOff()` passes ownership to the caller.
 */
export interface PlayerStart {
  /** Position in seconds to start from. */
  at?: number
  autoplay?: boolean
  /** An object URL the caller already made for this take; the store takes ownership of it. */
  src?: string | null
}

export const usePlayerStore = defineStore('player', () => {
  const take = ref<TakeMeta | null>(null)
  const src = ref<string | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const playing = ref(false)
  const current = ref(0)
  const duration = ref(0)
  const seekable = ref(false)
  /** Applied once the media element knows its duration. */
  const pending = ref<{ at: number; autoplay: boolean } | null>(null)
  /** Registered by `<MiniPlayer>`. */
  const el = shallowRef<HTMLMediaElement | null>(null)
  let token = 0

  function revoke() {
    if (src.value) URL.revokeObjectURL(src.value)
    src.value = null
  }

  function reset() {
    el.value?.pause()
    take.value = null
    status.value = 'idle'
    playing.value = false
    current.value = 0
    duration.value = 0
    seekable.value = false
    pending.value = null
  }

  async function play(t: TakeMeta, opts: PlayerStart = {}) {
    const my = ++token
    const same = take.value?.id === t.id && !!src.value && !opts.src
    if (same) {
      if (opts.at !== undefined) seek(opts.at)
      if (opts.autoplay !== false) resume()
      return
    }
    el.value?.pause()
    revoke()
    take.value = t
    playing.value = false
    current.value = opts.at ?? 0
    duration.value = t.durationMs / 1000
    seekable.value = false
    pending.value = { at: opts.at ?? 0, autoplay: opts.autoplay !== false }
    if (opts.src) {
      src.value = opts.src
      status.value = 'ready'
      return
    }
    status.value = 'loading'
    try {
      const blob = await useTakesStore().blobFor(t.id)
      if (my !== token) return
      if (!blob) throw new Error('missing')
      src.value = URL.createObjectURL(blob)
      status.value = 'ready'
    } catch {
      if (my === token) status.value = 'error'
    }
  }

  async function playId(id: string, opts: PlayerStart = {}) {
    const takes = useTakesStore()
    if (!takes.loaded) await takes.load()
    const t = takes.find(id)
    if (t) await play(t, opts)
  }

  function resume() {
    void el.value?.play().catch(() => {})
  }
  function pause() {
    el.value?.pause()
  }
  function toggle() {
    const m = el.value
    if (!m || status.value !== 'ready') return
    if (m.paused) resume()
    else pause()
  }
  function seek(s: number) {
    const m = el.value
    if (!m) return
    const to = Math.max(0, Math.min(s, duration.value || s))
    if (!seekable.value) {
      if (pending.value) pending.value.at = to
      return
    }
    m.currentTime = to
    current.value = to
  }
  function skip(by: number) {
    seek(current.value + by)
  }

  /** Stop and clear the player. */
  function close() {
    token++
    reset()
    revoke()
  }

  /**
   * Give the playing take to a page player: returns the object URL (now owned by the caller), position and
   * whether it was playing, then clears the mini player. Null when another take (or nothing) is here.
   */
  function handOff(id: string): { src: string; at: number; playing: boolean } | null {
    if (take.value?.id !== id || !src.value) return null
    const out = { src: src.value, at: el.value?.currentTime ?? current.value, playing: playing.value }
    token++
    src.value = null // ownership moves to the caller
    reset()
    return out
  }

  return {
    take, src, status, playing, current, duration, seekable, pending, el,
    play, playId, resume, pause, toggle, seek, skip, close, handOff,
  }
})
