<script setup lang="ts">
/**
 * Feature 005, US3 (A3 `295:356`: recording, confirm cost, working, microphone refused). The microphone is asked for
 * when the dialog opens from the Dictate action, never before. Stop shows the cost (TranscribePanel); the text is
 * handed to the editor, which inserts it at the cursor as one undo step. Discarding the recording costs nothing.
 */
import type { TranscribeRun } from '~/services/ai/transcribe'
import { checkAudio, clockLabel } from '~/services/ai/audio'
import type { FinishedTake } from '~/composables/useRecorder'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ insert: [text: string] }>()
const { t } = useI18n()
const plan = usePlanStore()
const { show } = useToast()

const maxMinutes = () => {
  const v = plan.limit('ai.audio_max_minutes')
  return typeof v === 'number' && v > 0 ? v : 60
}
const phase = ref<'starting' | 'denied' | 'missing' | 'recording' | 'confirm' | 'refused'>('starting')
const take = shallowRef<{ blob: Blob; seconds: number } | null>(null)
const refused = ref('')
const busy = ref(false)

const dictation = useDictation({ maxMinutes, onAutoStop: t2 => void onStopped(t2, true) })

async function begin() {
  phase.value = 'starting'
  take.value = null
  const ok = await dictation.start()
  // Closed while the permission prompt was up: the run was cancelled and its tracks stopped.
  if (!open.value) return
  if (ok) {
    phase.value = 'recording'
    return
  }
  phase.value = dictation.state.value === 'denied' ? 'denied' : 'missing'
}

async function stop() {
  const t2 = await dictation.stop()
  if (t2) await onStopped(t2, false)
}

async function onStopped(t2: FinishedTake, auto: boolean) {
  dictation.cancel()
  if (auto) show(t('ai.speech.autoStopped'), 'info')
  const read = await readAudioLength(t2.blob)
  const seconds = read ?? t2.durationMs / 1000
  const problem = checkAudio({ type: t2.blob.type || t2.mimeType, size: t2.blob.size }, seconds, maxMinutes())
  if (problem) {
    refused.value = t(`ai.speech.refused.${problem.reason}`, { maxMb: 200, maxMinutes: maxMinutes() })
    phase.value = 'refused'
    return
  }
  take.value = { blob: t2.blob, seconds }
  phase.value = 'confirm'
}

function done(run: TranscribeRun) {
  emit('insert', run.result.transcript)
  close()
}
function close() {
  dictation.cancel()
  take.value = null
  open.value = false
}

watch(open, (v) => {
  if (v) void begin()
  else dictation.cancel()
}, { immediate: true })

const title = computed(() => (phase.value === 'confirm' ? t('ai.speech.confirmTitle') : phase.value === 'denied' ? t('ai.speech.micDeniedTitle') : t('ai.speech.dictateTitle')))
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :dismissible="!busy" data-testid="dictate-dialog" @close="close">
    <div class="dd">
      <template v-if="phase === 'starting'">
        <p class="muted" aria-busy="true">{{ t('ai.speech.starting') }}</p>
      </template>
      <template v-else-if="phase === 'denied' || phase === 'missing'">
        <AiMessage :title="phase === 'denied' ? t('ai.speech.micDeniedTitle') : t('ai.speech.micMissing')" :text="phase === 'denied' ? t('ai.speech.micDenied') : undefined" tone="error" />
      </template>
      <template v-else-if="phase === 'recording'">
        <p class="live"><i aria-hidden="true" />{{ t('ai.speech.recordingLive') }}</p>
        <b class="timer" dir="ltr" role="timer" aria-live="off">{{ clockLabel(dictation.elapsedMs.value / 1000) }}</b>
        <LevelMeter :level="dictation.level.value" size="md" />
        <p class="muted">{{ t('ai.speech.recordingNote', { minutes: maxMinutes() }) }}</p>
      </template>
      <template v-else-if="phase === 'refused'">
        <AiMessage :title="t('ai.speech.refusedTitle')" :text="`${refused} ${t('ai.speech.noCharge')}`" tone="error" />
      </template>
      <TranscribePanel
        v-else-if="phase === 'confirm' && take"
        :blob="take.blob"
        :seconds="take.seconds"
        purpose="text"
        :cancel-label="t('ai.speech.discardRecording')"
        @busy="b => (busy = b)"
        @done="done"
        @cancel="close"
      />
    </div>
    <template v-if="phase !== 'confirm'" #actions>
      <UiButton v-if="phase === 'recording'" icon="stop" data-testid="dictate-stop" @click="stop">{{ t('ai.speech.stop') }}</UiButton>
      <UiButton tone="secondary" @click="close">{{ phase === 'recording' || phase === 'starting' ? t('ai.common.cancel') : t('ai.common.close') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.dd {
  display: grid;
  gap: 14px;
}
.muted {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.6 var(--tilw-font-ar);
}
.live {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tilw-status-error);
  font: 500 15px/1.4 var(--tilw-font-ar);
}
.live i {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: currentColor;
}
.timer {
  justify-self: start;
  font: 700 44px/1.2 var(--tilw-font-lat);
}
</style>
