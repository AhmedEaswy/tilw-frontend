<script setup lang="ts">
/**
 * Script page from "Script editor" (6:19, phone 6:21): title, rule, body, word/paragraph footer.
 *
 * The body is a plain <textarea> laid over a "backdrop" that renders the same text invisibly with
 * highlights behind it: the paragraph being edited ("Opening line" in Figma), search matches, and
 * delivery marks (emphasis background, pause chip, note underline — interim visuals for G7).
 * Both layers share font, padding and wrapping, and the backdrop sets the height, so they stay aligned.
 */
import type { DeliveryMark } from '~/services/types'

const props = defineProps<{
  title: string
  body: string
  marks: DeliveryMark[]
  direction: 'rtl' | 'ltr'
  matches: { start: number; end: number }[]
  activeMatch: number
  words: number
  paragraphs: number
}>()
const emit = defineEmits<{
  'update:title': [v: string]
  'update:body': [v: string]
  selection: [range: { start: number; end: number }]
  keys: [e: KeyboardEvent]
}>()

const { t, locale } = useI18n()
const area = ref<HTMLTextAreaElement>()
const caret = ref(0)

function track() {
  const el = area.value
  if (!el) return
  caret.value = el.selectionStart
  emit('selection', { start: el.selectionStart, end: el.selectionEnd })
}

const current = computed(() => {
  const ranges = paragraphRanges(props.body)
  return ranges[paragraphAt(props.body, caret.value)] ?? null
})

interface Seg { text: string; cls: string[]; pause?: string; note?: string }

/** Split the body at every highlight boundary and tag each piece with its classes. */
const segments = computed<Seg[]>(() => {
  const text = props.body
  const layers: { start: number; end: number; cls: string }[] = []
  if (current.value) layers.push({ ...current.value, cls: 'para' })
  props.matches.forEach((m, i) => layers.push({ ...m, cls: i === props.activeMatch ? 'hit on' : 'hit' }))
  for (const m of props.marks) {
    if (m.type === 'emphasis') layers.push({ start: m.start, end: m.end, cls: 'emph' })
    if (m.type === 'note') layers.push({ start: m.start, end: m.end, cls: 'note' })
  }
  const pauses = props.marks.filter(m => m.type === 'pause')
  const cuts = new Set<number>([0, text.length])
  layers.forEach(l => (cuts.add(l.start), cuts.add(l.end)))
  pauses.forEach(p => cuts.add(p.start))
  const points = [...cuts].filter(x => x >= 0 && x <= text.length).sort((a, b) => a - b)

  const out: Seg[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    for (const p of pauses) if (p.start === a) out.push({ text: '', cls: ['pz'], pause: t('editor.marks.pauseChip', { s: p.pauseSec ?? 1 }) })
    const b = points[i + 1]
    if (b === undefined || b === a) continue
    const cls = layers.filter(l => l.start <= a && l.end >= b).map(l => l.cls)
    const note = props.marks.find(m => m.type === 'note' && m.start <= a && m.end >= b)?.note
    out.push({ text: text.slice(a, b), cls, note })
  }
  return out
})

const nf = computed(() => new Intl.NumberFormat(locale.value === 'ar' ? 'ar-u-nu-arab' : 'en'))

