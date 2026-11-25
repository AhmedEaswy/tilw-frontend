<script setup lang="ts">
/**
 * Feature 005, US3 (A4 `295:428`: pick, cost, result, refused): a new script from an audio file. The file's type, size
 * and length are checked on the device before any call (US3 #4). The text is shown for review and reaches Tilw only
 * when the person saves it as a new script (spec clarification 3).
 * The file comes from this device (choose or drop it) or from Google Drive (Google's Picker, useDrivePicker): a Drive
 * file is downloaded into this browser and goes through the same checks.
 */
import type { TranscribeRun } from '~/services/ai/transcribe'
import { checkAudio, type AudioProblem } from '~/services/ai/audio'

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const plan = usePlanStore()
const scripts = useScriptsStore()
const limitError = useLimitError()
const errorText = useErrorText()
const { show } = useToast()

const maxMinutes = () => {
  const v = plan.limit('ai.audio_max_minutes')
  return typeof v === 'number' && v > 0 ? v : 60
}
const phase = ref<'pick' | 'reading' | 'cost' | 'result' | 'refused'>('pick')
const file = shallowRef<File | null>(null)
const seconds = ref(0)
const refused = ref('')
const text = ref('')
const busy = ref(false)
const saving = ref(false)
const input = ref<HTMLInputElement>()
const drive = useDrivePicker()
const storage = useStorageStore()
onMounted(() => {
  if (!storage.status) void storage.load().catch(() => {})
})
/** Where the file being read comes from (for the "reading…" line). */
const source = ref<'device' | 'drive'>('device')
const dragging = ref(false)

watch(open, (v) => {
  if (v) reset()
})
function reset() {
  phase.value = 'pick'
  file.value = null
  text.value = ''
  refused.value = ''
}

async function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  source.value = 'device'
  await accept(f)
}
function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (!f || phase.value === 'reading') return
  source.value = 'device'
  void accept(f)
}
async function fromDrive() {
  if (phase.value === 'reading') return
  source.value = 'drive'
  phase.value = 'reading'
  try {
    const doc = await drive.pick()
    if (!doc) {
      phase.value = 'pick'
      return
    }
    // Type and size from Drive first: a file that would be refused is never downloaded.
    if (doc.sizeBytes !== null) {
      const early = checkAudio({ type: doc.mimeType, size: doc.sizeBytes }, 1, maxMinutes())
      if (early) {
        file.value = null
        return refuse(early)
      }
    }
    await accept(await drive.download(doc))
  } catch {
    phase.value = 'pick'
    show(t('ai.speech.driveFailed'), 'error')
  }
}
async function accept(f: File) {
  file.value = f
  // Type and size first: a non-audio file is never read.
  const early = checkAudio({ type: f.type, size: f.size }, 1, maxMinutes())
  if (early) return refuse(early)
  phase.value = 'reading'
  const s = await readAudioLength(f)
  const problem = checkAudio({ type: f.type, size: f.size }, s, maxMinutes())
  if (problem) return refuse(problem)
  seconds.value = s!
  phase.value = 'cost'
}
function refuse(p: AudioProblem) {
  refused.value = t(`ai.speech.refused.${p.reason}`, { maxMb: 'maxMb' in p ? p.maxMb : 200, maxMinutes: 'maxMinutes' in p ? p.maxMinutes : maxMinutes() })
  phase.value = 'refused'
}

function done(run: TranscribeRun) {
  text.value = run.result.transcript
  phase.value = 'result'
}

const words = computed(() => countWords(text.value))
const title = computed(() => {
  if (phase.value === 'result') return t('ai.speech.resultTitle')
  if (phase.value === 'refused') return t('ai.speech.refusedTitle')
  return t('ai.speech.importTitle')
})
const fileTitle = computed(() => (file.value?.name ?? '').replace(/\.[^.]+$/, '').trim() || t('ai.speech.untitled'))

