<script setup lang="ts">
/**
 * Reading settings, docked beside the script on desktop (6:28 constant, 6:29 manual) and a sheet on phones
 * (6:33, 6:34). "خيارات إضافية" swaps in the more-controls view (6:30, 6:35, 6:107).
 * Every change applies at once; the page saves it to the account (G15). Direction saves to the script.
 */
import type { ReadingSettings, TextDirection } from '~/services/types'
import { FONT_PX, FONT_STEPS, LINE_PX, LINE_STEPS } from '~/utils/reader'

const props = withDefaults(
  defineProps<{ settings: ReadingSettings; direction?: TextDirection; uiDirection: 'rtl' | 'ltr'; showDirection?: boolean }>(),
  { direction: 'auto', showDirection: true },
)
const emit = defineEmits<{ update: [patch: Partial<ReadingSettings>]; direction: [d: TextDirection]; close: [] }>()
const view = defineModel<'main' | 'more'>('view', { default: 'main' })

const { t } = useI18n()
const titleId = useId()
const nf = computed(() => new Intl.NumberFormat('en'))

const mode = computed({ get: () => props.settings.mode, set: v => emit('update', { mode: v }) })
const wpm = computed({ get: () => props.settings.wpm, set: v => emit('update', { wpm: clampWpm(v) }) })
const fontIdx = computed({
  get: () => FONT_STEPS.indexOf(props.settings.fontSize),
  set: i => emit('update', { fontSize: FONT_STEPS[i]! }),
})
const lineIdx = computed({
  get: () => LINE_STEPS.indexOf(props.settings.lineWidth),
  set: i => emit('update', { lineWidth: LINE_STEPS[i]! }),
})
const mirror = computed({ get: () => props.settings.mirror, set: v => emit('update', { mirror: v }) })
const countdown = computed({ get: () => props.settings.countdownSec, set: v => emit('update', { countdownSec: v }) })
const dir = computed({ get: () => props.direction, set: v => emit('direction', v) })

const modeOptions = computed(() => [
  { value: 'constant' as const, label: t('reader.settings.constant') },
  { value: 'manual' as const, label: t('reader.settings.manual') },
])
const dirOptions = computed(() => [
  { value: 'auto' as const, label: t('reader.settings.dirAuto') },
  { value: 'rtl' as const, label: t('reader.settings.dirRtl') },
  { value: 'ltr' as const, label: t('reader.settings.dirLtr') },
])
const countdownOptions = computed(() => [
  { value: 0 as const, label: t('reader.settings.none') },
  ...([3, 5, 10] as const).map(n => ({ value: n, label: t('reader.settings.seconds', { n: nf.value.format(n) }) })),
])

const pct = computed(() => ((props.settings.wpm - WPM_MIN) / (WPM_MAX - WPM_MIN)) * 100)
const trackStyle = computed(() => {
  const to = props.uiDirection === 'rtl' ? 'left' : 'right'
  return {
    background: `linear-gradient(to ${to}, var(--tilw-action-primary) ${pct.value}%, var(--tilw-border-strong) ${pct.value}%)`,
  }
})

const doneBtn = ref<{ $el: HTMLElement }>()
const firstMore = ref<HTMLElement>()
watch(view, v => nextTick(() => (v === 'more' ? firstMore.value?.focus() : undefined)))
defineExpose({ focus: () => doneBtn.value?.$el.focus() })
</script>

