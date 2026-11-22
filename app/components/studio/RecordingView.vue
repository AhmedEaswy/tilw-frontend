<script setup lang="ts">
/**
 * Capture screen (6:44 camera, 6:56 audio; phone 6:45, 6:57): toolbar with the script title and the
 * recording indicator + timer, the monitor glass with the camera (video takes) beside the prompter, and the
 * transport with the level meter, "إيقاف وحفظ" and the 10-minute note.
 */
import type { ReadingSettings } from '~/services/types'
import type { Timeline } from '~/utils/reader'

const props = defineProps<{
  title: string
  kind: 'audio' | 'video'
  stream: MediaStream | null
  elapsedMs: number
  level: number
  saving: boolean
  paragraphs: string[]
  units?: Phrase[][]
  holdAt?: number | null
  timeline: Timeline
  progress: number
  paragraph: number
  direction: 'rtl' | 'ltr'
  settings: ReadingSettings
  smooth: boolean
}>()
const emit = defineEmits<{ stop: [] }>()
const { t } = useI18n()

const video = ref<HTMLVideoElement>()
watch([video, () => props.stream], ([el, s]) => {
  if (el && el.srcObject !== s) {
    el.srcObject = s
    if (s) void el.play().catch(() => {})
  }
}, { immediate: true })

const remaining = computed(() => RECORD_LIMIT_MS - props.elapsedMs)
const nearLimit = computed(() => remaining.value <= 60_000)

const stopBtn = ref<HTMLButtonElement>()
onMounted(() => stopBtn.value?.focus())
</script>

<template>
  <section class="rec" :class="kind">
    <header class="bar">
      <h1 class="name" dir="auto">{{ title }}</h1>
      <p class="ind" role="status">
        <i class="tally" aria-hidden="true" />
        <span>{{ t('studio.recordingNow') }}</span>
        <span class="time" dir="ltr">{{ formatDuration(elapsedMs) }}</span>
      </p>
    </header>

    <div class="body">
      <div class="glass">
        <div v-if="kind === 'video'" class="cam-box">
          <video ref="video" class="cam" autoplay muted playsinline />
          <span class="edge" aria-hidden="true" />
        </div>
        <ReaderSurface
          class="prompter"
          bare
          :paragraphs="paragraphs"
          :units="units"
          :hold-at="holdAt"
          :timeline="timeline"
          :progress="progress"
          :paragraph="paragraph"
          :direction="direction"
          :settings="settings"
          :smooth="smooth"
        />
      </div>
    </div>

    <footer class="transport">
      <div class="lvl">
        <span>{{ t('studio.level') }}</span>
        <span class="m"><UiGlyph name="mic" :size="19" /><LevelMeter size="md" :level="level" /></span>
      </div>
      <div class="acts">
        <p class="cap" :class="{ warn: nearLimit }" aria-live="polite">
          {{ nearLimit ? t('studio.remaining', { time: formatDuration(Math.max(0, remaining)) }) : t('studio.maxTen') }}
        </p>
        <button ref="stopBtn" type="button" class="stop" :disabled="saving" @click="emit('stop')">
          <UiGlyph name="stop" :size="20" />
          <span>{{ saving ? t('studio.saving') : t('studio.stopSave') }}</span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.rec {
  display: grid;
  grid-template-rows: 84px minmax(0, 1fr) auto;
  block-size: 100dvh;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-inline: max(70px, env(safe-area-inset-left, 0px)) max(70px, env(safe-area-inset-right, 0px));
  background: var(--tilw-stage-surface);
}
.name {
  margin: 0;
  overflow: hidden;
  font: 500 22px/1.36 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ind {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  min-block-size: 34px;
  margin: 0;
  padding-inline: 12px 16px;
  border-radius: 17px;
  background: var(--tilw-stage-surface);
  font: 500 14px/20px var(--tilw-font-ar);
}
.tally {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 5px;
  background: var(--tilw-stage-rec);
  animation: tally 1.6s ease-in-out infinite;
}
@keyframes tally {
  50% { opacity: 0.35; }
}
.time {
  font: 500 14px/20px var(--tilw-font-lat);
  font-variant-numeric: tabular-nums;
}
.body {
  min-block-size: 0;
  padding: 20px 48px 21px;
}
.glass {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 590px);
  gap: 6px;
  block-size: 100%;
  padding-block: 15px;
  padding-inline: 0 16px;
  border: 1px solid rgba(0, 0, 0, 0.52);
  border-radius: 24px;
  background: linear-gradient(to bottom, #202f38, #273945);
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.3);
}
.audio .glass {
  grid-template-columns: minmax(0, 1fr);
  padding-inline: 40px;
}
.prompter {
  grid-column: 1;
  grid-row: 1;
  block-size: 100%;
}
.cam-box {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  border-radius: 23px;
  background: #111b21;
}
.cam {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.edge {
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.13));
}
.transport {
  display: grid;
  gap: 20px;
  padding: 22px max(70px, env(safe-area-inset-left, 0px)) calc(22px + env(safe-area-inset-bottom, 0px)) max(70px, env(safe-area-inset-right, 0px));
  background: var(--tilw-stage-surface);
}
.lvl,
.acts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.lvl {
  color: var(--tilw-stage-secondary);
  font: 500 15px/22px var(--tilw-font-ar);
}
.m {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  direction: ltr;
}
.cap {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.cap.warn {
  color: var(--tilw-stage-cue);
}
.stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  inline-size: 236px;
  min-block-size: 50px;
  border: 0;
  border-radius: 16px;
  background: var(--tilw-stage-rec);
  color: var(--tilw-stage-text);
  font: 500 18px/27px var(--tilw-font-ar);
  cursor: pointer;
}
.stop:hover:not(:disabled) {
  background: #b13c43;
}
.stop:disabled {
  opacity: 0.7;
  cursor: progress;
}
.stop:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .tally {
    animation: none;
  }
}

/* Phone (6:45 / 6:57): camera above the prompter, full-width stop button. */
@media (max-width: 760px) {
  .rec {
    grid-template-rows: 64px minmax(0, 1fr) auto;
  }
  .bar,
  .transport {
    padding-inline: 16px;
  }
  .name {
    font-size: 18px;
  }
  .body {
    padding: 14px 8px;
  }
  .glass,
  .audio .glass {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(160px, 42%) minmax(0, 1fr);
    padding: 6px;
    border-radius: 20px;
  }
  .audio .glass {
    grid-template-rows: minmax(0, 1fr);
  }
  .cam-box {
    grid-column: 1;
    grid-row: 1;
    border-radius: 16px;
  }
  .prompter {
    grid-row: 2;
  }
  .audio .prompter {
    grid-row: 1;
  }
  .acts {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 10px;
  }
  .cap {
    text-align: center;
    font-size: 14px;
  }
  .stop {
    inline-size: 100%;
  }
}
</style>
