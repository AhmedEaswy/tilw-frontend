<script setup lang="ts">
/**
 * Script editor (6:19 desktop, 6:21 phone, 6:86 en) with conflict flow (6:72 → 6:73). T050–T055.
 */
import { recognitionSupported } from '~/services/ai/recognition'
import { placeSpoken } from '~/utils/dictation'
import type { DeliveryMark } from '~/services/types'
import { creditsForWords } from '~/services/ai/audio'

definePageMeta({ layout: 'app', phoneMinimal: true })
const { t } = useI18n()
const route = useRoute()
const editor = useEditorStore()
const auth = useAuthStore()
const errorText = useErrorText()
const { show } = useToast()

const id = computed(() => String(route.params.id))
useHead({ title: () => `${editor.title || t('library.editor')} · tilwprompter` })

onMounted(() => editor.load(id.value))
watch(id, v => editor.load(v))

// Save before leaving; the local draft covers anything still pending.
onBeforeRouteLeave(() => {
  if (editor.dirty && editor.saveState !== 'conflict') void editor.save()
})
function beforeUnload(e: BeforeUnloadEvent) {
  if (editor.saveState === 'saving' || editor.saveState === 'unsaved') {
    void editor.save()
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  editor.reset()
})

const canvas = ref<{ select: (s: number, e: number) => void; focus: () => void }>()
const selection = ref({ start: 0, end: 0 })
/** False until the person has put the cursor somewhere: dictation then goes at the end. */
const placed = ref(false)
const hasSelection = computed(() => editor.body.slice(selection.value.start, selection.value.end).trim().length > 0)
const tools = ref<{ openSearch: () => void }>()

const direction = computed<'rtl' | 'ltr'>(() => {
  const d = editor.script?.direction ?? 'auto'
  return d === 'auto' ? detectDirection(editor.body || editor.title || 'ا') : d
})
const minutes = computed(() => estimateMinutes(editor.words, auth.user?.reading.wpm ?? 120))

// ----- search -----
const query = ref('')
const active = ref(0)
const matches = computed(() => findAll(editor.body, query.value))
watch(query, () => (active.value = 0))
function go(step: 1 | -1) {
  const n = matches.value.length
  if (!n) return
  active.value = (active.value + step + n) % n
  const m = matches.value[active.value]!
  canvas.value?.select(m.start, m.end)
}

// ----- keyboard -----
function onKeys(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) {
    e.preventDefault()
    editor.undo()
  } else if ((k === 'z' && e.shiftKey) || k === 'y') {
    e.preventDefault()
    editor.redo()
  } else if (k === 's') {
    e.preventDefault()
    void editor.save()
  } else if (k === 'f') {
    e.preventDefault()
    tools.value?.openSearch()
  }
}

// ----- marks -----
const marksOpen = ref(false)
/** With words selected the toolbar is already over them, so bring it back into focus; otherwise list the marks. */
function openMarks() {
  if (hasSelection.value) canvas.value?.select(selection.value.start, selection.value.end)
  else marksOpen.value = true
}
function addMark(m: Omit<DeliveryMark, 'id'>) {
  editor.addMark(m)
  show(t('editor.marks.added'))
}
function jumpTo(m: DeliveryMark) {
  marksOpen.value = false
  nextTick(() => canvas.value?.select(m.start, Math.max(m.end, m.start)))
}

function download() {
  downloadText(editor.title || t('library.editor'), editor.body)
  show(t('library.downloaded'))
}

// ----- conflict -----
const resolving = ref(false)
const inConflictView = computed(() => editor.saveState === 'conflict' && !!editor.serverCopy && !editor.reviewing)
async function saveMine() {
  resolving.value = true
  try {
    const created = await editor.saveMineAsNew(copyTitle(editor.title.trim() || editor.serverCopy!.title, title => t('editor.conflict.copyTitle', { title })))
    if (created) show(t('editor.conflict.savedAsNew', { title: created.title }))
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    resolving.value = false
  }
}
function useTheirs() {
  editor.acceptServerCopy()
  show(t('editor.conflict.usedTheirs'))
}

