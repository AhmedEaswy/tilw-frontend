<script setup lang="ts">
/**
 * Feature 005, US5 (A5 `295:482`: cost, working, ready). Captions for a take: the take's audio (from this browser, or
 * first fetched from Drive for a Drive-only take) goes straight to the speech provider, and the SRT and VTT files are
 * built here from the word timings (services/ai/captions.ts). Nothing but the length and request id reaches Tilw.
 */
import type { TakeMeta } from '~/services/takes'
import type { TranscribeRun } from '~/services/ai/transcribe'
import { buildCues, toSrt, toVtt } from '~/services/ai/captions'
import { checkAudio } from '~/services/ai/audio'
import type { CaptionCue } from '~/services/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ take: TakeMeta; title: string }>()
const { t } = useI18n()
const takes = useTakesStore()
const plan = usePlanStore()
const { show } = useToast()

const blob = shallowRef<Blob | null>(null)
const phase = ref<'loading' | 'missing' | 'cost' | 'ready' | 'refused'>('loading')
const refused = ref('')
const cues = ref<CaptionCue[]>([])
const busy = ref(false)
const maxMinutes = () => {
  const v = plan.limit('ai.audio_max_minutes')
  return typeof v === 'number' && v > 0 ? v : 60
}
const seconds = computed(() => props.take.durationMs / 1000)

watch(open, async (v) => {
  if (!v) return
  phase.value = 'loading'
  cues.value = []
  try {
    blob.value = await takes.blobFor(props.take.id)
  } catch {
    blob.value = null
  }
  if (!blob.value) {
    phase.value = 'missing'
    return
  }
  // The same checks as any audio (type, 200 MB, length) before anything is spent.
  const problem = checkAudio({ type: blob.value.type || props.take.mimeType, size: blob.value.size }, seconds.value, maxMinutes(), 'captions')
  if (problem) {
    refused.value = t(`ai.speech.refused.${problem.reason}`, { maxMb: 'maxMb' in problem ? problem.maxMb : 200, maxMinutes: 'maxMinutes' in problem ? problem.maxMinutes : maxMinutes() })
    phase.value = 'refused'
    return
  }
  phase.value = 'cost'
}, { immediate: true })

function done(run: TranscribeRun) {
  cues.value = buildCues(run.result.words, { utteranceBreaks: run.result.utteranceBreaks, audioEnd: run.result.duration ?? seconds.value })
  phase.value = 'ready'
}

function save(kind: 'srt' | 'vtt') {
  const text = kind === 'srt' ? toSrt(cues.value) : toVtt(cues.value)
  downloadBlob(new Blob([text], { type: kind === 'srt' ? 'text/plain;charset=utf-8' : 'text/vtt;charset=utf-8' }), safeFileName(props.title, kind))
  show(t('library.downloaded'))
}
</script>

<template>
  <UiDialog v-model:open="open" :title="phase === 'ready' ? t('ai.captions.readyTitle') : t('ai.captions.title')" :dismissible="!busy" data-testid="captions-dialog">
    <div class="cap">
      <p v-if="phase === 'loading'" class="muted" aria-busy="true">{{ t('ai.captions.preparing') }}</p>
      <AiMessage v-else-if="phase === 'missing'" :title="t('ai.captions.missing')" tone="error" />
      <AiMessage v-else-if="phase === 'refused'" :title="t('ai.speech.refusedTitle')" :text="`${refused} ${t('ai.speech.noCharge')}`" tone="error" data-testid="captions-refused" />
      <template v-else-if="phase === 'cost' && blob">
        <TranscribePanel
          :blob="blob"
          :seconds="seconds"
          purpose="captions"
          go-key="ai.captions.go"
          :rows="[{ label: t('ai.captions.take'), value: title }]"
          :extra-steps="[{ key: 'prep', label: t('ai.captions.preparing') }]"
          :after-step="t('ai.captions.building')"
          @busy="b => (busy = b)"
          @done="done"
          @cancel="open = false"
        />
        <p class="muted">{{ t('ai.captions.formats') }}</p>
      </template>
      <template v-else-if="phase === 'ready'">
        <p class="muted" data-testid="captions-ready">{{ t('ai.captions.readyText', { n: cues.length }) }}</p>
      </template>
    </div>
    <template v-if="phase !== 'cost'" #actions>
      <template v-if="phase === 'ready'">
        <UiButton icon="download" data-testid="captions-srt" @click="save('srt')">{{ t('ai.captions.srt') }}</UiButton>
        <UiButton tone="secondary" icon="download" data-testid="captions-vtt" @click="save('vtt')">{{ t('ai.captions.vtt') }}</UiButton>
      </template>
      <UiButton v-else tone="secondary" @click="open = false">{{ t('ai.common.close') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.cap {
  display: grid;
  gap: 14px;
}
.muted {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.6 var(--tilw-font-ar);
}
</style>
