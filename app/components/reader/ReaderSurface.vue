<script setup lang="ts">
/**
 * Reading monitor from "Rehearsal" (6:26 desktop, 6:31 phone): housing with the paragraph position row and
 * an inset glass. The script is shown as phrase blocks (one per stop, see utils/phrases.ts) that move under
 * a fixed reading point with `transform` only: the block being read is lit, the rest are dimmed and fade at
 * the glass edges. A gap between blocks is a stop; a pause mark from the editor shows as a chip and the
 * reader holds on it (see useReaderEngine).
 *
 * Deviation (logged in gaps.md): the cue band of the Figma frames is gone, because it covered the lines next
 * to the one being read. Every block keeps one size so nothing reflows while reading.
 */
import type { ReadingSettings } from '~/services/types'
import type { ReaderLayout, Timeline } from '~/utils/reader'

const props = defineProps<{
  paragraphs: string[]
  /** Phrase blocks per paragraph; derived from `paragraphs` (without pauses) when not given. */
  units?: Phrase[][]
  /** Word position of the pause being held, or null. */
  holdAt?: number | null
  timeline: Timeline
  progress: number
  paragraph: number
  direction: 'rtl' | 'ltr'
  settings: ReadingSettings
  /** Step between paragraphs with a short ease (manual mode, not when reduced motion is on). */
  smooth: boolean
  /** Prompter inside the recording monitor (6:44): no housing or glass of its own, label only. */
  bare?: boolean
}>()

const { t } = useI18n()
const column = ref<HTMLElement>()
const glass = ref<HTMLElement>()
const layout = ref<ReaderLayout>({ tops: [], heights: [], lineH: 0 })
const blocks = computed(() => props.units ?? props.paragraphs.map(p => splitPhrases(p)))
/** Every phrase in reading order with its paragraph, its place in the script and the pause that follows. */
const flat = computed(() => {
  let at = 0
  return blocks.value.flatMap((u, pi) => u.map((p, i) => {
    at += p.words
    return { ...p, pi, last: i === u.length - 1, end: at }
  }))
})
/** Timeline of the phrases, so the view steps from one block to the next. */
const phraseTl = computed(() => buildTimeline(flat.value.map(p => p.words)))
const current = computed(() => paragraphOfProgress(phraseTl.value, props.progress))
const glassH = ref(0)
/** Ease between positions only after the web font is in, so the first layout doesn't visibly slide. */
const ready = ref(false)

function measure() {
  const col = column.value
  if (!col) return
  const ps = [...col.querySelectorAll<HTMLElement>('.ph')]
  const lh = Number.parseFloat(getComputedStyle(col).lineHeight) || 0
  layout.value = { tops: ps.map(p => p.offsetTop), heights: ps.map(p => p.offsetHeight), lineH: lh }
  glassH.value = glass.value?.clientHeight ?? 0
}

let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(() => measure())
  if (column.value) ro.observe(column.value)
  if (glass.value) ro.observe(glass.value)
  measure()
  // Web fonts change line metrics once they load.
  const settle = () => {
    measure()
    requestAnimationFrame(() => (ready.value = true))
  }
  if (document.fonts) document.fonts.ready.then(settle).catch(settle)
  else settle()
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [props.paragraphs, props.units, props.settings.fontSize, props.settings.lineWidth], () => nextTick(measure), { deep: true })

const y = computed(() => progressToY(phraseTl.value, layout.value, props.progress))
/** The block being read starts a little above the middle of the glass, so what comes next stays in view. */
const readingTop = computed(() => Math.round(glassH.value * 0.3))
const shift = computed(() => readingTop.value - y.value)

const fontPx = computed(() => FONT_PX[props.settings.fontSize])
const linePx = computed(() => LINE_PX[props.settings.lineWidth])

const nf = computed(() => new Intl.NumberFormat('en'))
/** Position bars: one per paragraph, capped so long scripts still fit the housing. */
const bars = computed(() => {
  const n = props.paragraphs.length
  const max = 12
  if (n <= max) return Array.from({ length: n }, (_, i) => (i < props.paragraph ? 'done' : i === props.paragraph ? 'now' : 'next'))
  const at = Math.round((props.paragraph / Math.max(1, n - 1)) * (max - 1))
  return Array.from({ length: max }, (_, i) => (i < at ? 'done' : i === at ? 'now' : 'next'))
})

defineExpose({ measure })
</script>