const statusLabel = computed(() => (editor.readOnly ? t('limits.readOnlyChip') : t(`editor.status.${editor.saveState}`)))

// ----- release 2: read-only over the plan limit (R2-3), history (R2-9) -----
const plan = usePlanStore()
const upgrade = useUpgrade()
onMounted(() => !plan.my && plan.load())
const readOnlyText = computed(() => {
  const active = plan.my?.limits.find(l => l.key === 'scripts.max_active')
  return typeof active?.value === 'number' && typeof active.usage === 'number'
    ? t('limits.readOnlyText', { n: active.usage, max: active.value })
    : t('limits.readOnlyTextShort')
})
const historyOpen = ref(false)

// ----- feature 005: format for reading (A1 `293:150`, A2) -----
const ai = useAiStore()
const { credits } = useAiText()
const formatOpen = ref(false)
onMounted(() => {
  if (ai.balance === null) ai.refreshCredits()
  if (!ai.keyLoaded) void ai.loadKey().catch(() => {})
})
// A suggestion made earlier (here or on another device) waits for 24 hours (US1 #9).
watch(() => [editor.status, id.value] as const, ([st, sid]) => {
  if (st === 'ready') void ai.loadSuggestion(sid).catch(() => {})
}, { immediate: true })
// ----- feature 005: dictation (gaps G-A7): gray pending words in the editor until Enter -----
// With speech to text on the plan the provider writes the words (credits); otherwise, or when the browser can't record,
// its own speech recognition does (G-A5).
const canRecognise = ref(false)
const canRecord = ref(false)
onMounted(() => {
  canRecognise.value = recognitionSupported()
  canRecord.value = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
})
const cloudDictate = computed(() => plan.cloudSpeech && canRecord.value)
const canDictate = computed(() => cloudDictate.value || canRecognise.value)
const dictation = useScriptDictation({ cloud: () => cloudDictate.value, direction: () => direction.value, readOnly: () => editor.readOnly })

