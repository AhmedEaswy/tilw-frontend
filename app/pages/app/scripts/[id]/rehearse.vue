<script setup lang="ts">
/**
 * Rehearsal (US5, T060–T066): paused / playing (6:26, 6:27; phone 6:31, 6:32), reading settings docked
 * on desktop (6:28, 6:29) or as a sheet on phones (6:33, 6:34), more controls (6:30, 6:35), recovery when
 * the reading position can't be saved (6:79 → 6:80), and the end-of-script state (G12).
 */
import type { ReadingSettings, TextDirection } from '~/services/types'

definePageMeta({ layout: 'reader' })
const { t, localeProperties } = useI18n()
const route = useRoute()
const reader = useReaderStore()
const errorText = useErrorText()
const { show } = useToast()

const id = computed(() => String(route.params.id))
useHead({ title: () => `${t('reader.title')} · ${reader.script?.title ?? ''} · tilwprompter` })

const settings = computed(() => reader.settings)
const engine = useReaderEngine({ words: computed(() => reader.paragraphWords), pauses: computed(() => reader.pauses), settings })

const uiDir = computed<'rtl' | 'ltr'>(() => (localeProperties.value.dir === 'rtl' ? 'rtl' : 'ltr'))
const reducedMotion = usePreferredReducedMotion()
const smooth = computed(() => reducedMotion.value !== 'reduce')

// ---------- load ----------
async function load() {
  await reader.load(id.value)
  engine.stop()
  engine.seek(positionToProgress(engine.timeline.value, reader.script?.lastPosition))
}
onMounted(load)
watch(id, load)

// ---------- settings panel ----------
const settingsOpen = ref(false)
const settingsView = ref<'main' | 'more'>('main')
const panel = ref<{ focus: () => void }>()
const settingsBtn = ref<HTMLButtonElement>()
function openSettings(view: 'main' | 'more' = 'main') {
  settingsView.value = view
  settingsOpen.value = true
  nextTick(() => panel.value?.focus())
}
function closeSettings() {
  if (!settingsOpen.value) return
  settingsOpen.value = false
  nextTick(() => settingsBtn.value?.focus())
}
function updateSettings(patch: Partial<ReadingSettings>) {
  reader.updateSettings(patch)
}
async function setDirection(d: TextDirection) {
  try {
    await reader.setDirection(d)
  } catch (e) {
    show(`${t('reader.settings.directionFailed')} ${errorText(e)}`, 'error')
  }
}
watch(() => reader.settingsError, (v) => {
  if (v) show(t('reader.settings.saveFailed'), 'error', 6000)
})

// ---------- position saving (every 5 s while playing, on pause, after stepping) ----------
const position = computed(() => progressToPosition(engine.timeline.value, engine.progress.value))
function savePosition() {
  if (reader.status !== 'ready' || !reader.paragraphs.length) return
  void reader.savePosition(position.value)
}
useIntervalFn(() => {
  if (engine.playing.value) savePosition()
}, 5000)
watch(engine.playing, (p) => {
  if (!p) savePosition()
})
watchDebounced(() => engine.paragraph.value, () => {
  if (!engine.playing.value) savePosition()
}, { debounce: 1000 })

// ---------- recovery (6:79 / 6:80) ----------
const recoveryOpen = ref(false)
const recoveryView = ref<'notice' | 'choose'>('notice')
let recoveryDismissed = false
watch(() => reader.positionError, (failed) => {
  if (!failed) {
    recoveryDismissed = false
    return
  }
  if (recoveryDismissed) return
  engine.stop()
  closeSettings()
  recoveryView.value = 'notice'
  recoveryOpen.value = true
})
function resume() {
  recoveryOpen.value = false
  recoveryDismissed = true
}
function choose(i: number) {
  engine.goTo(i)
  resume()
}
const editorPath = computed(() => `/app/scripts/${id.value}`)
function closeReader() {
  recoveryOpen.value = false
  recoveryDismissed = true
  navigateTo(editorPath.value)
}

// ---------- shortcuts (T064) ----------
useShortcuts(
  {
    toggle: () => {
      if (settings.value.mode === 'manual') engine.next()
      else engine.toggle()
    },
    escape: () => {
      if (engine.countdown.value) engine.stop()
      else if (recoveryOpen.value && recoveryView.value === 'choose') recoveryView.value = 'notice'
      else if (settingsOpen.value && settingsView.value === 'more') settingsView.value = 'main'
      else closeSettings()
    },
    next: () => engine.next(),
    prev: () => engine.prev(),
    faster: () => settings.value.mode === 'constant' && updateSettings({ wpm: clampWpm(settings.value.wpm + WPM_STEP) }),
    slower: () => settings.value.mode === 'constant' && updateSettings({ wpm: clampWpm(settings.value.wpm - WPM_STEP) }),
  },
  { direction: computed(() => reader.direction), enabled: computed(() => reader.status === 'ready' && !recoveryOpen.value) },
)

