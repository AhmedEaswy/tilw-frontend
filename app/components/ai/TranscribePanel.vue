<script setup lang="ts">
/**
 * Feature 005 (A3 confirm/working `295:356`, A4 cost `295:428`, A5 cost/working `295:482`): the part every speech
 * flow shares. Shows the length, cost and balance, the language, that own keys don't apply to speech and that audio
 * goes straight to the provider, before anything is spent (US3 #2, US4 #8). Then runs the transcription with its
 * steps and hands the result over. Failures say what happens to the credits without promising a refund (spec
 * clarification 5).
 */
import type { SpeechLanguage, SpeechPurpose, TranscriptionEstimate } from '~/services/types'
import { declaredSeconds, clockLabel } from '~/services/ai/audio'
import { canPay } from '~/services/ai/errors'
import { runTranscription, type TranscribeRun, type TranscribeStep } from '~/services/ai/transcribe'

const props = defineProps<{
  blob: Blob
  seconds: number
  purpose: SpeechPurpose
  /** Extra rows shown first (file name, take). */
  rows?: { label: string; value: string }[]
  goKey?: string
  cancelLabel?: string
  /** Steps shown before the run's own (captions: preparing the take's audio). */
  extraSteps?: { key: string; label: string }[]
  /** After the run (captions: building the files). */
  afterStep?: string
}>()
const emit = defineEmits<{ done: [run: TranscribeRun]; cancel: []; busy: [boolean] }>()
const { t } = useI18n()
const ai = useAiStore()
const plan = usePlanStore()
const upgrade = useUpgrade()
const services = useServices()
const { credits, errorCopy, copyFor } = useAiText()

const LANG_KEY = 'tilw:ai:language'
const language = ref<SpeechLanguage>((import.meta.client && (localStorage.getItem(LANG_KEY) as SpeechLanguage | null)) || 'auto')
watch(language, (l) => {
  try {
    localStorage.setItem(LANG_KEY, l)
  } catch { /* not important */ }
})

const seconds = computed(() => declaredSeconds(props.seconds))
const estimate = ref<TranscriptionEstimate | null>(null)
const phase = ref<'cost' | 'working' | 'error'>('cost')
const step = ref<TranscribeStep>('permission')
const error = ref<{ title: string; text: string } | null>(null)
const live = ref('')

async function loadEstimate() {
  error.value = null
  phase.value = 'cost'
  try {
    estimate.value = await services.ai.transcriptionEstimate({ seconds: seconds.value, bytes: props.blob.size, mimeType: props.blob.type || 'audio/webm' })
    ai.setBalance(estimate.value.balance)
  } catch (e) {
    error.value = errorCopy(e)
    phase.value = 'error'
  }
}
onMounted(loadEstimate)

const short = computed(() => {
  const e = estimate.value
  if (!e || canPay(e.balance, e.credits)) return null
  return copyFor(e.balance < 0 ? 'negative' : 'credits', { balance: e.balance, cost: e.credits })
})

async function go() {
  if (!estimate.value) return
  phase.value = 'working'
  emit('busy', true)
  live.value = t('ai.speech.working')
  try {
    const run = await runTranscription({
      ai: services.ai,
      speech: services.speech,
      blob: props.blob,
      seconds: seconds.value,
      language: language.value,
      purpose: props.purpose,
      onStep: (s) => {
        step.value = s
        if (s !== 'done') live.value = t(`ai.speech.steps.${s}`)
      },
    })
    ai.refreshCredits()
    if (run.transcription.state === 'failed') {
      fail(copyFor('provider_failed'))
      return
    }
    const nothing = props.purpose === 'captions' ? !run.result.words.length : !run.result.transcript.trim()
    if (nothing) {
      fail(copyFor('nothing_heard'))
      return
    }
    emit('done', run)
  } catch (e) {
    ai.refreshCredits()
    fail(errorCopy(e))
  } finally {
    emit('busy', false)
  }
}
function fail(copy: { title: string; text: string }) {
  error.value = copy
  phase.value = 'error'
  live.value = copy.title
}