<template>
  <section class="monitor" :class="{ bare }" :aria-label="t('reader.position')">
    <div class="row">
      <p class="where" aria-live="polite">{{ t('library.paragraphOf', { n: nf.format(paragraph + 1), total: nf.format(paragraphs.length) }) }}</p>
      <div v-if="!bare" class="bars" aria-hidden="true"><i v-for="(b, i) in bars" :key="i" :class="b" /></div>
    </div>
    <div ref="glass" class="glass" :style="{ '--fs': `${fontPx}`, '--lw': `${linePx}px` }">
      <div class="mirror" :class="{ on: settings.mirror }">
        <div
          ref="column"
          class="column"
          :class="{ smooth: smooth && ready }"
          :dir="direction"
          :style="{ transform: `translate3d(0, ${shift}px, 0)` }"
        >
          <template v-for="(p, i) in flat" :key="i">
            <p class="ph" :class="{ now: i === current, past: i < current, end: p.last }" :aria-current="i === current ? 'true' : undefined">{{ p.text }}</p>
            <p v-if="p.pause" class="pz" :class="{ hold: holdAt === p.end }" aria-hidden="true">
              <UiGlyph name="pause" :size="14" />{{ t('reader.pauseMark', { s: nf.format(p.pause) }) }}
            </p>
          </template>
        </div>
      </div>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.monitor {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-block-size: 0;
  padding: 0 9px 9px;
  border: 1px solid rgba(247, 242, 233, 0.15);
  border-radius: 32px;
  background: linear-gradient(to bottom, #2f3e46, #19272f);
  box-shadow: 0 9px 28px rgba(0, 0, 0, 0.19);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  block-size: 61px;
  padding-inline: 70px 55px;
}
.where {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 17px/28px var(--tilw-font-ar);
}
.bars {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bars i {
  inline-size: 17px;
  block-size: 3px;
  border-radius: 2px;
  background: #626b6f;
}
.bars i.done {
  background: #9f7e69;
}
.bars i.now {
  inline-size: 36px;
  block-size: 4px;
  background: var(--tilw-stage-cue);
  box-shadow: 0 0 3px rgba(242, 178, 139, 0.2);
}

.glass {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.52);
  border-radius: 24px;
  background: linear-gradient(to bottom, #202f38, #273945);
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.3);
}
.mirror {
  position: absolute;
  inset: 0;
  /* The lines fade out toward the glass edges so the eye stays on the block being read. */
  mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent);
}
.mirror.on {
  transform: scaleX(-1);
}
.column {
  inline-size: min(var(--lw), calc(100% - 96px));
  margin-inline: auto;
  color: var(--tilw-stage-secondary);
  font: 400 calc(var(--fs) * 1px) / 1.43 var(--tilw-font-ar);
  will-change: transform;
}
.column.smooth {
  transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.column .ph {
  margin: 0 0 0.5em;
  text-align: start;
  transition: color 0.25s, opacity 0.25s;
}
/* A sentence break is a stop: the gap after it is wider than the line gap inside a block. */
.column .ph.end {
  margin-block-end: 1em;
}
.column .ph.now {
  color: var(--tilw-stage-text);
}
.column .ph:not(.now) {
  opacity: 0.5;
}
.column .ph.past {
  opacity: 0.32;
}
/* Pause mark from the editor: a chip where the speaker stops, lit while the reader is holding. */
.column .pz {
  display: flex;
  align-items: center;
  gap: 6px;
  inline-size: fit-content;
  margin: 0 0 0.9em;
  padding: 3px 12px;
  border: 1px solid var(--tilw-stage-secondary);
  border-radius: 14px;
  color: var(--tilw-stage-secondary);
  font: 500 15px/20px var(--tilw-font-ar);
}
.column .pz.hold {
  border-color: var(--tilw-stage-cue);
  color: var(--tilw-stage-cue);
}
.column[dir='ltr'] {
  font-family: var(--tilw-font-lat);
}

/* Recording prompter (6:44): the capture monitor provides the glass. */
.monitor.bare {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
.bare .row {
  block-size: 64px;
  padding-inline: 38px 24px;
}
.bare .glass {
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
.bare .column {
  inline-size: calc(100% - 60px);
  margin-inline: 16px auto;
}

@media (prefers-reduced-motion: reduce) {
  .column.smooth,
  .column .ph {
    transition: none;
  }
}

/* Phone (6:31): smaller housing radius, the cue line at 30 px for the default size. */
@media (max-width: 760px) {
  .monitor {
    padding: 0 6px 6px;
    border-radius: 26px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.19);
  }
  .row {
    block-size: 53px;
    padding-inline: 24px 32px;
  }
  .where {
    font: 400 15px/24px var(--tilw-font-ar);
  }
  .bars i {
    inline-size: 12px;
  }
  .bars i.now {
    inline-size: 27px;
  }
  .glass {
    border-radius: 20px;
  }
  .column {
    inline-size: calc(100% - 50px);
    font-size: calc(var(--fs) * 0.625px);
  }
}
</style>
