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
const link = useLinkStore()
// Feature 007: each finished run (10 s or more) is logged as practice in the background; driven from a linked phone
// it counts as `phone`. Manual mode has no playing state, so each step is activity.
const practice = usePracticeRun({
  scriptId: () => reader.script?.id ?? null,
  playing: engine.playing,
  ended: engine.ended,
  via: () => (link.status === 'connected' ? 'phone' : 'web'),
})
watch(() => engine.paragraph.value, () => {
  if (settings.value.mode === 'manual' && reader.status === 'ready') practice.touch()
})

const uiDir = computed<'rtl' | 'ltr'>(() => (localeProperties.value.dir === 'rtl' ? 'rtl' : 'ltr'))
const reducedMotion = usePreferredReducedMotion()
const smooth = computed(() => reducedMotion.value !== 'reduce')

// ---------- load ----------
async function load() {
  await reader.load(id.value)
  engine.stop()
  engine.seek(positionToProgress(engine.timeline.value, reader.script?.lastPosition))
  // Feature 004: a phone linked to this script before a reload reconnects to the studio without a new code.
  if (reader.status === 'ready') void link.resume(id.value)
}
onMounted(load)
watch(id, load)

// ---------- settings panel ----------
const settingsOpen = ref(false)
const settingsView = ref<'main' | 'more'>('main')
const panel = ref<{ focus: () => void }>()
const settingsBtn = ref<HTMLButtonElement>()
function openSettings(view: 'main' | 'more' = 'main') {
  linkOpen.value = false
  settingsView.value = view
  settingsOpen.value = true
  nextTick(() => panel.value?.focus())
}

// ---------- feature 004: Connect phone (Figma L1, L2) ----------
const linkOpen = ref(false)
const linkPanel = ref<{ focus: () => void }>()
const linkBtn = ref<{ $el: HTMLElement }>()
function openLink() {
  settingsOpen.value = false
  linkOpen.value = true
  // Opening the panel starts the link when there isn't one for this script yet.
  if (link.status === 'idle' || (link.status === 'ended' && link.link?.scriptId !== id.value)) void link.open(id.value)
  nextTick(() => linkPanel.value?.focus())
}
function closeLink() {
  if (!linkOpen.value) return
  linkOpen.value = false
  if (link.status === 'ended') link.reset()
  nextTick(() => linkBtn.value?.$el.focus())
}
const docked = computed(() => settingsOpen.value || linkOpen.value)
// The rehearsal shows requests unless the countdown runs.
const requestQuiet = computed(() => engine.countdown.value > 0)
// ---------- feature 004 US4: requests (Figma L3) and the studio as remote (L7) ----------
const linkRequest = computed(() => {
  if (linkOpen.value || requestQuiet.value) return null
  if (link.pendingRemote) return { kind: 'remote' as const, name: link.pendingRemote.name, expiresAt: null }
  const rr = link.state?.roleRequest
  return rr ? { kind: 'roles' as const, player: rr.player, expiresAt: rr.expiresAt } : null
})
const linkBadge = computed(() => !!link.pendingRemote || !!link.state?.roleRequest)
function acceptRequest() {
  if (linkRequest.value?.kind === 'remote') void link.acceptRemote()
  else void link.answerRoles(true)
}
function declineRequest() {
  if (linkRequest.value?.kind === 'remote') void link.declineRemote()
  else void link.answerRoles(false)
}
// Roles swapped: the app reads, so this page's own reader stays paused.
watch(() => link.studioIsRemote, (on) => { if (on) engine.stop() })

