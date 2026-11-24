<script setup lang="ts">
/**
 * "Writing tools" side panel (6:19): session monitor with reading time, rehearse / recording actions,
 * then search in text, delivery marks, undo · redo, and download.
 */
const props = defineProps<{
  scriptId: string
  minutes: number
  canUndo: boolean
  canRedo: boolean
  matchCount: number
  activeMatch: number
  /** Marks in the script, shown on the item. */
  marksCount: number
  /** Words are selected, so the marks toolbar is already over them. */
  hasSelection: boolean
  /** Release 2 (R2-3): marks and undo are dimmed; search, download and History stay. */
  readOnly?: boolean
  /** Feature 005 (A1 `293:150`): the cost line under "Format for reading", or the waiting/working state. */
  formatHint?: string
  formatState?: 'idle' | 'waiting' | 'working'
}>()
const query = defineModel<string>('query', { required: true })
const emit = defineEmits<{ marks: []; undo: []; redo: []; download: []; next: []; prev: []; history: []; format: [] }>()

const { t, locale } = useI18n()
const searchOpen = ref(false)
const input = ref<HTMLInputElement>()
async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    input.value?.focus()
  } else {
    query.value = ''
  }
}
function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) emit('prev')
    else emit('next')
  } else if (e.key === 'Escape') {
    toggleSearch()
  }
}
defineExpose({ openSearch: () => !searchOpen.value && toggleSearch() })
</script>

<template>
  <aside class="tools" :aria-label="t('editor.tools')">
    <section class="session">
      <h2>{{ t('editor.session') }}</h2>
      <p class="dur"><UiGlyph name="clock" :size="20" />{{ minutes ? t('editor.about', { n: minutes, unit: unitFor(minutes, 'minute', locale) }) : t('editor.noText') }}</p>
    </section>
    <div class="acts">
      <UiButton block :to="`/app/scripts/${props.scriptId}/rehearse`">{{ t('library.rehearse') }}</UiButton>
      <UiButton block tone="secondary" :to="`/app/scripts/${props.scriptId}/record`">{{ t('library.setupRecording') }}</UiButton>
    </div>
    <hr>
    <h3>{{ t('editor.tools') }}</h3>
    <ul>
      <!-- Feature 005 (A1): AI tools first. -->
      <li class="ai">
        <button type="button" aria-describedby="format-hint" data-testid="tools-format" @click="emit('format')">
          <UiGlyph name="edit" :size="18" />{{ t('ai.tools.format') }}
        </button>
        <p id="format-hint" class="hint" :class="{ live: formatState && formatState !== 'idle' }">
          {{ formatState === 'working' ? t('ai.tools.formatting') : formatState === 'waiting' ? t('ai.tools.waiting') : formatHint }}
        </p>
      </li>
      <li class="sep" aria-hidden="true" />
      <li>
        <button type="button" :aria-expanded="searchOpen" @click="toggleSearch"><UiGlyph name="search" :size="18" />{{ t('editor.search') }}</button>
        <div v-if="searchOpen" class="find">
          <input ref="input" v-model="query" type="search" dir="auto" :aria-label="t('editor.search')" :placeholder="t('editor.searchPlaceholder')" @keydown="onSearchKey">
          <span class="n" aria-live="polite">{{ query.trim() ? (matchCount ? `${activeMatch + 1}/${matchCount}` : t('editor.noMatches')) : '' }}</span>
          <button type="button" class="mini" :disabled="!matchCount" :aria-label="t('editor.prevMatch')" @click="emit('prev')"><UiGlyph name="up" :size="16" /></button>
          <button type="button" class="mini" :disabled="!matchCount" :aria-label="t('editor.nextMatch')" @click="emit('next')"><UiGlyph name="down" :size="16" /></button>
        </div>
      </li>
      <li>
        <button type="button" aria-describedby="marks-hint" :disabled="readOnly" @click="emit('marks')">
          <UiGlyph name="edit" :size="18" />{{ marksCount ? t('editor.marks.titleCount', { n: marksCount }) : t('editor.marks.title') }}
        </button>
        <p id="marks-hint" class="hint">{{ hasSelection ? t('editor.marks.hintSelected') : t('editor.marks.hint') }}</p>
      </li>
      <li class="pair" :class="{ dim: readOnly }">
        <UiGlyph name="rewind" :size="18" />
        <button type="button" class="inline" :disabled="!canUndo || readOnly" @click="emit('undo')">{{ t('editor.undo') }}</button>
        <span aria-hidden="true">·</span>
        <button type="button" class="inline" :disabled="!canRedo || readOnly" @click="emit('redo')">{{ t('editor.redo') }}</button>
      </li>
      <li><button type="button" class="history" @click="emit('history')"><UiGlyph name="clock" :size="18" />{{ t('history.open') }}</button></li>
      <li><button type="button" @click="emit('download')"><UiGlyph name="download" :size="18" />{{ t('editor.download') }}</button></li>
    </ul>
  </aside>
</template>

<style scoped>
.dim {
  opacity: 0.5;
}
li > button:disabled {
  opacity: 0.5;
  cursor: default;
}
.tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  min-inline-size: 0;
  gap: 0;
  padding: 9px 9px 24px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-quiet);
}
.session {
  display: grid;
  gap: 16px;
  padding: 15px 9px 17px;
  border-radius: 9px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.session h2 {
  font: 700 25px/36px var(--tilw-font-ar);
}
.dur {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 43px;
  padding-inline: 10px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 5px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: 400 16px/26px var(--tilw-font-ar);
}
.acts {
  display: grid;
  gap: 12px;
  padding: 17px 9px 0;
}
hr {
  margin: 34px 10px 24px;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
h3 {
  padding-inline: 10px;
  margin-block-end: 18px;
  font: 500 20px/1.36 var(--tilw-font-ar);
}
ul {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  margin: 0;
  padding: 0 10px;
  list-style: none;
}
li > button,
.pair {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 43px;
  inline-size: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-text-muted);
  font: 400 17px/1.36 var(--tilw-font-ar);
  text-align: start;
}
li > button:hover,
.inline:not(:disabled):hover {
  color: var(--tilw-action-primary);
}
li > button :deep(.ui-glyph),
.pair > :deep(.ui-glyph) {
  color: var(--tilw-text-ink);
}
.hint.live {
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.sep {
  block-size: 1px;
  margin-block: 6px;
  background: var(--tilw-border-subtle);
}
.hint {
  margin: -4px 0 6px;
  padding-inline-start: 26px;
  color: var(--tilw-text-muted);
  font: 400 14px/1.45 var(--tilw-font-ar);
}
.inline {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
}
.inline:disabled {
  opacity: 0.45;
  cursor: default;
}
.find {
  display: flex;
  align-items: center;
  gap: 4px;
  min-inline-size: 0;
  margin-block: 2px 8px;
  padding-block: 4px;
  padding-inline: 10px 4px;
  border: 1px solid var(--tilw-border-strong);
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.find:focus-within {
  border-color: var(--tilw-focus-ring);
}
.find input {
  flex: 1 1 0;
  inline-size: 0;
  min-inline-size: 0;
  block-size: 32px;
  border: 0;
  background: none;
  outline: none;
  font: 400 15px/1.3 var(--tilw-font-ar);
}
.n {
  font: 500 12px/1 var(--tilw-font-lat);
  color: var(--tilw-text-muted);
  white-space: nowrap;
}
.mini {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--tilw-text-ink);
}
.mini:disabled {
  opacity: 0.35;
}
.mini:not(:disabled):hover {
  background: var(--tilw-surface-quiet);
}
</style>