const steps = computed(() => [
  ...(props.extraSteps ?? []).map(s => ({ ...s, state: 'done' as const })),
  ...(['permission', 'sending', 'settling'] as const).map((k, i, all) => {
    const at = all.indexOf(step.value as typeof all[number])
    const cur = step.value === 'done' ? all.length : at
    return { key: k, label: t(`ai.speech.steps.${k}`), state: i < cur ? 'done' as const : i === cur ? 'now' as const : 'todo' as const }
  }),
  ...(props.afterStep ? [{ key: 'after', label: props.afterStep, state: step.value === 'done' ? 'now' as const : 'todo' as const }] : []),
])
const langOptions = computed(() => (['auto', 'ar', 'en'] as const).map(v => ({ value: v, label: t(`ai.common.lang.${v}`) })))
</script>

<template>
  <div class="tp" data-testid="transcribe-panel">
    <p class="visually-hidden" aria-live="polite">{{ live }}</p>

    <template v-if="phase === 'cost'">
      <dl class="rows">
        <div v-for="r in rows ?? []" :key="r.label"><dt>{{ r.label }}</dt><dd dir="auto">{{ r.value }}</dd></div>
        <div><dt>{{ t('ai.speech.length') }}</dt><dd dir="ltr">{{ clockLabel(seconds) }}</dd></div>
        <div><dt>{{ t('ai.speech.cost') }}</dt><dd data-testid="transcribe-cost">{{ estimate ? credits(estimate.credits) : '…' }}</dd></div>
        <div><dt>{{ t('ai.speech.balance') }}</dt><dd dir="ltr" data-testid="transcribe-balance">{{ estimate?.balance ?? '…' }}</dd></div>
      </dl>
      <UiSegmented v-model="language" :label="t('ai.common.language')" :options="langOptions" />
      <p class="note">{{ t('ai.common.ownKeyNoSpeech') }}</p>
      <p class="note">{{ t('ai.common.privacy') }}</p>
      <AiMessage v-if="short" :title="short.title" :text="short.text" data-testid="transcribe-short">
        <template #actions>
          <UiButton v-if="!plan.isPro" size="sm" @click="upgrade.open()">{{ t('ai.common.upgrade') }}</UiButton>
        </template>
      </AiMessage>
      <div class="acts">
        <UiButton :disabled="!estimate || !!short" data-testid="transcribe-go" @click="go">{{ t(goKey ?? 'ai.speech.go', { cost: credits(estimate?.credits ?? 1) }) }}</UiButton>
        <UiButton tone="secondary" @click="emit('cancel')">{{ cancelLabel ?? t('ai.common.cancel') }}</UiButton>
      </div>
    </template>

    <template v-else-if="phase === 'working'">
      <ol class="steps" aria-busy="true">
        <li v-for="s in steps" :key="s.key" :class="s.state">
          <UiGlyph v-if="s.state === 'done'" name="check" :size="18" />
          <i v-else aria-hidden="true" />
          <span>{{ s.label }}</span>
        </li>
      </ol>
      <p class="note">{{ t('ai.common.privacy') }}</p>
    </template>

    <template v-else-if="error">
      <AiMessage :title="error.title" :text="error.text" tone="error" data-testid="transcribe-error">
        <template #actions>
          <UiButton tone="secondary" @click="emit('cancel')">{{ t('ai.common.close') }}</UiButton>
        </template>
      </AiMessage>
    </template>
  </div>
</template>

<style scoped>
.tp {
  display: grid;
  gap: 14px;
}
.rows {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 16px;
  border-radius: 10px;
  background: var(--tilw-surface-white);
}
.rows > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
dt,
.note {
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
dd {
  margin: 0;
  font: 500 16px/1.5 var(--tilw-font-ar);
  text-align: end;
}
.note {
  margin: 0;
  font-size: 13px;
}
.acts {
  display: grid;
  gap: 10px;
}
.steps {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tilw-text-ink);
  font: 400 16px/1.5 var(--tilw-font-ar);
}
.steps li.todo {
  color: var(--tilw-text-muted);
}
.steps li.now {
  font-weight: 500;
}
.steps i {
  inline-size: 12px;
  block-size: 12px;
  margin-inline: 3px;
  border-radius: 50%;
  background: var(--tilw-border-strong);
}
.steps li.now i {
  background: var(--tilw-action-primary);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  50% { opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .steps li.now i { animation: none; }
}
</style>
