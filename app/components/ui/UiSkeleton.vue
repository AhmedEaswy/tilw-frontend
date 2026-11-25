<script setup lang="ts">
/**
 * One placeholder shape (a line, a block, a dot). Pages build content-shaped loading states out of these, usually
 * through SkeletonRows / SkeletonCard inside a SkeletonRegion (which carries aria-busy and the one "Loading…" text).
 *
 * - `tone`: `paper` on the light surfaces (default), `stage` on the dark stage cards (plan card, last opened, reader).
 * - `inline`: sits in a line of text (inline-block, centred on the line) instead of filling its row.
 * - `h` / `w` / `r`: an empty string leaves that size to the class it is given (e.g. one that changes at a breakpoint).
 * The shimmer stops under `prefers-reduced-motion`; both tones follow the theme tokens.
 */
withDefaults(defineProps<{ h?: string; w?: string; r?: string; tone?: 'paper' | 'stage'; inline?: boolean }>(), {
  h: '16px',
  w: '100%',
  r: '6px',
  tone: 'paper',
  inline: false,
})
</script>

<template>
  <span
    class="ui-skel"
    :class="[`t-${tone}`, { inline }]"
    :style="{ blockSize: h || undefined, inlineSize: w || undefined, borderRadius: r || undefined }"
    aria-hidden="true"
  />
</template>

<style scoped>
.ui-skel {
  --skel-base: var(--tilw-surface-quiet);
  --skel-hi: color-mix(in srgb, var(--tilw-surface-quiet) 60%, var(--tilw-surface-white));
  display: block;
  flex: none;
  max-inline-size: 100%;
  background: linear-gradient(90deg, var(--skel-base) 25%, var(--skel-hi) 50%, var(--skel-base) 75%);
  background-size: 200% 100%;
  animation: skel 1.4s linear infinite;
}
.ui-skel.t-stage {
  --skel-base: var(--tilw-stage-surface);
  --skel-hi: color-mix(in srgb, var(--tilw-stage-surface) 90%, var(--tilw-stage-secondary));
}
.ui-skel.inline {
  display: inline-block;
  vertical-align: middle;
}
/* RTL: the shine runs with the reading direction. */
:dir(rtl) .ui-skel {
  animation-direction: reverse;
}
@keyframes skel { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .ui-skel {
    animation: none;
    background: var(--skel-base);
  }
}
</style>