onBeforeRouteLeave(() => {
  engine.stop()
  savePosition()
  reader.flushSettings()
})
onBeforeUnmount(() => {
  reader.flushSettings()
})

</script>

<template>
  <div class="rh" :class="{ docked: settingsOpen }">
    <div class="main">
      <header class="top">
        <NuxtLink :to="editorPath" class="round back" :aria-label="t('library.backToScripts')">
          <UiGlyph name="back" :size="20" />
        </NuxtLink>
        <h1 class="name" dir="auto">{{ reader.script?.title ?? '' }}</h1>
        <p class="mode">{{ t('reader.title') }}</p>
        <NuxtLink :to="`/app/scripts/${id}/record`" class="rec">{{ t('library.setupRecording') }}</NuxtLink>
        <button
          ref="settingsBtn"
          type="button"
          class="round settings"
          :aria-label="t('reader.openSettings')"
          :aria-expanded="settingsOpen"
          @click="settingsOpen ? closeSettings() : openSettings()"
        >
          <UiGlyph name="settings" :size="20" />
        </button>
      </header>

      <div class="stage-body">
        <div v-if="reader.status === 'idle' || reader.status === 'loading'" class="state" aria-busy="true">{{ t('common.loading') }}</div>
        <div v-else-if="reader.status === 'missing' || reader.status === 'error'" class="state">
          <p>{{ reader.status === 'missing' ? t('editor.missingTitle') : errorText(reader.loadError) }}</p>
          <UiButton v-if="reader.status === 'error'" tone="cue" @click="load">{{ t('common.retry') }}</UiButton>
          <UiButton v-else tone="cue" to="/app/scripts">{{ t('library.backToScripts') }}</UiButton>
        </div>
        <ReaderSurface
          v-else
          class="surface"
          :paragraphs="reader.paragraphs"
          :units="reader.units"
          :hold-at="engine.holdAt.value"
          :timeline="engine.timeline.value"
          :progress="engine.progress.value"
          :paragraph="engine.paragraph.value"
          :direction="reader.direction"
          :settings="settings"
          :smooth="smooth"
        >
          <div v-if="!reader.paragraphs.length" class="overlay">
            <p>{{ t('reader.empty') }}</p>
            <UiButton tone="cue" :to="editorPath">{{ t('reader.openEditor') }}</UiButton>
          </div>
          <div v-else-if="engine.ended.value" class="overlay end" role="status">
            <h2>{{ t('reader.end.title') }}</h2>
            <p>{{ t('reader.end.lede') }}</p>
            <div class="end-acts">
              <UiButton tone="cue" icon="rewind" @click="engine.restart()">{{ t('reader.end.restart') }}</UiButton>
              <UiButton tone="dark" :to="`/app/scripts/${id}/record`">{{ t('library.setupRecording') }}</UiButton>
            </div>
          </div>
        </ReaderSurface>
      </div>

      <ReaderControls
        v-if="reader.status === 'ready' && reader.paragraphs.length"
        class="controls"
        :playing="engine.playing.value"
        :counting="engine.countdown.value > 0"
        :manual="settings.mode === 'manual'"
        :wpm="settings.wpm"
        :can-prev="engine.paragraph.value > 0 || engine.ended.value"
        @toggle="engine.toggle()"
        @prev="engine.prev()"
        @next="engine.next()"
        @rewind="engine.rewind()"
        @settings="openSettings()"
      />

      <!-- 6:42 / 6:43: the countdown takes the whole stage below the header. -->
      <CountdownView
        v-if="engine.countdown.value"
        class="countdown"
        :seconds="engine.countdown.value"
        :total="settings.countdownSec"
        :label="t('reader.startsIn')"
        :line="reader.paragraphs[engine.paragraph.value] ?? ''"
        :direction="reader.direction"
        @cancel="engine.stop()"
      />
    </div>

    <div v-if="settingsOpen" class="scrim" aria-hidden="true" @click="closeSettings" />
    <SettingsPanel
      v-if="settingsOpen"
      ref="panel"
      v-model:view="settingsView"
      class="side"
      :settings="settings"
      :direction="reader.script?.direction ?? 'auto'"
      :ui-direction="uiDir"
      @update="updateSettings"
      @direction="setDirection"
      @close="closeSettings"
    />

    <RecoveryView
      v-if="recoveryOpen"
      v-model:view="recoveryView"
      :title="reader.script?.title ?? ''"
      :paragraphs="reader.paragraphs"
      :current="engine.paragraph.value"
      @resume="resume"
      @choose="choose"
      @close="closeReader"
    />
  </div>
</template>

