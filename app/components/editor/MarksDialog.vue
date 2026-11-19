<script setup lang="ts">
/**
 * Delivery marks — "علامات الإلقاء" (6:19 tool). No Figma frame for the panel itself (G7), so this
 * uses the library dialog pattern: add emphasis or a note to the selected words, or a pause at the
 * cursor; list existing marks with jump-to and remove.
 */
import type { DeliveryMark } from '~/services/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ body: string; marks: DeliveryMark[]; selection: { start: number; end: number } }>()
const emit = defineEmits<{
  add: [m: Omit<DeliveryMark, 'id'>]
  remove: [id: string]
  jump: [m: DeliveryMark]
}>()
const { t } = useI18n()

const hasSelection = computed(() => props.selection.end > props.selection.start)
const selectedText = computed(() => props.body.slice(props.selection.start, props.selection.end).trim())
const pauseSec = ref(2)
const note = ref('')
const noteError = ref<string>()

watch(open, (v) => {
  if (v) {
    note.value = ''
    noteError.value = undefined
  }
})

function addEmphasis() {
  if (!hasSelection.value) return
  emit('add', { type: 'emphasis', start: props.selection.start, end: props.selection.end })
}
function addPause() {
  emit('add', { type: 'pause', start: props.selection.start, end: props.selection.start, pauseSec: pauseSec.value })
}
function addNote() {
  if (!hasSelection.value) return
  if (!note.value.trim()) {
    noteError.value = t('editor.marks.noteRequired')
    return
  }
  emit('add', { type: 'note', start: props.selection.start, end: props.selection.end, note: note.value.trim() })
  note.value = ''
  noteError.value = undefined
}

const listed = computed(() =>
  [...props.marks].sort((a, b) => a.start - b.start).map(m => ({
    m,
    label: t(`editor.marks.${m.type}`),
    text:
      m.type === 'pause'
        ? t('editor.marks.pauseChip', { s: m.pauseSec ?? 1 })
        : `«${props.body.slice(m.start, m.end).slice(0, 40)}»${m.type === 'note' && m.note ? ` — ${m.note}` : ''}`,
  })),
)
</script>

<template>
  <UiDialog v-model:open="open" :title="t('editor.marks.title')">
    <p class="sel">
      <template v-if="hasSelection">{{ t('editor.marks.selected') }} <b dir="auto">«{{ selectedText.slice(0, 60) }}»</b></template>
      <template v-else>{{ t('editor.marks.noSelection') }}</template>
    </p>

    <div class="add">
      <UiButton tone="secondary" size="sm" :disabled="!hasSelection" @click="addEmphasis">
        <span class="sw emph" aria-hidden="true" />{{ t('editor.marks.addEmphasis') }}
      </UiButton>
      <div class="pause">
        <UiButton tone="secondary" size="sm" @click="addPause"><span class="sw pz" aria-hidden="true">/</span>{{ t('editor.marks.addPause') }}</UiButton>
        <UiStepper v-model="pauseSec" :min="1" :max="10" :label="t('editor.marks.seconds')" />
        <span class="unit">{{ t('editor.marks.secondsUnit') }}</span>
      </div>
      <div class="note-row">
        <UiField v-model="note" :label="t('editor.marks.noteLabel')" :placeholder="t('editor.marks.notePlaceholder')" :error="noteError" :disabled="!hasSelection" :maxlength="140" />
        <UiButton tone="secondary" size="sm" :disabled="!hasSelection" @click="addNote">{{ t('editor.marks.addNote') }}</UiButton>
      </div>
    </div>

    <h3>{{ t('editor.marks.inScript', { n: marks.length }) }}</h3>
    <p v-if="!marks.length" class="empty">{{ t('editor.marks.none') }}</p>
    <ul v-else class="list">
      <li v-for="row in listed" :key="row.m.id">
        <button type="button" class="jump" @click="emit('jump', row.m)">
          <span class="sw" :class="row.m.type === 'emphasis' ? 'emph' : row.m.type === 'pause' ? 'pz' : 'note'" aria-hidden="true">{{ row.m.type === 'pause' ? '/' : '' }}</span>
          <span class="k">{{ row.label }}</span>
          <span class="v" dir="auto">{{ row.text }}</span>
        </button>
        <button type="button" class="rm" :aria-label="t('editor.marks.remove', { mark: row.label })" @click="emit('remove', row.m.id)">
          <UiGlyph name="close" :size="16" />
        </button>
      </li>
    </ul>

    <template #actions>
      <UiButton @click="open = false">{{ t('library.done') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.sel {
  font-size: 17px;
}
.sel b {
  color: var(--tilw-text-ink);
  font-weight: 500;
}
.add {
  display: grid;
  justify-items: start;
  gap: 14px;
}
.note-row {
  justify-self: stretch;
}
.pause {
  align-items: center;
}
.unit {
  font-size: 15px;
}
.pause,
.note-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}
.note-row :deep(.ui-field) {
  flex: 1;
  min-inline-size: 200px;
}
.note-row :deep(label) {
  font-size: 15px;
}
.sw {
  display: inline-grid;
  place-items: center;
  inline-size: 18px;
  block-size: 18px;
  border-radius: 4px;
  font: 600 12px/1 var(--tilw-font-lat);
}
.sw.emph { background: var(--tilw-stage-cue); }
.sw.pz { border: 1px dashed var(--tilw-action-primary); color: var(--tilw-action-primary); }
.sw.note { border-block-end: 2px dotted var(--tilw-action-primary); border-radius: 0; }
h3 {
  margin-block-start: 12px;
  font: 500 18px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
.empty {
  font-size: 15px;
}
.list {
  display: grid;
  gap: 6px;
  max-block-size: 240px;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}
.list li {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.jump {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  background: none;
  color: var(--tilw-text-ink);
  font: 400 15px/1.4 var(--tilw-font-ar);
  text-align: start;
}
.k {
  flex: 0 0 auto;
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.v {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rm {
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-muted);
}
.rm:hover {
  color: var(--tilw-status-error);
}
</style>
