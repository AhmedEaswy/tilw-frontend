/**
 * Feature 005, gaps G-A5: dictation with the browser's own speech recognition (services/ai/recognition.ts). No audio
 * is recorded by Tilw and nothing is charged. The microphone prompt comes from the browser on `start()` (the person's
 * Dictate action), never before.
 *
 * `cancel()` (closing the dialog, leaving the page) aborts the current run, including one still waiting on the
 * microphone prompt: its late events are ignored. Changing the language while listening keeps the text so far and
 * listens on in the new language.
 */
import { createRecognizer, joinSpeech, recognitionSupported, type RecognitionProblem, type Recognizer } from '~/services/ai/recognition'

export type DictationState = 'idle' | 'starting' | 'listening' | 'done' | RecognitionProblem

export function useDictation() {
  const supported = ref(false)
  onMounted(() => (supported.value = recognitionSupported()))
  const state = ref<DictationState>('idle')
  const finalText = ref('')
  const liveText = ref('')
  const text = computed(() => joinSpeech(finalText.value, liveText.value))
  let rec: Recognizer | null = null
  /** Text kept from earlier runs (a language change starts a new run). */
  let kept = ''

  function run(lang: string) {
    const mine = createRecognizer({
      lang,
      onListening: () => {
        if (rec === mine) state.value = 'listening'
      },
      onText: (f, l) => {
        if (rec !== mine) return
        finalText.value = joinSpeech(kept, f)
        liveText.value = l
      },
      onEnd: (p) => {
        if (rec !== mine) return
        rec = null
        liveText.value = ''
        state.value = p ?? 'done'
      },
    })
    rec = mine
    mine.start()
  }

  function start(lang: string) {
    cancel()
    kept = ''
    finalText.value = ''
    liveText.value = ''
    state.value = 'starting'
    run(lang)
  }

  function setLang(lang: string) {
    if (!rec || (state.value !== 'listening' && state.value !== 'starting')) return
    const old = rec
    kept = joinSpeech(kept, old.text)
    rec = null
    old.abort()
    finalText.value = kept
    liveText.value = ''
    run(lang)
  }

  function stop() {
    if (rec) rec.stop()
    else if (state.value === 'starting' || state.value === 'listening') state.value = 'done'
  }

  function cancel() {
    const r = rec
    rec = null
    r?.abort()
    if (state.value === 'starting' || state.value === 'listening') state.value = 'idle'
  }

  onBeforeUnmount(cancel)

  return { supported, state, finalText, liveText, text, start, stop, cancel, setLang }
}
