<script setup lang="ts">
/**
 * "Reader transport" (6:26 paused, 6:27 playing, 6:31 phone): previous / play-pause / next, and on wider
 * screens rewind plus the "حجم النص" and "120 كلمة/د" shortcuts into reading settings.
 * Manual mode has nothing to play, so the play action is disabled and the pace chip is hidden.
 */
const props = defineProps<{
  playing: boolean
  counting: boolean
  manual: boolean
  wpm: number
  canPrev: boolean
}>()
defineEmits<{ toggle: []; prev: []; next: []; rewind: []; settings: [] }>()
const { t } = useI18n()
// The reader frames use Western digits in both languages ("الفقرة 2 من 3", "120 كلمة/د").
const nf = computed(() => new Intl.NumberFormat('en'))
const active = computed(() => props.playing || props.counting)
</script>

<template>
  <div class="transport" role="toolbar" :aria-label="t('reader.transport')">
    <div class="main">
      <button type="button" class="round" :aria-label="t('reader.prev')" :disabled="!canPrev" @click="$emit('prev')">
        <UiGlyph name="prev" :size="20" />
      </button>
      <UiButton
        tone="cue"
        class="play"
        :icon-end="active ? 'pause' : 'play'"
        :disabled="manual"
        :aria-pressed="active"
        @click="$emit('toggle')"
      >{{ active ? t('reader.pause') : t('reader.play') }}</UiButton>
      <button type="button" class="round" :aria-label="t('reader.next')" @click="$emit('next')">
        <UiGlyph name="next" :size="20" />
      </button>
    </div>
    <div class="extra">
      <button type="button" class="round" :aria-label="t('reader.rewind')" @click="$emit('rewind')">
        <UiGlyph name="rewind" :size="20" />
      </button>
      <button type="button" class="chip" @click="$emit('settings')">{{ t('reader.fontChip') }}</button>
      <button v-if="!manual" type="button" class="chip" @click="$emit('settings')">{{ t('reader.wpmChip', { n: nf.format(wpm) }) }}</button>
    </div>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  inline-size: min(1036px, 100%);
  min-block-size: 86px;
  margin-inline: auto;
  padding-inline: 18px 40px;
  border: 1px solid rgba(247, 242, 233, 0.16);
  border-radius: 25px;
  background: var(--tilw-stage-surface);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.24), inset 0 1px 1px rgba(247, 242, 233, 0.06);
}
.main,
.extra {
  display: flex;
  align-items: center;
  gap: 17px;
}
.extra {
  gap: 34px;
}
.round {
  display: inline-grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.round:disabled {
  opacity: 0.4;
}
.round:not(:disabled):hover {
  background: #33495a;
}
.play {
  inline-size: 150px;
  min-inline-size: 0;
}
.play :deep(.ui-glyph) {
  inline-size: 17px !important;
  block-size: 17px !important;
}
.play:disabled {
  background: color-mix(in srgb, var(--tilw-stage-cue) 35%, var(--tilw-stage-surface));
  color: var(--tilw-stage-background);
}
.chip {
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--tilw-stage-text);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.chip:hover {
  text-decoration: underline;
}
.round:focus-visible,
.chip:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}

/* Phone (6:31): only previous / play / next, spread across the bar. */
@media (max-width: 760px) {
  .transport {
    min-block-size: 83px;
    padding-inline: 21px;
    border-radius: 22px;
  }
  .main {
    flex: 1;
    justify-content: space-between;
  }
  .play {
    inline-size: 146px;
  }
  .extra {
    display: none;
  }
}
</style>
