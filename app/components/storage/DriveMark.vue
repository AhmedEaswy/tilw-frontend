<script setup lang="ts">
/**
 * The Google Drive product mark, in its own colours (Google's branding allows it to name the integration). Used
 * wherever a take or a setting is about Drive, so "in Drive" reads at a glance instead of as one more grey chip.
 * `mono` draws it in `currentColor` for states where the colours would claim success (failed, unreachable).
 */
withDefaults(defineProps<{ size?: number; mono?: boolean; label?: string }>(), { size: 20 })
</script>

<template>
  <svg
    class="drive-mark"
    :class="{ mono }"
    viewBox="0 0 87.3 78"
    :width="size"
    :height="Math.round(size * 78 / 87.3)"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
</template>

<style scoped>
.drive-mark {
  display: block;
  flex: none;
}
.mono path {
  fill: currentColor;
}
</style>
