<script setup lang="ts">
/**
 * Feature 004 (research R2, Figma L1 `276:158`): the remote address as a QR code, drawn here in the browser so the
 * one-time secret never goes to a QR service. Dark modules on white with a 4-module quiet zone, in light and dark
 * themes alike, so every phone camera reads it.
 */
import { encode } from 'uqr'

const props = withDefaults(defineProps<{ value: string; label: string; size?: number }>(), { size: 196 })

const qr = computed(() => {
  const { data, size } = encode(props.value, { ecc: 'M', border: 4 })
  let d = ''
  data.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x} ${y}h1v1h-1z` }))
  return { d, size }
})
</script>

<template>
  <div class="qr" role="img" :aria-label="label">
    <svg :width="size" :height="size" :viewBox="`0 0 ${qr.size} ${qr.size}`" shape-rendering="crispEdges" aria-hidden="true">
      <rect :width="qr.size" :height="qr.size" fill="#ffffff" />
      <path :d="qr.d" fill="#1c2c35" />
    </svg>
  </div>
</template>

<style scoped>
.qr {
  display: inline-grid;
  padding: 12px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 16px;
  background: #ffffff;
  line-height: 0;
}
</style>
