/**
 * Feature 005 (gaps G-A7): dictating into the script. Words are held as pending text (the editor shows them gray)
 * until the person confirms. They come from the speech provider when the plan has speech to text (`cloud`), otherwise
 * from the browser's own recognition (G-A5); both behave the same here. Stopping keeps the words; talking again adds
 * to them.
 */
import { DICTATION_LANGS, DICTATION_LANG_KEY, dictationLang, joinSpeech, type DictationLang } from '~/services/ai/recognition'

/** How long the soundbar stays lit after a new word, where only the words tell us the person is talking. */
const TALK_MS = 900
const TALK_LEVEL = 0.55

export function useScriptDictation(o: { cloud: () => boolean; direction: () => 'rtl' | 'ltr'; readOnly: () => boolean }) {
  const { t } = useI18n()
  const plan = usePlanStore()
  const { show } = useToast()
  const { errorCopy } = useAiText()

  const say = (title: string, text?: string) => show(text ? `${title}. ${text}` : title, 'error', 7000)

  // ----- the two sources -----
  const device = useDictation()
  const cloud = useLiveTranscription({
    maxMinutes: () => {
      const v = plan.limit('ai.audio_max_minutes')
      return typeof v === 'number' && v > 0 ? v : 60
    },
    onMicProblem: p => (p === 'denied' ? say(t('ai.speech.micDeniedTitle'), t('ai.speech.micDenied')) : say(t('ai.speech.micMissing'))),
    onError: (e) => {
      const c = errorCopy(e)
      say(c.title, c.text)
    },
    onDropped: () => say(t('ai.dictate.droppedTitle'), t('ai.dictate.dropped')),
    onAutoStop: () => show(t('ai.speech.autoStopped'), 'info'),
  })

  /** Chosen when talking starts, so a plan refresh can't swap the source mid-sentence. */
  const usingCloud = ref(false)
  const source = computed(() => (usingCloud.value ? cloud : device))

  const listening = computed(() => ['starting', 'listening'].includes(source.value.state.value))
  const finishing = computed(() => usingCloud.value && cloud.state.value === 'finishing')

  watch(device.state, (s) => {
    if (s === 'denied') say(t('ai.speech.micDeniedTitle'), t('ai.dictate.denied'))
    else if (s === 'missing') say(t('ai.speech.micMissing'))
    else if (s === 'offline') say(t('ai.dictate.offlineTitle'), t('ai.dictate.offline'))
    else if (s === 'unavailable') say(t('ai.dictate.unavailableTitle'), t('ai.dictate.unavailable'))
  })

  // ----- pending words -----
  /** Words from earlier turns of talking that are still waiting to be confirmed. */
  const kept = ref('')
  const text = computed(() => joinSpeech(kept.value, joinSpeech(source.value.finalText.value, source.value.liveText.value)))
  const active = computed(() => listening.value || finishing.value || !!text.value)

  // ----- soundbar -----
  // The browser's recognition gives no volume, so the microphone is opened a second time, only to measure it. Not on
  // phones and tablets, where a second use of the microphone can stop recognition: there the bar follows the words.
  const meter = useMediaDevices()
  const { level: meterLevel } = useLevelMeter(meter.stream)
  watch(() => !usingCloud.value && device.state.value === 'listening', async (on) => {
    if (!on) return meter.stop()
    if (matchMedia('(pointer: coarse)').matches) return
    await meter.start('audio')
    // Stopped while the microphone was opening.
    if (usingCloud.value || device.state.value !== 'listening') meter.stop()
  })
  const heard = ref(false)
  let quiet: ReturnType<typeof setTimeout> | undefined
  watch(() => device.text.value, (v) => {
    if (!v) return
    heard.value = true
    clearTimeout(quiet)
    quiet = setTimeout(() => (heard.value = false), TALK_MS)
  })
  const level = computed(() => {
    if (!listening.value) return 0
    if (usingCloud.value) return cloud.level.value
    return meter.stream.value ? meterLevel.value : heard.value ? TALK_LEVEL : 0
  })

  // ----- language -----
  function savedLang(): string | null {
    try {
      return localStorage.getItem(DICTATION_LANG_KEY)
    } catch {
      return null
    }
  }
  const chosen = ref<string | null>(import.meta.client ? savedLang() : null)
  const lang = computed<DictationLang>({
    get: () => dictationLang(o.direction(), chosen.value),
    set: (v) => {
      chosen.value = v
      try {
        localStorage.setItem(DICTATION_LANG_KEY, v)
      } catch {
        // Private mode: the choice lasts for this visit only.
      }
      if (!usingCloud.value) device.setLang(v)
    },
  })
  const langOptions = computed(() => DICTATION_LANGS.map(v => ({ value: v, label: t(`ai.dictate.langs.${v}`) })))

  // ----- actions -----
  function release() {
    device.cancel()
    cloud.cancel()
    device.finalText.value = ''
    device.liveText.value = ''
    kept.value = ''
    heard.value = false
  }

  function start() {
    if (o.readOnly() || listening.value || finishing.value) return
    const words = text.value
    release()
    kept.value = words
    usingCloud.value = o.cloud()
    if (usingCloud.value) void cloud.start(lang.value.startsWith('ar') ? 'ar' : 'en')
    else device.start(lang.value)
  }

  function toggle() {
    if (!listening.value) return start()
    if (usingCloud.value) void cloud.stop()
    else device.stop()
  }

  /** Stops listening and returns the words, leaving nothing pending. */
  async function take(): Promise<string> {
    if (usingCloud.value) await cloud.stop()
    const words = text.value
    release()
    return words
  }

  return { listening, finishing, active, level, usingCloud, text, lang, langOptions, toggle, take, discard: release }
}
