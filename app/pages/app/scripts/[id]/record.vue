<script setup lang="ts">
/**
 * Recording studio (US6, T070–T076).
 * Setup: camera / audio before permission (6:38, 6:50; phone 6:40, 6:52), preview with devices
 * (6:39, 6:41) or sound check (6:51, 6:53), permission denied (6:78; desktop per G12).
 * Then the countdown (6:42 / 6:54) and the capture screen with the prompter (6:44 / 6:56).
 * Takes are saved to IndexedDB; a take that stops on its own (the plan's take length, device lost, storage full) is
 * still saved (G8). Camera and microphone are requested only from the enable button (constitution IV).
 * Feature 004 US3 (T037): a linked phone can Record and Stop through this page's own Start / Stop (Figma L5 recording
 * `286:424`); the link never stops a take by itself.
 */
import type { FinishedTake } from '~/composables/useRecorder'

definePageMeta({ layout: 'reader' })
const { t, locale } = useI18n()
const route = useRoute()
const reader = useReaderStore()
const takes = useTakesStore()
const plan = usePlanStore()
const link = useLinkStore()

// ---------- release 2: plan-based take length (R2-6) ----------
const limitMs = computed(() => recordLimitMs(plan.limit('takes.max_minutes')))
const limitMinutes = computed(() => Math.round(limitMs.value / 60_000))
const proMinutes = computed(() => {
  const v = plan.plans.find(p => p.key === 'pro')?.limits.find(l => l.key === 'takes.max_minutes')?.value
  return typeof v === 'number' ? v : null
})
const minutesText = (n: number) => `${n} ${unitFor(n, 'minute', locale.value)}`
const takeLimitText = computed(() => {
  if (!Number.isFinite(limitMs.value)) return t('studio.takeNoLimit')
  const base = t('studio.takeLimitN', { time: minutesText(limitMinutes.value) })
  return !plan.isPro && proMinutes.value && proMinutes.value > limitMinutes.value
    ? `${base} · ${t('studio.takeLimitPro', { n: proMinutes.value })}`
    : base
})
const { show } = useToast()
const errorText = useErrorText()

const id = computed(() => String(route.params.id))
const editorPath = computed(() => `/app/scripts/${id.value}`)
const rehearsePath = computed(() => `/app/scripts/${id.value}/rehearse`)
useHead({ title: () => `${t('studio.setup')} · ${reader.script?.title ?? ''} · tilwprompter` })

// ---------- devices ----------
const media = useMediaDevices({
  onLost: () => {
    if (phase.value === 'setup') {
      media.stop()
      show(t('studio.deviceLost'), 'error')
    }
  },
})
const { level, history } = useLevelMeter(media.stream)
const kind = computed({
  get: () => media.kind.value,
  set: (k) => {
    if (k === media.kind.value) return
    const wasLive = media.state.value === 'ready'
    media.stop()
    media.kind.value = k
    media.state.value = 'idle'
    if (wasLive) void media.start(k)
  },
})
const live = computed(() => media.state.value === 'ready' && !!media.stream.value)
const problem = computed(() => (['denied', 'unavailable', 'error'] as const).find(s => s === media.state.value) ?? null)
const modeOptions = computed(() => [
  { value: 'video' as const, label: t('studio.video'), icon: 'video' as const },
  { value: 'audio' as const, label: t('studio.audio'), icon: 'mic' as const },
])

async function enable() {
  const ok = await media.start(kind.value)
  if (ok) void takes.refreshEstimate()
}
function closePreview() {
  media.stop()
}

// ---------- load ----------
onMounted(async () => {
  await reader.load(id.value)
  engine.seek(0)
  // Feature 004: a phone linked to this script before a reload reconnects without a new code.
  if (reader.status === 'ready') void link.resume(id.value)
  void takes.load().catch(() => {})
  if (!plan.my) void plan.load()
  if (!plan.plans.length) void plan.loadPublic().catch(() => {})
})