<template>
  <aside class="panel" role="dialog" :aria-labelledby="titleId" data-reader-panel>
    <header>
      <h2 :id="titleId">{{ t('reader.settings.title') }}</h2>
      <UiButton ref="doneBtn" tone="secondary" class="done" @click="emit('close')">{{ t('reader.settings.done') }}</UiButton>
    </header>

    <div class="scroll">
      <template v-if="view === 'main'">
        <h3>{{ t('reader.settings.mode') }}</h3>
        <UiSegmented v-model="mode" class="seg tall" :options="modeOptions" :label="t('reader.settings.mode')" />

        <template v-if="settings.mode === 'constant'">
          <div class="field">
            <span>{{ t('reader.settings.wpm') }}</span>
            <UiStepper v-model="wpm" :min="WPM_MIN" :max="WPM_MAX" :step="WPM_STEP" :label="t('reader.settings.wpm')" />
          </div>
          <input
            v-model.number="wpm"
            class="range"
            type="range"
            :min="WPM_MIN"
            :max="WPM_MAX"
            :step="WPM_STEP"
            :aria-label="t('reader.settings.speed')"
            :style="trackStyle"
          >
        </template>

        <hr>
        <h3>{{ t('reader.settings.shape') }}</h3>
        <div class="field">
          <span>{{ t('reader.settings.fontSize') }}</span>
          <UiStepper v-model="fontIdx" :min="0" :max="FONT_STEPS.length - 1" :label="t('reader.settings.fontSize')" :format="i => String(FONT_PX[FONT_STEPS[i]!])" />
        </div>
        <div class="field">
          <span :id="`${titleId}-mirror`">{{ t('reader.settings.mirror') }}</span>
          <UiSwitch v-model="mirror" :label="t('reader.settings.mirror')" />
        </div>

        <hr>
        <button type="button" class="more" @click="view = 'more'">
          <span>{{ t('reader.settings.more') }}</span>
          <UiGlyph name="arr" :size="20" />
        </button>
        <p class="hint">{{ t('reader.settings.moreHint') }}</p>
      </template>

      <template v-else>
        <button ref="firstMore" type="button" class="back" @click="view = 'main'">{{ t('reader.settings.backToSettings') }}</button>
        <h3>{{ t('reader.settings.textWidth') }}</h3>
        <div class="field">
          <span>{{ t('reader.settings.lineWidth') }}</span>
          <UiStepper v-model="lineIdx" :min="0" :max="LINE_STEPS.length - 1" :label="t('reader.settings.lineWidth')" :format="i => String(LINE_PX[LINE_STEPS[i]!])" />
        </div>
        <hr>
        <template v-if="showDirection">
          <h3>{{ t('reader.settings.direction') }}</h3>
          <UiSegmented v-model="dir" class="seg" :options="dirOptions" :label="t('reader.settings.direction')" />
        </template>
        <h3>{{ t('reader.settings.countdown') }}</h3>
        <UiSegmented v-model="countdown" class="seg" :options="countdownOptions" :label="t('reader.settings.countdown')" />
        <hr>
        <h3>{{ t('reader.settings.shortcuts') }}</h3>
        <dl class="keys">
          <div><dt>{{ t('reader.settings.space') }}</dt><dd>{{ t('reader.settings.spaceDo') }}</dd></div>
          <div><dt class="lat">Esc</dt><dd>{{ t('reader.settings.escDo') }}</dd></div>
          <div><dt>{{ t('reader.settings.arrows') }}</dt><dd>{{ t('reader.settings.arrowsDo') }}</dd></div>
        </dl>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  block-size: 100%;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  block-size: 82px;
  padding-inline: 28px;
  border-block-end: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
}
h2 {
  margin: 0;
  font: 700 26px/1.36 var(--tilw-font-ar);
}
.done {
  min-inline-size: 67px;
  padding-inline: 12px;
}
.scroll {
  display: grid;
  align-content: start;
  gap: 15px;
  padding: 24px 28px 40px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
h3 {
  margin: 0;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
hr {
  inline-size: 100%;
  margin: 8px 0;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.seg {
  min-block-size: 44px;
}
.seg.tall {
  min-block-size: 50px;
}
.seg :deep(button) {
  font-size: 15px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-block-size: 48px;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.field :deep(.ui-step) {
  grid-template-columns: 44px 59px 44px;
}
.range {
  inline-size: calc(100% - 6px);
  block-size: 5px;
  margin: 8px 3px;
  border-radius: 3px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  inline-size: 22px;
  block-size: 22px;
  border: 0;
  border-radius: 11px;
  background: var(--tilw-action-primary);
}
.range::-moz-range-thumb {
  inline-size: 22px;
  block-size: 22px;
  border: 0;
  border-radius: 11px;
  background: var(--tilw-action-primary);
}
.range:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 8px;
}
.more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-block-size: 62px;
  padding-inline: 18px 15px;
  border: 0;
  border-radius: 12px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: 500 20px/1.36 var(--tilw-font-ar);
  text-align: start;
}
.more .ui-glyph {
  color: var(--tilw-action-primary);
}
.more:hover {
  background: var(--tilw-surface-selected);
}
.hint {
  margin: -4px 0 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-ar);
}
.back {
  justify-self: start;
  margin-block-end: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.back:hover {
  text-decoration: underline;
}
.keys {
  display: grid;
  gap: 0;
  margin: 0;
  color: var(--tilw-text-muted);
  font: 500 16px/1.65 var(--tilw-font-ar);
}
.keys div {
  display: flex;
  gap: 12px;
}
.keys dd {
  margin: 0;
}
.lat {
  font-family: var(--tilw-font-lat);
}
.more:focus-visible,
.back:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  header {
    block-size: 81px;
    padding-inline: 23px;
  }
  h2 {
    font-size: 25px;
  }
  .scroll {
    padding-inline: 23px;
  }
}
</style>
