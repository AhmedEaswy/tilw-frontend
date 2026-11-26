/**
 * Feature 005 (gaps G-A7): dictation through the speech provider, live. The microphone is asked for first, so nothing
 * is charged when it is refused; then a permission is paid for one minute and the audio streams straight to the
 * provider while words come back. Stopping reports the provider's request id and the service settles on the real length.
 *
 * `stop()` and `cancel()` may come while `start()` still waits (permission prompt, permission request): each run has a
 * number, and a run that is no longer current releases the microphone and sends nothing.
 */
import type { LiveSpeech } from '~/services/ports'
import { settleTranscription } from '~/services/ai/transcribe'
import { joinSpeech } from '~/services/ai/recognition'

export type LiveState = 'idle' | 'starting' | 'listening' | 'finishing' | 'done'

/** The service looks for the provider's record ten minutes after the permission: a stream must have ended by then. */
const LONGEST_SECONDS = 9 * 60
/** What is paid up front; the service charges or refunds the difference when it settles. */
const DECLARED_SECONDS = 60

export function useLiveTranscription(o: {
  maxMinutes: () => number
  /** The microphone was refused or is missing. */
  onMicProblem: (problem: 'denied' | 'missing') => void
  /** The permission or the stream failed. */
  onError: (e: unknown) => void
  onDropped: () => void
  onAutoStop: () => void
}) {
  const services = useServices()
  const ai = useAiStore()
  const devices = useMediaDevices()
  const { level } = useLevelMeter(devices.stream)

  const state = ref<LiveState>('idle')
  const finalText = ref('')
  const liveText = ref('')

  let run = 0
  let session: { id: string; live: LiveSpeech; recorder: MediaRecorder; startedAt: number } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  async function start(language: 'ar' | 'en') {
    const mine = ++run
    state.value = 'starting'
    finalText.value = ''
    liveText.value = ''

    const ok = await devices.start('audio')
    if (mine !== run) return devices.stop()
    const stream = devices.stream.value
    if (!ok || !stream) {
      state.value = 'idle'
      return o.onMicProblem(devices.state.value === 'denied' ? 'denied' : 'missing')
    }

    let id = ''
    try {
      const mime = pickRecorderMime('audio')
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      const permission = await services.ai.startTranscription({
        seconds: DECLARED_SECONDS,
        bytes: DECLARED_SECONDS * 6000,
        mimeType: recorder.mimeType || mime || 'audio/webm',
        language,
        purpose: 'text',
      })
      id = permission.id
      ai.setBalance(permission.balance)
      if (mine !== run) {
        devices.stop()
        await services.ai.fail(id, 'cancelled').catch(() => {})
        return
      }
      const live = services.speech.live(permission.upload, {
        language,
        onText: (f, l) => {
          if (session?.live !== live) return
          finalText.value = f
          liveText.value = l
        },
        onDrop: () => {
          if (session?.live !== live) return
          void stop()
          o.onDropped()
        },
      })
      recorder.ondataavailable = (e) => {
        if (e.data.size) live.send(e.data)
      }
      session = { id, live, recorder, startedAt: Date.now() }
      recorder.start(250)
      state.value = 'listening'
      timer = setTimeout(() => {
        void stop()
        o.onAutoStop()
      }, Math.min(LONGEST_SECONDS, o.maxMinutes() * 60) * 1000)
    } catch (e) {
      devices.stop()
      if (id) void services.ai.fail(id, 'error').catch(() => {})
      if (mine !== run) return
      session = null
      state.value = 'idle'
      o.onError(e)
    }
  }

  /** Ends the stream and waits for the last words. */
  async function stop(): Promise<void> {
    const s = session
    if (!s || state.value !== 'listening') {
      if (state.value === 'starting') {
        run++
        devices.stop()
        state.value = 'idle'
      }
      return stopping
    }
    clearTimeout(timer)
    state.value = 'finishing'
    stopping = (async () => {
      // The recorder hands over its last piece before `stop` fires.
      await new Promise<void>((resolve) => {
        s.recorder.onstop = () => resolve()
        try {
          s.recorder.stop()
        } catch {
          resolve()
        }
      })
      devices.stop()
      const requestId = await s.live.finish(Math.max(1, Math.ceil((Date.now() - s.startedAt) / 1000)))
      if (session === s) {
        finalText.value = joinSpeech(finalText.value, liveText.value)
        liveText.value = ''
        session = null
        state.value = 'done'
      }
      // Settling may take retries; the words don't wait for it.
      void settleTranscription({ ai: services.ai, id: s.id, requestId }).then(() => ai.refreshCredits())
    })()
    return stopping
  }
  let stopping: Promise<void> = Promise.resolve()

  /** Throws the words away. What was already heard is still settled. */
  function cancel() {
    void stop()
    run++
    session = null
    finalText.value = ''
    liveText.value = ''
    state.value = 'idle'
  }

  onBeforeUnmount(cancel)

  return { state, finalText, liveText, level, start, stop, cancel }
}