/** Select a range in the body and scroll it into view (used by search and the marks list). */
function select(start: number, end: number) {
  const el = area.value
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(start, end)
  track()
  nextTick(() => {
    document.querySelector('.editor-canvas .hit.on, .editor-canvas .sel-target')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
defineExpose({ select, focus: () => area.value?.focus() })
</script>

<template>
  <article class="editor-canvas" :dir="direction">
    <input
      class="title"
      :value="title"
      :aria-label="t('library.titleLabel')"
      :maxlength="120"
      dir="auto"
      @input="emit('update:title', ($event.target as HTMLInputElement).value)"
    >
    <div class="sheet">
      <div class="backdrop" aria-hidden="true"><template v-for="(s, i) in segments" :key="i"><span v-if="s.pause" class="pz" :data-label="s.pause" /><span v-else :class="s.cls" :title="s.note">{{ s.text }}</span></template>{{ '\n ' }}</div>
      <textarea
        ref="area"
        :value="body"
        :aria-label="t('editor.bodyLabel')"
        :placeholder="t('editor.bodyPlaceholder')"
        spellcheck="true"
        @input="emit('update:body', ($event.target as HTMLTextAreaElement).value); track()"
        @keyup="track"
        @click="track"
        @select="track"
        @focus="track"
        @keydown="emit('keys', $event)"
      />
    </div>
    <footer class="count">
      {{ nf.format(words) }} {{ unitFor(words, 'word', locale) }}&nbsp;&nbsp;·&nbsp;&nbsp;{{ nf.format(paragraphs) }} {{ unitFor(paragraphs, 'paragraph', locale) }}
    </footer>
  </article>
</template>

<style scoped>
.editor-canvas {
  display: grid;
  padding: 34px 44px 14px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  min-block-size: 635px;
  grid-template-rows: auto 1fr auto;
}
.title {
  inline-size: 100%;
  padding: 0 0 18px;
  border: 0;
  border-block-end: 1px solid var(--tilw-border-subtle);
  background: none;
  color: var(--tilw-text-ink);
  font: 700 44px/65px var(--tilw-font-ar);
  outline: none;
}
.title:focus-visible {
  border-block-end-color: var(--tilw-focus-ring);
}
.sheet {
  position: relative;
  margin-block: 34px 24px;
}
/* Shared text metrics: both layers must wrap identically. */
.backdrop,
textarea {
  margin: 0;
  padding: 2px 10px;
  border: 0;
  font: 400 25px/42px var(--tilw-font-ar);
  letter-spacing: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  tab-size: 4;
}
.backdrop {
  color: transparent;
  min-block-size: 280px;
}
textarea {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  resize: none;
  overflow: hidden;
  background: transparent;
  color: var(--tilw-text-ink);
  caret-color: var(--tilw-action-primary);
  outline: none;
}
textarea::placeholder {
  color: var(--tilw-text-muted);
}
.para {
  background: var(--tilw-surface-selected);
  border-radius: 5px;
  box-shadow: 0 0 0 6px var(--tilw-surface-selected);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
.emph {
  background: var(--tilw-stage-cue);
  border-radius: 4px;
}
.note {
  text-decoration: underline dotted var(--tilw-action-primary) 2px;
  text-decoration-color: var(--tilw-action-primary);
  text-underline-offset: 8px;
  /* the backdrop text is transparent; make the underline itself visible */
  -webkit-text-decoration-color: var(--tilw-action-primary);
}
.hit {
  outline: 2px solid color-mix(in srgb, var(--tilw-action-primary) 45%, transparent);
  border-radius: 3px;
}
.hit.on {
  background: color-mix(in srgb, var(--tilw-stage-cue) 70%, transparent);
  outline-color: var(--tilw-action-primary);
}
/* A pause is a zero-width point: its chip floats above the line without moving the text. */
.pz {
  position: relative;
  display: inline-block;
  inline-size: 0;
  block-size: 1em;
  vertical-align: text-top;
}
.pz::after {
  content: attr(data-label);
  position: absolute;
  inset-block-start: -17px;
  inset-inline-start: -2px;
  padding: 0 5px;
  border: 1px dashed var(--tilw-action-primary);
  border-radius: 4px;
  background: var(--tilw-surface-white);
  color: var(--tilw-action-primary);
  font: 500 11px/16px var(--tilw-font-lat);
  white-space: nowrap;
  translate: 50% 0;
}
[dir='ltr'] .pz::after {
  translate: -50% 0;
}
.count {
  padding: 8px 8px 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
  font: 500 13px/21px var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}

@media (max-width: 760px) {
  .editor-canvas {
    padding: 22px 12px 12px;
    min-block-size: 0;
  }
  .title {
    font-size: 31px;
    line-height: 46px;
  }
  .backdrop,
  textarea {
    font-size: 19px;
    line-height: 33px;
    padding-inline: 6px;
  }
  .backdrop {
    min-block-size: 200px;
  }
}
</style>