/** Where the words will go, fixed when talking starts. */
const anchor = ref({ start: 0, end: 0 })
const pending = computed(() => {
  if (!dictation.active.value) return null
  const at = placeSpoken(editor.body, anchor.value, dictation.text.value)
  return { start: at.start, end: dictation.text.value ? at.end : at.start, text: at.insert }
})
function toggleDictation() {
  if (!dictation.active.value) {
    const end = editor.body.length
    anchor.value = placed.value ? { ...selection.value } : { start: end, end }
  }
  dictation.toggle()
  // Enter and Esc work from the text.
  nextTick(() => canvas.value?.focus())
}
const confirming = ref(false)
async function confirmDictation() {
  if (confirming.value) return
  confirming.value = true
  const scriptId = id.value
  try {
    const words = await dictation.take()
    if (!words.trim() || editor.readOnly || id.value !== scriptId) return
    const at = placeSpoken(editor.body, anchor.value, words)
    editor.setContent({ body: at.body })
    nextTick(() => canvas.value?.select(at.caret, at.caret))
  } finally {
    confirming.value = false
  }
}
function discardDictation() {
  dictation.discard()
  nextTick(() => canvas.value?.focus())
}
/** Enter confirms and Esc discards, from the text or the microphone (other controls keep their own keys). */
function onDictationKey(e: KeyboardEvent) {
  if (!dictation.active.value || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const el = e.target as HTMLElement
  if (el !== document.body && !el.closest?.('[data-dictation-enter]')) return
  if (e.key === 'Enter') void confirmDictation()
  else if (e.key === 'Escape') discardDictation()
  else return
  e.preventDefault()
  e.stopPropagation()
}
onMounted(() => window.addEventListener('keydown', onDictationKey, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onDictationKey, true))
watch(id, () => {
  dictation.discard()
  placed.value = false
})
const formatState = computed(() => (ai.formatting[id.value] ? 'working' : ai.suggestions[id.value] ? 'waiting' : 'idle'))
const formatHint = computed(() => {
  if (ai.key?.usable) return t('ai.tools.formatOwnKey')
  const cost = credits(creditsForWords(editor.words))
  return ai.balance === null ? cost : t('ai.tools.formatHint', { cost, balance: ai.balance })
})
</script>

<template>
  <div class="ed">
    <!-- loading / missing / error -->
    <!-- Loading: the real top row (back, tabs) with the status chip's shape, then the canvas and tools' shape. -->
    <SkeletonRegion v-if="editor.status === 'idle' || editor.status === 'loading'" class="loading" data-testid="editor-skeleton">
      <div class="bar">
        <NuxtLink to="/app/scripts" class="back">
          <UiGlyph class="back-ic" name="back" :size="22" />
          <span class="lbl">{{ t('library.backToScripts') }}</span>
        </NuxtLink>
        <div class="bar-end">
          <UiSkeleton h="29px" w="88px" r="14px" />
          <ScriptTabs :script-id="id" current="script" />
        </div>
      </div>
      <EditorSkeleton />
    </SkeletonRegion>
    <UiEmptyState v-else-if="editor.status === 'missing'" icon="file" :title="t('editor.missingTitle')" :text="t('editor.missingText')">
      <UiButton to="/app/scripts">{{ t('library.backToScripts') }}</UiButton>
    </UiEmptyState>
    <UiBanner v-else-if="editor.status === 'error'" tone="error" class="err">
      {{ errorText(editor.loadError) }}
      <template #action><UiButton size="sm" tone="secondary" @click="editor.load(id)">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <!-- 6:72 / 6:73 -->
    <ConflictCompare
      v-else-if="inConflictView"
      v-model:busy="resolving"
      :mine="{ title: editor.title, body: editor.body }"
      :theirs="{ title: editor.serverCopy!.title, body: editor.serverCopy!.body }"
      @save-mine="saveMine"
      @use-theirs="useTheirs"
      @back="editor.reviewing = true"
    />

    <!-- 6:19 / 6:21 -->
    <template v-else>
      <div class="bar">
        <NuxtLink to="/app/scripts" class="back">
          <UiGlyph class="back-ic" name="back" :size="22" />
          <span class="lbl">{{ t('library.backToScripts') }}</span>
        </NuxtLink>
        <div class="bar-end">
          <button
            v-if="editor.saveState === 'conflict'"
            type="button"
            class="chip warn"
            @click="editor.reviewing = false"
          >{{ statusLabel }}</button>
          <span v-else class="chip" :class="editor.readOnly ? 'readonly' : editor.saveState" role="status">{{ statusLabel }}</span>
          <ScriptTabs :script-id="id" current="script" />
        </div>
      </div>

      <UiBanner v-if="editor.readOnly" tone="warning" class="ro">
        <b>{{ t('limits.readOnlyTitle') }}</b>
        <span>{{ readOnlyText }}</span>
        <template #action>
          <span class="ro-acts">
            <UiButton v-if="!plan.isPro && upgrade.available.value" size="sm" @click="upgrade.open()">{{ t('upgrade.cta') }}</UiButton>
            <UiButton size="sm" tone="secondary" to="/app/scripts">{{ t('limits.dialog.archive') }}</UiButton>
          </span>
        </template>
      </UiBanner>

      <UiBanner v-if="editor.restoredDraft && editor.saveState !== 'conflict'" tone="info" class="restored">{{ t('editor.restored') }}</UiBanner>

      <div class="grid">
        <EditorCanvas
          ref="canvas"
          :title="editor.title"
          :body="editor.body"
          :marks="editor.marks"
          :direction="direction"
          :matches="matches"
          :active-match="active"
          :words="editor.words"
          :paragraphs="editor.paragraphs"
          :read-only="editor.readOnly"
          :pending="pending"
          @update:title="v => editor.setContent({ title: v })"
          @update:body="v => editor.setContent({ body: v })"
          @selection="r => ((selection = r), (placed = true))"
          @keys="onKeys"
          @add-mark="addMark"
          @remove-mark="editor.removeMark"
        >
          <template #tools>
            <DictationControl
              v-model:lang="dictation.lang.value"
              :supported="canDictate"
              :read-only="editor.readOnly"
              :listening="dictation.listening.value"
              :finishing="dictation.finishing.value"
              :level="dictation.level.value"
              :has-text="!!dictation.text.value"
              :cloud="cloudDictate"
              :lang-options="dictation.langOptions.value"
              @toggle="toggleDictation"
              @confirm="confirmDictation"
              @discard="discardDictation"
            />
          </template>
        </EditorCanvas>
        <WritingTools
          ref="tools"
          v-model:query="query"
          :script-id="id"
          :minutes="minutes"
          :can-undo="editor.canUndo"
          :can-redo="editor.canRedo"
          :match-count="matches.length"
          :active-match="active"
          :marks-count="editor.marks.length"
          :has-selection="hasSelection"
          :read-only="editor.readOnly"
          :format-hint="formatHint"
          :format-state="formatState"
          @format="formatOpen = true"
          @history="historyOpen = true"
          @marks="openMarks"
          @undo="editor.undo()"
          @redo="editor.redo()"
          @download="download"
          @next="go(1)"
          @prev="go(-1)"
        />
      </div>

      <!-- Phone action bar (6:21) -->
      <div class="phone-acts">
        <UiButton :to="`/app/scripts/${id}/rehearse`">{{ t('library.rehearse') }}</UiButton>
        <UiButton tone="secondary" :to="`/app/scripts/${id}/record`">{{ t('library.setupRecording') }}</UiButton>
      </div>

      <HistoryDrawer v-if="historyOpen && editor.script" :script-id="id" @close="historyOpen = false" />
      <FormatDrawer v-if="formatOpen && editor.script" :script-id="id" :direction="direction" @close="formatOpen = false" />

      <MarksDialog
        v-model:open="marksOpen"
        :body="editor.body"
        :marks="editor.marks"
        @remove="editor.removeMark"
        @jump="jumpTo"
      />
    </template>
  </div>
</template>

<style scoped>
.ed {
  padding-block: 26px 40px;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-block-end: 26px;
}
.bar-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.back:hover .lbl {
  text-decoration: underline;
}
.back-ic {
  display: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  min-block-size: 29px;
  padding-inline: 18px;
  border: 0;
  border-radius: 14px;
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font: 500 13px/1.36 var(--tilw-font-ar);
}
.chip.saving,
.chip.unsaved {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
}
.chip.offline,
.chip.error,
.chip.warn {
  background: color-mix(in srgb, var(--tilw-status-error) 14%, transparent);
  color: var(--tilw-status-error);
}
.chip.warn {
  cursor: pointer;
}
.restored {
  margin-block-end: 16px;
}
.chip.readonly {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.ro {
  margin-block-end: 18px;
}
.ro :deep(.txt) {
  display: grid;
  gap: 2px;
}
.ro-acts {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 831fr) minmax(260px, 298fr);
  gap: 33px;
  align-items: start;
}
.err {
  margin-block-start: 32px;
}
.phone-acts {
  display: none;
}

@media (max-width: 1000px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Phone (6:21): back arrow only, no side panel chrome, actions pinned to the bottom. */
@media (max-width: 760px) {
  .ed {
    padding-block: 12px 110px;
  }
  .bar {
    margin-block-end: 12px;
  }
  .back .lbl {
    display: none;
  }
  .back-ic {
    display: inline-block;
    color: var(--tilw-text-ink);
  }
  .back {
    inline-size: var(--tilw-hit);
    block-size: var(--tilw-hit);
    justify-content: center;
  }
  .grid {
    gap: 16px;
  }
  .grid :deep(.tools .session),
  .grid :deep(.tools .acts),
  .grid :deep(.tools hr) {
    display: none;
  }
  .phone-acts {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 15;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    padding: 18px max(16px, env(safe-area-inset-left, 0px)) calc(18px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-right, 0px));
    border-block-start: 1px solid var(--tilw-border-subtle);
    background: var(--tilw-surface-quiet);
  }
}
</style>
