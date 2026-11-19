<script setup lang="ts">
/**
 * Picture of a take: the first video frame (6:74 "Video take") or the stage waveform for audio
 * ("Audio overview"). Falls back to the camera glyph while the poster is being made.
 */
import type { TakeMeta } from '~/services/takes'

const props = defineProps<{ take: TakeMeta; bars?: number }>()
const poster = useTakePoster(() => props.take)
const wave = computed(() => waveBars(props.take.id, props.bars ?? 32))
</script>

<template>
  <div class="cover" :class="take.kind" aria-hidden="true">
    <img v-if="take.kind === 'video' && poster" :src="poster" alt="">
    <UiGlyph v-else-if="take.kind === 'video'" name="video" :size="36" />
    <div v-else class="wave"><i v-for="(h, i) in wave" :key="i" :style="{ blockSize: `${Math.round(h * 112)}px` }" /></div>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-secondary);
}
img {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.wave {
  display: flex;
  align-items: center;
  gap: 5px;
  direction: ltr;
}
.wave i {
  inline-size: 6.9px;
  border-radius: 1px;
  background: var(--tilw-stage-cue);
}
</style>
