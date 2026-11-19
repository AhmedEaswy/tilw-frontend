<script setup lang="ts">
/**
 * Studio viewfinder (6:38 camera off, 6:39 preview, 6:50 microphone off, 6:51 sound check): dark glass with
 * a status badge, the live camera or a live waveform, and the "مستوى الصوت" strip with the level meter.
 * The camera preview is mirrored like a mirror; the recorded file is not.
 */
const props = defineProps<{
  kind: 'audio' | 'video'
  stream: MediaStream | null
  level: number
  history: number[]
  compact?: boolean
}>()
const { t } = useI18n()
const video = ref<HTMLVideoElement>()
const live = computed(() => !!props.stream)

watch([video, () => props.stream], ([el, s]) => {
  if (el && el.srcObject !== s) {
    el.srcObject = s
    if (s) void el.play().catch(() => {})
  }
}, { immediate: true })

/** Waveform bars: the recent level history mirrored around the middle. */
const bars = computed(() => {
  const h = props.history.slice(-40)
  return h.map(v => Math.max(0.08, Math.min(1, v * 1.3)))
})
</script>

<template>
  <figure class="vf" :class="[kind, { live, compact }]">
    <div class="glass">
      <video v-if="kind === 'video' && live" ref="video" class="cam" autoplay muted playsinline />
      <template v-else-if="kind === 'video'">
        <span class="cam-off" aria-hidden="true"><i class="body"><b /></i><i class="lens" /></span>
        <span v-if="compact" class="off-label">{{ t('studio.cameraOff') }}</span>
      </template>
      <div v-else class="audio">
        <span class="mic"><UiGlyph name="mic" :size="28" /></span>
        <div v-if="live" class="wave" aria-hidden="true">
          <i v-for="(b, i) in bars" :key="i" :style="{ blockSize: `${Math.round(b * 34)}px` }" />
        </div>
        <span class="cap">{{ live ? t('studio.liveSound') : t('studio.micOff') }}</span>
      </div>

      <span v-if="kind === 'video' && !compact" class="badge">
        <template v-if="live"><i class="dot" />{{ t('studio.livePreview') }}</template>
        <template v-else><UiGlyph name="video" :size="17" />{{ t('studio.cameraOff') }}</template>
      </span>
    </div>
    <figcaption class="strip">
      <span class="lbl"><UiGlyph name="mic" :size="18" />{{ t('studio.level') }}</span>
      <LevelMeter :level="level" :active="live" />
    </figcaption>
  </figure>
</template>

<style scoped>
.vf {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 57px;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(247, 242, 233, 0.15);
  border-radius: 22px;
  background: var(--tilw-stage-background);
  box-shadow: 0 9px 28px rgba(0, 0, 0, 0.19);
  color: var(--tilw-stage-text);
}
.glass {
  position: relative;
  display: grid;
  place-items: center;
  min-block-size: 0;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(to bottom, #202f38, #273945);
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.3);
}
.cam {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.cam-off {
  display: flex;
  direction: ltr; /* the lens is on the right in both languages (6:38) */
  align-items: center;
  gap: 1px;
}
.cam-off .body {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 54px;
  block-size: 41px;
  border-radius: 8px;
  background: var(--tilw-stage-secondary);
}
.cam-off .body b {
  inline-size: 18px;
  block-size: 18px;
  border-radius: 50%;
  background: var(--tilw-stage-background);
}
.cam-off .lens {
  inline-size: 11px;
  block-size: 20px;
  border-radius: 2px;
  background: var(--tilw-stage-secondary);
}
.off-label {
  position: absolute;
  inset-block-start: calc(50% + 34px);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.badge {
  position: absolute;
  inset-block-start: 12px;
  inset-inline-end: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 31px;
  padding-inline: 12px;
  border-radius: 14px;
  background: var(--tilw-stage-background);
  font: 500 14px/20px var(--tilw-font-ar);
}
.dot {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 4px;
  background: var(--tilw-stage-cue);
}
.audio {
  display: grid;
  justify-items: center;
  gap: 22px;
}
.mic {
  display: grid;
  place-items: center;
  inline-size: 50px;
  block-size: 50px;
  border: 1px solid var(--tilw-stage-cue);
  border-radius: 50%;
  color: var(--tilw-stage-cue);
}
.wave {
  display: flex;
  align-items: center;
  gap: 4px;
  block-size: 36px;
  direction: ltr;
}
.wave i {
  inline-size: 3px;
  min-block-size: 3px;
  border-radius: 2px;
  background: var(--tilw-stage-cue);
  transition: block-size 0.08s linear;
}
.cap {
  font: 500 14px/1.36 var(--tilw-font-ar);
}
.audio:not(:has(.wave)) .cap {
  font-size: 16px;
}
.strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-inline: 28px 23px;
  background: var(--tilw-stage-surface);
}
.lbl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 500 15px/1.36 var(--tilw-font-ar);
}
@media (prefers-reduced-motion: reduce) {
  .wave i {
    transition: none;
  }
}
</style>