// ---------- prompter ----------
const settings = computed(() => reader.settings)
const engine = useReaderEngine({ words: computed(() => reader.paragraphWords), pauses: computed(() => reader.pauses), settings })
const reducedMotion = usePreferredReducedMotion()
const smooth = computed(() => reducedMotion.value !== 'reduce')

// ---------- countdown → recording ----------
type Phase = 'setup' | 'countdown' | 'recording'
const phase = ref<Phase>('setup')
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | undefined
const saving = ref(false)

const recorder = useRecorder({ onAutoStop: take => void keep(take) })

// ---------- release 2: uploads wait while the studio counts down or records (constitution V) ----------
const uploads = useUploadsStore()
const storage = useStorageStore()
onMounted(() => !storage.status && storage.load().catch(() => {}))
const autoSync = computed(() => storage.linked && storage.syncMode === 'auto')
watch(phase, p => (p === 'setup' ? uploads.resume() : uploads.pause()))
onBeforeUnmount(() => uploads.resume())

function startCountdown() {
  if (!live.value) return
  const sec = settings.value.countdownSec
  if (!sec) return beginTake()
  countdown.value = sec
  phase.value = 'countdown'
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      void beginTake()
    }
  }, 1000)
}
function cancelCountdown() {
  clearInterval(countdownTimer)
  countdown.value = 0
  phase.value = 'setup'
}

async function beginTake() {
  const s = media.stream.value
  if (!s) return cancelCountdown()
  const free = await takes.refreshEstimate()
  const ok = await recorder.start(s, kind.value, free, limitMs.value)
  if (!ok) {
    phase.value = 'setup'
    show(t('studio.recordFailed'), 'error')
    return
  }
  phase.value = 'recording'
  takeStartedAt.value = new Date().toISOString()
  takeSaved.value = false
  engine.seek(0)
  if (settings.value.mode === 'constant') engine.play({ countdown: false })
}

async function stopTake() {
  if (saving.value) return
  const take = await recorder.stop('user')
  if (take) await keep(take)
}

// A failed save keeps the file here so it can still be downloaded (6:48 pattern).
const unsaved = shallowRef<{ blob: Blob; mimeType: string } | null>(null)

async function keep(take: FinishedTake) {
  engine.stop()
  saving.value = true
  try {
    if (!take.blob.size) throw new Error('empty')
    const meta = await takes.save({
      scriptId: id.value,
      scriptTitle: reader.script?.title ?? '',
      kind: kind.value,
      mimeType: take.mimeType,
      durationMs: take.durationMs,
      blob: take.blob,
      ...(take.reason === 'user' ? {} : { endedBy: take.reason }),
    })
    media.stop()
    phase.value = 'setup'
    takeSaved.value = true
    saving.value = false // stored: the phone may show "saved" now
    // Auto sync: the take starts uploading once the studio is back on setup (R2-6).
    if (autoSync.value) void uploads.enqueue(meta.id)
    const msg = take.reason === 'limit'
      ? t('studio.savedLimitN', { time: minutesText(Math.round(take.durationMs / 60_000)) })
      : take.reason === 'interrupted'
        ? t('studio.savedInterrupted')
        : take.reason === 'quota'
          ? t('studio.savedQuota')
          : t('studio.saved', { n: meta.number })
    show(msg, take.reason === 'user' ? 'success' : 'info', 7000)
    // A linked phone sees "saved" before this page hands over to the recordings list.
    await player.flush().catch(() => {})
    await navigateTo('/app/recordings')
  } catch {
    unsaved.value = { blob: take.blob, mimeType: take.mimeType }
    phase.value = 'setup'
  } finally {
    saving.value = false
  }
}
function downloadUnsaved() {
  const u = unsaved.value
  if (!u) return
  const name = takeFileName(reader.script?.title ?? '', takes.nextNumber(id.value), u.mimeType, t('studio.takeWord'))
  const url = URL.createObjectURL(u.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  unsaved.value = null
}

// Hidden tab or leaving mid-take: stop and keep what was captured (G8).
useEventListener(document, 'visibilitychange', () => {
  if (document.hidden && recorder.recording.value) void recorder.stop('interrupted').then(take => take && keep(take))
})
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (recorder.recording.value || saving.value) e.preventDefault()
})
onBeforeRouteLeave(async () => {
  clearInterval(countdownTimer)
  if (recorder.recording.value) {
    const take = await recorder.stop('interrupted')
    if (take) await keep(take)
  }
  media.stop()
})

