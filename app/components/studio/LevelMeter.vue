<script setup lang="ts">
/** Segmented input level (6:39 "مستوى الصوت", 6:44 transport): sage when lit, cue for the top two. */
const props = withDefaults(defineProps<{ level: number; size?: 'sm' | 'md'; active?: boolean }>(), { size: 'sm', active: true })
const segments = computed(() => (props.active ? levelSegments(props.level) : levelSegments(0)))
</script>

<template>
  <span class="meter" :class="size" role="meter" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(level * 100)">
    <i v-for="(s, i) in segments" :key="i" :class="s" />
  </span>
</template>

<style scoped>
.meter {
  display: inline-flex;
  gap: 3px;
  direction: ltr;
}
.meter i {
  inline-size: 6.8px;
  block-size: 8px;
  border-radius: 2px;
  background: var(--tilw-stage-surface);
}
.meter.md {
  gap: 3px;
}
.meter.md i {
  inline-size: 10px;
}
.meter i.lo {
  background: var(--tilw-surface-sage);
}
.meter i.hi {
  background: var(--tilw-stage-cue);
}
/* Off segments read on the darker monitor strip. */
.meter i.off {
  background: #2c3f4a;
}
</style>
