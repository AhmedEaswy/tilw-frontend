<script setup lang="ts">
/**
 * Official horizontal signature (Figma 12:60). Light surface artwork from the app header (6:18);
 * the stage variant (ivory wordmark) is used on dark surfaces. Logo order is the same in both directions.
 */
const props = withDefaults(defineProps<{ width?: number; surface?: 'light' | 'stage' }>(), { width: 143, surface: 'light' })
const src = computed(() =>
  props.surface === 'stage'
    ? { s: '/assets/logo-symbol-stage.svg', t: '/assets/logo-tilw-stage.svg', p: '/assets/logo-prompter-stage.svg' }
    : { s: '/brand/sig-symbol.svg', t: '/brand/sig-tilw.svg', p: '/brand/sig-prompter.svg' },
)
</script>

<template>
  <span class="sig" :class="`on-${surface}`" :style="{ inlineSize: `${width}px` }" role="img" aria-label="tilwprompter">
    <img class="s1" :src="src.s" alt="" width="23" height="21">
    <img class="s2" :src="src.t" alt="" width="33" height="13">
    <img class="s3" :src="src.p" alt="" width="78" height="16">
  </span>
</template>

<style scoped>
.sig {
  position: relative;
  display: block;
  aspect-ratio: 143 / 23.315;
  direction: ltr;
}
.sig img {
  position: absolute;
  display: block;
  max-inline-size: none;
}
.s1 { left: 0.17%; top: 4.29%; width: 16.19%; height: 91.36%; }
.s2 { left: 20.46%; top: 14.71%; width: 23.09%; height: 56.93%; }
.s3 { left: 45.14%; top: 21.33%; width: 54.48%; height: 67.05%; }

/* In the dark app theme the light-surface wordmark switches to ivory. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .on-light .s2,
  :root:not([data-theme='light']) .on-light .s3 { filter: brightness(0) invert(0.95) sepia(0.08); }
}
:root[data-theme='dark'] .on-light .s2,
:root[data-theme='dark'] .on-light .s3 { filter: brightness(0) invert(0.95) sepia(0.08); }
</style>