useShortcuts(
  {
    toggle: () => (settings.value.mode === 'manual' ? engine.next() : engine.toggle()),
    escape: () => phase.value === 'countdown' && cancelCountdown(),
    next: () => engine.next(),
    prev: () => engine.prev(),
  },
  { direction: computed(() => reader.direction), enabled: computed(() => phase.value !== 'setup') },
)

// ---------- feature 004 US3: Connect phone and phone Record / Stop (T037) ----------
const takeStartedAt = ref<string | null>(null)
const takeSaved = ref(false)
const linkOpen = ref(false)
const linkPanel = ref<{ focus: () => void }>()
const linkBtn = ref<{ $el: HTMLElement }>()
function openLink() {
  linkOpen.value = true
  if (link.status === 'idle' || (link.status === 'ended' && link.link?.scriptId !== id.value)) void link.open(id.value)
  nextTick(() => linkPanel.value?.focus())
}
function closeLink() {
  if (!linkOpen.value) return
  linkOpen.value = false
  if (link.status === 'ended') link.reset()
  nextTick(() => linkBtn.value?.$el.focus())
}
// Shortcuts are off during setup, so the panel listens for Esc itself.
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && linkOpen.value) closeLink()
})
const scriptReady = computed(() => reader.status === 'ready' && reader.paragraphs.length > 0)
const player = useLinkPlayer(() => ({
  scriptId: id.value,
  apply: cmd => (cmd.type === 'recordStart' || cmd.type === 'recordStop')
    ? applyRecordCommand(cmd, {
        phase: phase.value,
        devicesOn: live.value,
        saving: saving.value,
        ready: scriptReady.value,
        start: () => { takeSaved.value = false; unsaved.value = null; startCountdown() },
        stop: () => void stopTake(),
        cancelCountdown,
      })
    : applyReadingCommand(cmd, {
        engine,
        settings: settings.value,
        update: patch => reader.updateSettings(patch),
        ready: scriptReady.value,
        // The prompter is on screen only while a take runs.
        blocked: phase.value !== 'recording',
      }),
  snapshot: () => readingSnapshot({
    title: reader.script?.title,
    paragraphs: reader.paragraphs,
    engine,
    settings: settings.value,
    recording: recordingState({
      phase: phase.value, devicesOn: live.value, saving: saving.value, saved: takeSaved.value,
      failed: !!unsaved.value, startedAt: takeStartedAt.value,
    }),
  }),
}))
watch(
  () => [phase.value, saving.value, live.value, takeSaved.value, !!unsaved.value, engine.paragraph.value, engine.playing.value,
    settings.value.wpm, settings.value.fontSize, reader.script?.title, reader.paragraphs.length],
  () => player.changed(),
)

// ---------- permission help ----------
const helpOpen = ref(false)

const heading = computed(() => {
  if (problem.value === 'denied') return kind.value === 'video' ? t('studio.deniedVideo') : t('studio.deniedAudio')
  if (problem.value) return t('studio.problemTitle')
  return kind.value === 'video' ? t('studio.videoHeading') : t('studio.audioHeading')
})
const lede = computed(() => {
  if (problem.value === 'denied') return t('studio.deniedLede')
  if (problem.value === 'unavailable') return media.supported.value ? t('studio.unavailable') : t('studio.unsupported')
  if (problem.value === 'error') return t('studio.errorGeneric')
  if (live.value) return kind.value === 'video' ? t('studio.videoReady') : t('studio.audioReady')
  return kind.value === 'video' ? t('studio.videoLede') : t('studio.audioLede')
})
const firstLine = computed(() => reader.paragraphs[0] ?? '')
</script>