async function save() {
  saving.value = true
  try {
    const s = await scripts.create(fileTitle.value, text.value)
    show(t('ai.speech.saved', { title: s.title }), 'success')
    open.value = false
    await navigateTo(`/app/scripts/${s.id}`)
  } catch (e) {
    if (!limitError.handle(e)) show(errorText(e), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :dismissible="!busy" data-testid="audio-import">
    <div class="ai-imp">
      <!-- Kept mounted in every phase: "Choose another file" reopens it after a refusal. -->
      <input ref="input" class="visually-hidden" type="file" accept="audio/*" :aria-label="t('ai.speech.pick')" tabindex="-1" data-testid="audio-file" @change="onPick">
      <template v-if="phase === 'pick' || phase === 'reading'">
        <button
          type="button"
          class="drop"
          :class="{ over: dragging }"
          :aria-busy="phase === 'reading' || undefined"
          :disabled="phase === 'reading'"
          data-testid="audio-drop"
          @click="input?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <UiGlyph name="file" :size="28" />
          <b>{{ phase === 'reading' ? (source === 'drive' ? t('ai.speech.readingDrive') : t('ai.speech.reading')) : t('ai.speech.pick') }}</b>
          <small>{{ t('ai.speech.pickHint', { minutes: maxMinutes() }) }}</small>
          <small v-if="phase === 'pick'">{{ t('ai.speech.dropHint') }}</small>
        </button>
        <button
          v-if="drive.available.value"
          type="button"
          class="drive"
          :disabled="phase === 'reading'"
          data-testid="audio-from-drive"
          @click="fromDrive"
        >
          <ProviderMark provider="google-drive" :size="20" />
          <span>{{ t('ai.speech.fromDrive') }}</span>
        </button>
        <p v-else-if="drive.configured && storage.status && !storage.linked" class="muted">
          {{ t('ai.speech.driveNotLinked') }} <NuxtLink to="/app/settings/storage">{{ t('ai.speech.linkDrive') }}</NuxtLink>
        </p>
      </template>

      <template v-else-if="phase === 'refused'">
        <AiMessage :title="t('ai.speech.refusedTitle')" :text="`${refused} ${t('ai.speech.noCharge')}`" tone="error" data-testid="audio-refused" />
      </template>

      <TranscribePanel
        v-else-if="phase === 'cost' && file"
        :blob="file"
        :seconds="seconds"
        purpose="text"
        :rows="[{ label: t('ai.speech.file'), value: file.name }]"
        @busy="b => (busy = b)"
        @done="done"
        @cancel="open = false"
      />

      <template v-else-if="phase === 'result'">
        <div class="text" dir="auto" data-testid="audio-result">
          <p v-for="(p, i) in splitParagraphs(text)" :key="i" dir="auto">{{ p }}</p>
        </div>
        <p class="muted">{{ t('ai.speech.resultMeta', { words }) }}</p>
      </template>
    </div>
    <template v-if="phase !== 'cost'" #actions>
      <template v-if="phase === 'result'">
        <UiButton :loading="saving" data-testid="audio-save" @click="save">{{ t('ai.speech.save') }}</UiButton>
        <UiButton tone="secondary" @click="open = false">{{ t('ai.format.discard') }}</UiButton>
      </template>
      <template v-else-if="phase === 'refused'">
        <UiButton @click="reset(); input?.click()">{{ t('ai.speech.otherFile') }}</UiButton>
        <UiButton tone="secondary" @click="open = false">{{ t('ai.common.close') }}</UiButton>
      </template>
      <template v-else>
        <UiButton :disabled="phase === 'reading'" @click="input?.click()">{{ t('ai.speech.pickButton') }}</UiButton>
        <UiButton tone="secondary" @click="open = false">{{ t('ai.common.cancel') }}</UiButton>
      </template>
    </template>
  </UiDialog>
</template>

<style scoped>
.ai-imp {
  display: grid;
  gap: 14px;
}
.drop {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 32px 16px;
  border: 1.5px dashed var(--tilw-border-strong);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  cursor: pointer;
}
.drop.over {
  border-color: var(--tilw-action-primary);
  background: var(--tilw-surface-selected);
}
.drop:disabled {
  cursor: progress;
}
.drive {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-block-size: var(--tilw-hit);
  padding-inline: 16px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.drive:hover {
  background: var(--tilw-surface-quiet);
}
.drive:disabled {
  opacity: 0.6;
  cursor: progress;
}
.drive:focus-visible,
.drop:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.drop b {
  font: 500 17px/1.4 var(--tilw-font-ar);
}
.drop small,
.muted {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 13px/1.5 var(--tilw-font-ar);
}
.text {
  display: grid;
  gap: 10px;
  max-block-size: 320px;
  padding: 16px;
  overflow-y: auto;
  border-radius: 10px;
  background: var(--tilw-surface-white);
}
.text p {
  margin: 0;
  font: 400 16px/1.8 var(--tilw-font-ar);
}
</style>