<style scoped>
.rh {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  block-size: 100dvh;
  overflow: hidden;
}
.rh.docked {
  grid-template-columns: 428px minmax(0, 1fr);
}
.rh.docked .side {
  grid-column: 1;
  grid-row: 1;
  border-inline-end: 1px solid var(--tilw-border-subtle);
}
.rh.docked .main {
  grid-column: 2;
  grid-row: 1;
}
.main {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-inline-size: 0;
  padding-block-end: 52px;
}

/* header (94 px with a divider) */
.top {
  display: grid;
  grid-template-columns: 44px minmax(0, auto) minmax(0, 1fr) auto 44px;
  align-items: center;
  gap: 20px;
  block-size: 94px;
  padding-inline: max(32px, env(safe-area-inset-left, 0px)) max(34px, env(safe-area-inset-right, 0px));
  border-block-end: 1px solid var(--tilw-stage-surface);
}
.round {
  display: inline-grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
}
.round:hover {
  background: #15222a;
}
.settings {
  color: var(--tilw-stage-cue);
}
.round:focus-visible,
.rec:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.name {
  margin: 0;
  overflow: hidden;
  font: 700 24px/1.36 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mode {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 400 16px/1.36 var(--tilw-font-ar);
  text-align: center;
}
.rec {
  color: var(--tilw-stage-text);
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.rec:hover {
  text-decoration: underline;
}

.stage-body {
  display: grid;
  min-block-size: 0;
  padding: 31px 64px 62px;
}
.surface {
  inline-size: min(1152px, 100%);
  justify-self: center;
}
.state {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 20px;
  color: var(--tilw-stage-secondary);
  font: 400 18px/1.5 var(--tilw-font-ar);
  text-align: center;
}
.state p {
  margin: 0;
}
.controls {
  inline-size: min(1036px, calc(100% - 48px));
  margin-inline: auto;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 16px;
  padding: 24px;
  background: color-mix(in srgb, #202f38 95%, transparent);
  color: var(--tilw-stage-text);
  text-align: center;
}
.overlay p {
  max-inline-size: 520px;
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 400 18px/1.5 var(--tilw-font-ar);
}
.end h2 {
  margin: 0;
  font: 700 40px/1.36 var(--tilw-font-ar);
}
.end-acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-block-start: 12px;
}

.countdown {
  position: absolute;
  inset: 94px 0 0;
  z-index: 5;
  background: var(--tilw-stage-background);
}

.scrim {
  display: none;
}

/* Docked panel narrows the stage (6:28: 852 px stage + 428 px inspector). */
.rh.docked .top {
  grid-template-columns: 44px minmax(0, auto) minmax(0, 1fr) auto 44px;
  padding-inline: 32px 34px;
}
.rh.docked .stage-body {
  padding: 57px 22px 65px;
}
.rh.docked .controls {
  inline-size: min(777px, calc(100% - 48px));
  border-radius: 18px;
}

/* Tablet and narrow desktop: the panel floats over the stage instead of docking. */
@media (max-width: 1100px) {
  .rh.docked {
    grid-template-columns: minmax(0, 1fr);
  }
  .rh.docked .main {
    grid-column: 1;
  }
  .rh.docked .side {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 20;
    inline-size: min(428px, 100vw);
    box-shadow: var(--tilw-shadow-pop);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 19;
    display: block;
    background: rgba(10, 18, 22, 0.45);
  }
  .stage-body {
    padding-inline: 24px;
  }
}

/* Phone (6:31 / 6:33): compact header, no mode label or recording link, panel as a bottom sheet. */
@media (max-width: 760px) {
  .main {
    padding-block-end: calc(32px + env(safe-area-inset-bottom, 0px));
  }
  .top {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    gap: 16px;
    block-size: 73px;
    padding-inline: max(14px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
  }
  .mode,
  .rec {
    display: none;
  }
  .countdown {
    inset-block-start: 73px;
  }
  .name {
    font: 500 20px/1.36 var(--tilw-font-ar);
  }
  .stage-body,
  .rh.docked .stage-body {
    padding: 27px 9px 40px;
  }
  .controls,
  .rh.docked .controls {
    inline-size: calc(100% - 32px);
  }
  .rh.docked .side {
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: 100%;
    block-size: min(700px, 88dvh);
    border-start-start-radius: 19px;
    border-start-end-radius: 19px;
    overflow: hidden;
  }
  .overlay p {
    font-size: 16px;
  }
  .end h2 {
    font-size: 28px;
  }
}

/* Landscape phones (6:36): give the glass the height. */
@media (max-height: 500px) and (orientation: landscape) {
  .top {
    block-size: 60px;
  }
  .countdown {
    inset-block-start: 60px;
  }
  .stage-body {
    padding-block: 8px 12px;
  }
  .main {
    padding-block-end: 12px;
  }
  .surface :deep(.row) {
    display: none;
  }
}
</style>