<template>
  <!-- Countdown (6:42 / 6:54) -->
  <div v-if="phase === 'countdown'" class="dark">
    <header class="mast stage">
      <span class="brand"><BrandSignature surface="stage" :width="143" /></span>
      <p class="mast-title" dir="auto">{{ reader.script?.title }}</p>
    </header>
    <CountdownView
      class="cd"
      :seconds="countdown"
      :total="settings.countdownSec"
      :label="t('studio.startsIn')"
      :line="firstLine"
      :direction="reader.direction"
      @cancel="cancelCountdown"
    />
  </div>

  <!-- Recording (6:44 / 6:56) -->
  <RecordingView
    v-else-if="phase === 'recording'"
    :title="reader.script?.title ?? ''"
    :kind="kind"
    :stream="media.stream.value"
    :elapsed-ms="recorder.elapsedMs.value"
    :limit-ms="limitMs"
    :level="level"
    :saving="saving"
    :paragraphs="reader.paragraphs"
    :units="reader.units"
    :hold-at="engine.holdAt.value"
    :timeline="engine.timeline.value"
    :progress="engine.progress.value"
    :paragraph="engine.paragraph.value"
    :direction="reader.direction"
    :settings="settings"
    :smooth="smooth"
    @stop="stopTake"
  />

  <!-- Setup (6:38 / 6:39 / 6:50 / 6:51, phone 6:40 / 6:41, denied 6:78) -->
  <div v-else class="studio">
    <header class="mast">
      <NuxtLink to="/app/scripts" class="brand" :aria-label="t('nav.scripts')"><BrandSignature :width="143" /></NuxtLink>
      <p class="mast-title">{{ t('studio.title') }}</p>
      <h1 class="phone-title">{{ t('studio.setup') }}</h1>
      <LinkIndicator
        ref="linkBtn"
        class="link-ind"
        :status="link.status"
        :badge="!!link.pendingRemote"
        :expanded="linkOpen"
        @open="linkOpen ? closeLink() : openLink()"
      />
      <NuxtLink :to="editorPath" class="round" :aria-label="t('studio.backToScript')"><UiGlyph name="back" :size="20" /></NuxtLink>
    </header>
    <div v-if="linkOpen" class="scrim" aria-hidden="true" @click="closeLink" />
    <ConnectPanel v-if="linkOpen" ref="linkPanel" class="link-side" :script-id="id" @close="closeLink" />

    <main class="wrap">
      <div class="head">
        <h1>{{ t('studio.setup') }}</h1>
        <NuxtLink :to="editorPath" class="link">{{ t('studio.backToScript') }}</NuxtLink>
      </div>

      <UiBanner v-if="takes.lowStorage" tone="info" class="low">{{ t('studio.lowStorage') }}</UiBanner>
      <UiBanner v-if="reader.status === 'error' || reader.status === 'missing'" tone="error" class="low">
        {{ reader.status === 'missing' ? t('editor.missingTitle') : errorText(reader.loadError) }}
      </UiBanner>

      <div class="grid">
        <section class="side" :aria-label="t('studio.setup')">
          <div class="type">
            <p class="label">{{ t('studio.type') }}</p>
            <div class="modes" role="radiogroup" :aria-label="t('studio.type')">
              <button
                v-for="o in modeOptions"
                :key="o.value"
                type="button"
                role="radio"
                :aria-checked="kind === o.value"
                :disabled="media.state.value === 'requesting'"
                @click="kind = o.value"
              >
                <UiGlyph :name="o.icon" :size="19" />{{ o.label }}
              </button>
            </div>
          </div>

          <div v-if="live" class="devices">
            <p class="label">{{ t('studio.devices') }}</p>
            <DeviceSelect
              :model-value="media.micId.value"
              :label="t('studio.mic')"
              icon="mic"
              :devices="media.mics.value"
              :fallback="t('studio.defaultMic')"
              @update:model-value="media.selectMic"
            />
            <DeviceSelect
              v-if="kind === 'video'"
              :model-value="media.camId.value"
              :label="t('studio.cam')"
              icon="video"
              :devices="media.cams.value"
              :fallback="t('studio.defaultCam')"
              @update:model-value="media.selectCam"
            />
          </div>

          <div class="ask">
            <h2 v-if="!live" :class="{ problem }">{{ heading }}</h2>
            <p class="lede">{{ lede }}</p>
            <template v-if="live">
              <UiButton block :disabled="reader.status !== 'ready' || !reader.paragraphs.length" @click="startCountdown">{{ t('studio.start') }}</UiButton>
              <button type="button" class="link" @click="closePreview">{{ t('studio.closePreview') }}</button>
            </template>
            <template v-else-if="problem === 'denied'">
              <UiButton block @click="enable">{{ t('studio.retry') }}</UiButton>
              <UiButton block tone="secondary" :to="rehearsePath">{{ t('studio.continueRehearsal') }}</UiButton>
              <button type="button" class="link" @click="helpOpen = true">{{ t('studio.permissionHelp') }}</button>
            </template>
            <template v-else>
              <UiButton block :loading="media.state.value === 'requesting'" :disabled="problem === 'unavailable' && !media.supported.value" @click="enable">
                {{ problem ? t('studio.retry') : kind === 'video' ? t('studio.enableVideo') : t('studio.enableAudio') }}
              </UiButton>
              <button type="button" class="link" @click="helpOpen = true">{{ t('studio.permissionHelp') }}</button>
            </template>
          </div>
        </section>

        <div class="preview">
          <Viewfinder class="vf" :kind="kind" :stream="media.stream.value" :level="level" :history="history" />
          <div class="script">
            <span class="sname"><UiGlyph name="file" :size="20" /><span dir="auto">{{ reader.script?.title }}</span></span>
            <NuxtLink to="/app/scripts" class="link sm">{{ t('studio.changeScript') }}</NuxtLink>
          </div>
        </div>
      </div>

      <footer class="foot">
        <NuxtLink :to="rehearsePath" class="link">{{ t('studio.practise') }}</NuxtLink>
        <p>{{ takeLimitText }}<template v-if="autoSync"><br><span class="auto">{{ t('studio.autoSyncHint') }}</span></template></p>
      </footer>
    </main>

    <UiDialog v-model:open="helpOpen" :title="t('studio.helpTitle')">
      <ol class="steps">
        <li>{{ t('studio.helpStep1') }}</li>
        <li>{{ t('studio.helpStep2') }}</li>
        <li>{{ t('studio.helpStep3') }}</li>
      </ol>
      <p>{{ t('studio.helpNote') }}</p>
      <template #actions>
        <UiButton @click="helpOpen = false; enable()">{{ t('studio.retry') }}</UiButton>
        <UiButton tone="secondary" @click="helpOpen = false">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>

    <UiDialog :open="!!unsaved" :title="t('studio.saveFailedTitle')" :dismissible="false">
      <p>{{ t('studio.saveFailed') }}</p>
      <template #actions>
        <UiButton icon="download" @click="downloadUnsaved">{{ t('studio.downloadNow') }}</UiButton>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
