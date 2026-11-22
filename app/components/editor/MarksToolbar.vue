<script setup lang="ts">
/**
 * Delivery marks toolbar (G7): floats over the words selected in the script, so a mark is one click from the
 * text it belongs to. Emphasis and note apply to the selection; a pause goes right after it, from three
 * presets. A mark already on the selection shows as pressed, and pressing it again takes it off.
 */
import type { DeliveryMark } from '~/services/types'

type MarkInput = Omit<DeliveryMark, 'id'>

const props = defineProps<{
  selection: { start: number, end: number }
  marks: DeliveryMark[]
  /** Where the toolbar sits, in px inside the sheet: x is its centre, y the top of the first selected line. */
  at: { x: number, y: number }
  /** Width of the sheet, so the toolbar stays inside it. */
  limit: number
}>()
const emit = defineEmits<{ add: [m: MarkInput], remove: [id: string], close: [], focusIn: [inside: boolean] }>()
const { t } = useI18n()

const root = ref<HTMLElement>()
const open = ref<'' | 'pause' | 'note'>('')
const note = ref('')
const noteError = ref('')
const noteInput = ref<HTMLInputElement>()

const sel = computed(() => props.selection)
const overlaps = (m: DeliveryMark) => m.start < sel.value.end && m.end > sel.value.start
const emphasis = computed(() => props.marks.filter(m => m.type === 'emphasis' && overlaps(m)))
const noteMark = computed(() => props.marks.find(m => m.type === 'note' && overlaps(m)))
const pauseMark = computed(() => props.marks.find(m => m.type === 'pause' && m.start === sel.value.end))

const PRESETS = [
  { key: 'pauseShort', sec: 1 },
  { key: 'pauseMedium', sec: 2 },
  { key: 'pauseLong', sec: 4 },
] as const

function toggleEmphasis() {
  open.value = ''
  if (emphasis.value.length) emphasis.value.forEach(m => emit('remove', m.id))
  else emit('add', { type: 'emphasis', start: sel.value.start, end: sel.value.end })
}
function setPause(sec: number) {
  const same = pauseMark.value?.pauseSec === sec
  if (pauseMark.value) emit('remove', pauseMark.value.id)
  if (!same) emit('add', { type: 'pause', start: sel.value.end, end: sel.value.end, pauseSec: sec })
  open.value = ''
}
function clearPause() {
  if (pauseMark.value) emit('remove', pauseMark.value.id)
  open.value = ''
}
async function openNote() {
  if (open.value === 'note') {
    open.value = ''
    return
  }
  note.value = noteMark.value?.note ?? ''
  noteError.value = ''
  open.value = 'note'
  await nextTick()
  noteInput.value?.focus()
}
function saveNote() {
  const text = note.value.trim()
  if (!text) {
    noteError.value = t('editor.marks.noteRequired')
    return
  }
  if (noteMark.value) emit('remove', noteMark.value.id)
  emit('add', { type: 'note', start: sel.value.start, end: sel.value.end, note: text })
  open.value = ''
}
function clearNote() {
  if (noteMark.value) emit('remove', noteMark.value.id)
  open.value = ''
}

// A new selection starts from the bare toolbar.
watch(() => `${sel.value.start}:${sel.value.end}`, () => (open.value = ''))

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.preventDefault()
  if (open.value) open.value = ''
  else emit('close')
}

/** Keep the text selected while a button is pressed (the note field is the one thing that takes focus). */
function keepSelection(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('input')) e.preventDefault()
}

const left = computed(() => `${Math.round(Math.min(Math.max(props.at.x, 170), Math.max(170, props.limit - 170)))}px`)
defineExpose({ el: root })
</script>

