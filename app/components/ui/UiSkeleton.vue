<script setup lang="ts">
withDefaults(defineProps<{ h?: string; w?: string; r?: string }>(), { h: '16px', w: '100%', r: '6px' })
</script>

<template>
  <span class="ui-skel" :style="{ blockSize: h, inlineSize: w, borderRadius: r }" aria-hidden="true" />
</template>

<style scoped>
.ui-skel {
  display: block;
  background: linear-gradient(90deg, var(--tilw-surface-quiet) 25%, color-mix(in srgb, var(--tilw-surface-quiet) 60%, var(--tilw-surface-white)) 50%, var(--tilw-surface-quiet) 75%);
  background-size: 200% 100%;
  animation: skel 1.4s linear infinite;
}
@keyframes skel { to { background-position: -200% 0; } }
</style>