/** The phone drives this page through the same functions as its buttons and shortcuts (research R6). */
const player = useLinkPlayer(() => ({
  scriptId: id.value,
  apply: cmd => applyReadingCommand(cmd, {
    engine,
    settings: settings.value,
    update: updateSettings,
    ready: reader.status === 'ready' && reader.paragraphs.length > 0,
    blocked: recoveryOpen.value,
  }),
  snapshot: () => readingSnapshot({ title: reader.script?.title, paragraphs: reader.paragraphs, engine, settings: settings.value }),
}))
watch(
  () => [engine.paragraph.value, engine.playing.value, engine.ended.value, settings.value.wpm, settings.value.fontSize, settings.value.mode, reader.script?.title, reader.paragraphs.length],
  () => player.changed(),
)
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
      else if (linkOpen.value) closeLink()
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
  <div class="rh" :class="{ docked }">
    <div class="main">
      <header class="top">
        <NuxtLink :to="editorPath" class="round back" :aria-label="t('library.backToScripts')">
          <UiGlyph name="back" :size="20" />
        </NuxtLink>
        <h1 class="name" dir="auto"><UiSkeleton v-if="!reader.script && (reader.status === 'idle' || reader.status === 'loading')" tone="stage" h="22px" w="min(220px, 100%)" r="6px" inline /><template v-else>{{ reader.script?.title ?? '' }}</template></h1>
        <p class="mode">{{ t('reader.title') }}</p>
        <div class="link-ind">
          <LinkIndicator
            ref="linkBtn"
            :status="link.status"
            :badge="linkBadge"
            :expanded="linkOpen"
            @open="linkOpen ? closeLink() : openLink()"
          />
          <LinkRequest
            v-if="linkRequest"
            :kind="linkRequest.kind"
            :name="linkRequest.kind === 'remote' ? linkRequest.name : undefined"
            :player="linkRequest.kind === 'roles' ? linkRequest.player : undefined"
            :expires-at="linkRequest.expiresAt"
            @accept="acceptRequest"
            @decline="declineRequest"
          />
        </div>
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
        <SkeletonRegion v-if="reader.status === 'idle' || reader.status === 'loading'" class="surface wait" data-testid="reader-skeleton">
          <ReaderSkeleton class="wait-monitor" />
        </SkeletonRegion>
        <div v-else-if="reader.status === 'missing' || reader.status === 'error'" class="state">
          <p>{{ reader.status === 'missing' ? t('editor.missingTitle') : errorText(reader.loadError) }}</p>
          <UiButton v-if="reader.status === 'error'" tone="cue" @click="load">{{ t('common.retry') }}</UiButton>
          <UiButton v-else tone="cue" to="/app/scripts">{{ t('library.backToScripts') }}</UiButton>
        </div>
        <StudioRemote v-else-if="link.studioIsRemote" class="surface studio-remote" />
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

      <!-- The transport bar's place while the script loads, so the monitor does not grow and shrink back. -->
      <div v-if="reader.status === 'idle' || reader.status === 'loading'" class="controls transport-skel" aria-hidden="true">
        <span class="t-main"><UiSkeleton tone="stage" h="44px" w="44px" r="50%" /><UiSkeleton tone="stage" h="48px" w="132px" r="12px" /><UiSkeleton tone="stage" h="44px" w="44px" r="50%" /></span>
        <span class="t-extra"><UiSkeleton tone="stage" h="44px" w="44px" r="50%" /><UiSkeleton tone="stage" h="16px" w="90px" r="4px" /></span>
      </div>
      <ReaderControls
        v-else-if="reader.status === 'ready' && reader.paragraphs.length && !link.studioIsRemote"
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
    <div v-if="linkOpen" class="scrim" aria-hidden="true" @click="closeLink" />
    <ConnectPanel v-if="linkOpen" ref="linkPanel" class="side" :script-id="id" @close="closeLink" />
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
/* Feature 004 US4: the request popover hangs under the indicator. */
.link-ind {
  position: relative;
}
.studio-remote {
  align-self: start;
  margin-block-start: 24px;
}
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
  grid-template-columns: 44px minmax(0, auto) minmax(0, 1fr) auto auto 44px;
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
/* Loading: the monitor's shape fills the stage like the real one; the transport bar's shape sits below. */
.wait {
  display: grid;
  min-block-size: 0;
}
.transport-skel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-block-size: 86px;
  padding-inline: 18px 40px;
  border: 1px solid rgba(247, 242, 233, 0.16);
  border-radius: 25px;
  background: var(--tilw-stage-surface);
}
.transport-skel :deep(.ui-skel.t-stage) {
  --skel-base: color-mix(in srgb, var(--tilw-stage-background) 75%, var(--tilw-stage-surface));
}
.t-main,
.t-extra {
  display: flex;
  align-items: center;
  gap: 17px;
}
@media (max-width: 760px) {
  .t-extra {
    display: none;
  }
  .transport-skel {
    justify-content: center;
    padding-inline: 18px;
  }
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
  grid-template-columns: 44px minmax(0, auto) minmax(0, 1fr) auto auto 44px;
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
    grid-template-columns: 44px minmax(0, 1fr) auto 44px;
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
