/**
 * Camera and microphone access for the recording studio (US6, T070). Devices are requested only when the
 * user presses the enable button (constitution IV). Exposes the live stream, the device lists (labels are
 * only available after permission), and the current selection. A track that ends on its own (device
 * unplugged, permission revoked) is reported through `onLost`.
 */
export type MediaKind = 'audio' | 'video'
export type MediaState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'

export function useMediaDevices(opts: { onLost?: () => void } = {}) {
  const state = ref<MediaState>('idle')
  const stream = shallowRef<MediaStream | null>(null)
  const kind = ref<MediaKind>('video')
  const mics = ref<MediaDeviceInfo[]>([])
  const cams = ref<MediaDeviceInfo[]>([])
  const micId = ref<string>('')
  const camId = ref<string>('')

  const supported = computed(() => import.meta.client && !!navigator.mediaDevices?.getUserMedia)

  async function refreshDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      mics.value = all.filter(d => d.kind === 'audioinput')
      cams.value = all.filter(d => d.kind === 'videoinput')
    } catch {
      /* keep the previous lists */
    }
  }

  function stopTracks(s: MediaStream | null) {
    s?.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
  }

  function stop() {
    stopTracks(stream.value)
    stream.value = null
    if (state.value === 'ready' || state.value === 'requesting') state.value = 'idle'
  }

  /** Ask for the devices of `k`, or switch to other devices while already running. */
  async function start(k: MediaKind = kind.value) {
    kind.value = k
    if (!supported.value) {
      state.value = 'unavailable'
      return false
    }
    state.value = 'requesting'
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: micId.value ? { exact: micId.value } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: k === 'video'
        ? { deviceId: camId.value ? { exact: camId.value } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia(constraints)
      stopTracks(stream.value)
      stream.value = next
      next.getTracks().forEach((t) => {
        t.onended = () => {
          if (stream.value === next) opts.onLost?.()
        }
      })
      const a = next.getAudioTracks()[0]?.getSettings().deviceId
      const v = next.getVideoTracks()[0]?.getSettings().deviceId
      if (a) micId.value = a
      if (v) camId.value = v
      await refreshDevices()
      state.value = 'ready'
      return true
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') state.value = 'denied'
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        // The remembered device is gone: retry once with the defaults.
        if (micId.value || camId.value) {
          micId.value = ''
          camId.value = ''
          return start(k)
        }
        state.value = 'unavailable'
      } else state.value = 'error'
      return false
    }
  }

  async function selectMic(id: string) {
    micId.value = id
    if (state.value === 'ready') await start()
  }
  async function selectCam(id: string) {
    camId.value = id
    if (state.value === 'ready') await start()
  }

  function onDeviceChange() {
    void refreshDevices()
  }
  onMounted(() => navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange))
  onBeforeUnmount(() => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
    stop()
  })

  return { state, stream, kind, mics, cams, micId, camId, supported, start, stop, selectMic, selectCam }
}
