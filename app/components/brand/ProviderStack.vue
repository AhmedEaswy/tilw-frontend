<script setup lang="ts">
/**
 * Two or more provider marks on round tiles, each one overlapping the one before by half its width (the AI row in
 * settings: OpenAI + Anthropic). Every tile has a ring in the surface colour behind it so the overlap reads cleanly;
 * set `--provider-ring` on a parent when the stack sits on another surface (hover, selected, stage).
 * Decorative by default (the row's text names it); `label` makes it an image with that name, and `named` uses the
 * provider names ("OpenAI · Anthropic").
 */
import type { ProviderId } from './ProviderMark.vue'
import { PROVIDER_NAMES } from './ProviderMark.vue'

const props = withDefaults(defineProps<{ providers: ProviderId[]; size?: number; label?: string; named?: boolean }>(), { size: 28 })
const name = computed(() => props.label ?? (props.named ? props.providers.map(p => PROVIDER_NAMES[p]).join(' · ') : undefined))
</script>

<template>
  <span
    class="provider-stack"
    :role="name ? 'img' : undefined"
    :aria-label="name"
    :aria-hidden="name ? undefined : 'true'"
    :style="{ '--tile': `${size}px` }"
  >
    <span v-for="p in providers" :key="p" class="tile">
      <ProviderMark :provider="p" :size="Math.round(size * 0.58)" />
    </span>
  </span>
</template>

<style scoped>
.provider-stack {
  display: inline-flex;
  flex: none;
  align-items: center;
}
.tile {
  display: grid;
  place-items: center;
  inline-size: var(--tile);
  block-size: var(--tile);
  border-radius: 50%;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
  box-shadow: 0 0 0 2px var(--provider-ring, var(--tilw-surface-white));
  position: relative;
}
.tile + .tile {
  margin-inline-start: calc(var(--tile) / -2);
}
</style>