<template>
  <div
    ref="root"
    class="marks-bar"
    role="toolbar"
    :aria-label="t('editor.marks.title')"
    :style="{ left, top: `${at.y}px` }"
    @mousedown="keepSelection"
    @keydown="onKey"
    @focusin="emit('focusIn', true)"
    @focusout="(e: FocusEvent) => !root?.contains(e.relatedTarget as Node | null) && emit('focusIn', false)"
  >
    <div class="row">
      <button type="button" class="b" :aria-pressed="emphasis.length > 0" @click="toggleEmphasis">
        <span class="sw emph" aria-hidden="true" />{{ t('editor.marks.addEmphasis') }}
      </button>
      <button type="button" class="b" :aria-pressed="!!noteMark" :aria-expanded="open === 'note'" @click="openNote">
        <span class="sw note" aria-hidden="true" />{{ t('editor.marks.noteLabel') }}
      </button>
      <button type="button" class="b" :aria-pressed="!!pauseMark" :aria-expanded="open === 'pause'" aria-haspopup="menu" @click="open = open === 'pause' ? '' : 'pause'">
        <span class="sw pz" aria-hidden="true">/</span>{{ t('editor.marks.addPause') }}
      </button>
    </div>

    <ul v-if="open === 'pause'" class="menu" role="menu">
      <li v-for="p in PRESETS" :key="p.key" role="none">
        <button type="button" role="menuitemradio" :aria-checked="pauseMark?.pauseSec === p.sec" @click="setPause(p.sec)">
          {{ t(`editor.marks.${p.key}`, { s: p.sec }) }}
        </button>
      </li>
      <li v-if="pauseMark" role="none">
        <button type="button" role="menuitem" class="off" @click="clearPause">{{ t('editor.marks.removePause') }}</button>
      </li>
    </ul>

    <form v-else-if="open === 'note'" class="note" @submit.prevent="saveNote">
      <input
        ref="noteInput"
        v-model="note"
        dir="auto"
        maxlength="140"
        :aria-label="t('editor.marks.noteLabel')"
        :aria-invalid="!!noteError"
        :placeholder="t('editor.marks.notePlaceholder')"
      >
      <button type="submit" class="go">{{ t('editor.marks.saveNote') }}</button>
      <button v-if="noteMark" type="button" class="off" @click="clearNote">{{ t('editor.marks.removeNote') }}</button>
      <p v-if="noteError" class="err" role="alert">{{ noteError }}</p>
    </form>
  </div>
</template>

<style scoped>
.marks-bar {
  position: absolute;
  z-index: 5;
  translate: -50% calc(-100% - 10px);
  display: grid;
  gap: 6px;
  min-inline-size: 0;
  padding: 5px;
  border-radius: 12px;
  background: var(--tilw-stage-background);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  color: var(--tilw-stage-text);
}
.row {
  display: flex;
  gap: 2px;
}
.b {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 40px;
  padding-inline: 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: 500 15px/1.36 var(--tilw-font-ar);
  white-space: nowrap;
}
.b:hover,
.menu button:hover {
  background: rgba(247, 242, 233, 0.1);
}
.b[aria-pressed='true'] {
  background: rgba(247, 242, 233, 0.18);
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
.sw.pz { border: 1px dashed var(--tilw-stage-cue); color: var(--tilw-stage-cue); }
.sw.note { border-block-end: 2px dotted var(--tilw-stage-cue); border-radius: 0; }
.menu {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.menu button {
  inline-size: 100%;
  min-block-size: 40px;
  padding-inline: 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: 400 15px/1.36 var(--tilw-font-ar);
  text-align: start;
}
.menu button[aria-checked='true'] {
  background: rgba(247, 242, 233, 0.18);
  font-weight: 500;
}
.off {
  color: var(--tilw-stage-secondary);
}
.note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 2px;
}
.note input {
  flex: 1 1 160px;
  min-inline-size: 0;
  block-size: 40px;
  padding-inline: 12px;
  border: 1px solid rgba(247, 242, 233, 0.25);
  border-radius: 8px;
  background: rgba(247, 242, 233, 0.08);
  color: inherit;
  font: 400 15px/1.36 var(--tilw-font-ar);
  outline: none;
}
.note input:focus-visible {
  border-color: var(--tilw-stage-cue);
}
.note input::placeholder {
  color: var(--tilw-stage-secondary);
}
.go {
  min-block-size: 40px;
  padding-inline: 14px;
  border: 0;
  border-radius: 8px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.note .off {
  min-block-size: 40px;
  padding-inline: 8px;
  border: 0;
  background: none;
  font: 400 14px/1.36 var(--tilw-font-ar);
}
.err {
  flex-basis: 100%;
  margin: 0;
  padding-inline: 4px;
  color: var(--tilw-status-error);
  font: 400 13px/1.4 var(--tilw-font-ar);
}
@media (max-width: 760px) {
  .b {
    gap: 6px;
    padding-inline: 8px;
    font-size: 14px;
  }
}
</style>
