<script setup lang="ts">
/**
 * Plays the original file from this browser (6:46 video, 6:58 audio). Video: the picture with a control
 * strip (play, "تشغيل / إيقاف", clip length). Audio: microphone, waveform that fills as it plays, play
 * button, time and a seek line. Clicking the picture also plays or pauses.
 *
 * MediaRecorder WebM files don't carry a duration, so the take's measured length is used until the browser
 * works it out, and seeking is enabled once it does.
 */
import type { TakeMeta } from '~/services/takes'

const props = defineProps<{ take: TakeMeta; src: string | null }>()
const { t } = useI18n()
const el = ref<HTMLMediaElement>()
const playing = ref(false)
const current = ref(0)
const duration = ref(props.take.durationMs / 1000)
const seekable = ref(false)

watch(() => props.take.id, () => {
  playing.value = false
  current.value = 0
  duration.value = props.take.durationMs / 1000
  seekable.value = false
})

function onMeta() {
  const m = el.value
  if (!m) return
  if (Number.isFinite(m.duration)) {
    duration.value = m.duration
    seekable.value = true
    return
  }
  // Force Chrome to scan the file once so the real duration (and seeking) becomes available.
  const fix = () => {
    m.removeEventListener('timeupdate', fix)
    if (Number.isFinite(m.duration)) {
      duration.value = m.duration
      seekable.value = true
    }
    m.currentTime = 0
  }
  m.addEventListener('timeupdate', fix)
  m.currentTime = 1e101
}

function toggle() {
  const m = el.value
  if (!m) return
  if (m.paused) void m.play().catch(() => {})
  else m.pause()
}
function seek(e: Event) {
  const m = el.value
  if (!m || !seekable.value) return
  m.currentTime = Number((e.target as HTMLInputElement).value)
}

const wave = computed(() => waveBars(props.take.id, 64))
const pct = computed(() => (duration.value ? Math.min(1, current.value / duration.value) : 0))
const fmt = (s: number) => formatDuration(s * 1000)
defineExpose({ pause: () => el.value?.pause() })
</script>

<template>
  <figure class="player" :class="take.kind">
    <div class="pic" @click="toggle">
      <video
        v-if="take.kind === 'video'"
        ref="el"
        :src="src ?? undefined"
        playsinline
        preload="metadata"
        @loadedmetadata="onMeta"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
        @timeupdate="current = ($event.target as HTMLMediaElement).currentTime"
      />
      <template v-else>
        <audio
          ref="el"
          :src="src ?? undefined"
          preload="metadata"
          @loadedmetadata="onMeta"
          @play="playing = true"
          @pause="playing = false"
          @ended="playing = false"
          @timeupdate="current = ($event.target as HTMLMediaElement).currentTime"
        />
        <span class="mic" aria-hidden="true"><UiGlyph name="mic" :size="30" /></span>
        <span class="wave" aria-hidden="true">
          <i v-for="(h, i) in wave" :key="i" :class="{ done: i / wave.length < pct }" :style="{ blockSize: `${Math.round(h * 40)}px` }" />
        </span>
      </template>
    </div>
    <figcaption class="bar">
      <button type="button" class="play" :aria-label="playing ? t('recordings.pause') : t('recordings.play')" :disabled="!src" @click="toggle">
        <UiGlyph :name="playing ? 'pause' : 'play'" :size="19" />
      </button>
      <template v-if="take.kind === 'video'">
        <span class="lbl">{{ t('recordings.playPause') }}</span>
        <input
          class="seek"
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="current"
          :disabled="!seekable"
          :aria-label="t('recordings.position')"
          @input="seek"
        >
        <span class="len" dir="ltr">{{ fmt(duration) }}</span>
      </template>
      <template v-else>
        <span class="time" dir="ltr">{{ fmt(current) }} / {{ fmt(duration) }}</span>
        <input
          class="seek"
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="current"
          :disabled="!seekable"
          :aria-label="t('recordings.position')"
          @input="seek"
        >
      </template>
    </figcaption>
  </figure>
</template>

<style scoped>
.player {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 68px;
  margin: 0;
  overflow: hidden;
  border-radius: 14px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.pic {
  position: relative;
  display: grid;
  place-items: center;
  min-block-size: 0;
  overflow: hidden;
  border-radius: 12px;
  cursor: pointer;
}
video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  background: #0f1a20;
}
.audio .pic {
  align-content: center;
  gap: 30px;
}
.mic {
  color: var(--tilw-stage-cue);
}
.wave {
  display: flex;
  align-items: center;
  gap: 3px;
  direction: ltr;
}
.wave i {
  inline-size: 2.6px;
  border-radius: 1px;
  background: var(--tilw-stage-secondary);
}
.wave i.done {
  background: var(--tilw-stage-cue);
}
.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-inline: 13px 14px;
  direction: ltr; /* playback controls read left to right in both languages, as drawn */
}
.play {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  inline-size: 42px;
  block-size: 42px;
  padding: 0;
  border: 0;
  border-radius: 21px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  cursor: pointer;
}
.play:disabled {
  opacity: 0.5;
}
.play:focus-visible,
.seek:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.lbl {
  font: 500 15px/1.36 var(--tilw-font-ar);
  white-space: nowrap;
}
.time,
.len {
  flex: 0 0 auto;
  font: 500 14px/26px var(--tilw-font-lat);
  font-variant-numeric: tabular-nums;
}
.len {
  padding-inline: 8px;
  border-radius: 5px;
  background: var(--tilw-stage-background);
}
.seek {
  flex: 1;
  min-inline-size: 40px;
  accent-color: var(--tilw-stage-cue);
}
.seek:disabled {
  opacity: 0.4;
}
</style>