/* ---------- setup (paper) ---------- */
.studio {
  min-block-size: 100dvh;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.mast {
  display: flex;
  align-items: center;
  gap: 32px;
  block-size: 80px;
  padding-inline: max(46px, env(safe-area-inset-left, 0px)) max(45px, env(safe-area-inset-right, 0px));
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.mast.stage {
  border-color: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
}
.brand {
  display: flex;
}
/* Feature 004: Connect phone in the setup masthead; the panel opens over the page as on rehearsal (Figma L1, L2). */
.link-ind {
  margin-inline-start: auto;
}
.link-ind + .round {
  margin-inline-start: 0;
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 19;
  background: rgba(10, 18, 22, 0.45);
}
.link-side {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: 20;
  inline-size: min(428px, 100vw);
  box-shadow: var(--tilw-shadow-pop);
}
.mast-title {
  margin: 0;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.phone-title {
  display: none;
}
.round {
  display: grid;
  place-items: center;
  inline-size: 46px;
  block-size: 46px;
  margin-inline-start: auto;
  border-radius: 23px;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.round:focus-visible,
.link:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.wrap {
  inline-size: min(1172px, calc(100% - 64px));
  margin-inline: auto;
  padding-block: 29px 40px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block-end: 20px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.head h1 {
  margin: 0;
  font: 700 37px/1.36 var(--tilw-font-ar);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.link.sm {
  font-size: 14px;
}
.low {
  margin-block-start: 20px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 451px) minmax(0, 690px);
  justify-content: space-between;
  gap: 31px;
  padding-block: 30px;
}
.side {
  display: grid;
  align-content: start;
  gap: 22px;
}
.label {
  margin: 0 0 12px;
  color: var(--tilw-text-muted);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.modes button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-block-size: 51px;
  border: 0;
  border-radius: 15px;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  font: 500 16px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.modes button[aria-checked='true'] {
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
}
.modes button[aria-checked='true'] :deep(.ui-glyph) {
  color: var(--tilw-stage-cue);
}
.modes button:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.devices {
  display: grid;
  gap: 6px;
}
.devices .label {
  margin-block-end: 6px;
}
.ask {
  display: grid;
  gap: 16px;
  margin-block-start: 18px;
}
.ask h2 {
  margin: 0;
  font: 700 27px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 0 0 8px;
  color: var(--tilw-text-muted);
  font: 400 18px/28px var(--tilw-font-ar);
}
.preview {
  display: grid;
  gap: 19px;
  align-content: start;
}
.vf {
  block-size: 391px;
}
.script {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-block-size: 60px;
  padding-inline: 15px 12px;
  border-radius: 14px;
  background: var(--tilw-surface-quiet);
}
.sname {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.sname > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sname :deep(.ui-glyph) {
  color: var(--tilw-text-muted);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block-start: 28px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.foot p {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-inline-start: 22px;
  color: var(--tilw-text-ink);
}

/* ---------- countdown (stage) ---------- */
.dark {
  display: grid;
  grid-template-rows: 80px minmax(0, 1fr);
  block-size: 100dvh;
  background: var(--tilw-stage-background);
}

/* Tablet: viewfinder above the controls. */
@media (max-width: 1000px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .preview {
    order: -1;
  }
}

/* Phone (6:41 / 6:40 / 6:78): title in the masthead, script first, then type, viewfinder, devices, actions. */
@media (max-width: 760px) {
  .mast {
    gap: 12px;
    block-size: 64px;
    padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
  }
  .studio .brand,
  .studio .mast-title,
  .head {
    display: none;
  }
  .phone-title {
    display: block;
    margin: 0;
    font: 700 22px/1.36 var(--tilw-font-ar);
  }
  .dark {
    grid-template-rows: 64px minmax(0, 1fr);
  }
  .wrap {
    inline-size: calc(100% - 32px);
    padding-block: 14px 32px;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-block: 0 20px;
  }
  .side,
  .preview {
    display: contents;
  }
  .script { order: 1; }
  .type { order: 2; }
  .vf { order: 3; block-size: 230px; }
  .devices { order: 4; }
  .ask { order: 5; margin: 0; }
  .type .label,
  .devices .label {
    display: none;
  }
  .ask h2 {
    font-size: 24px;
  }
  .lede {
    font-size: 16px;
    line-height: 26px;
  }
  .foot {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    padding-block-start: 20px;
  }
}
</style>
