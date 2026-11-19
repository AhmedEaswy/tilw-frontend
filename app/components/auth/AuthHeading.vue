<script setup lang="ts">
/**
 * Heading block of the auth frames: optional state tile (copper glyph on selected surface,
 * 6:63 / 6:101 / 6:102), title, and lede.
 */
import type { GlyphName } from '~/components/ui/UiGlyph.vue'
defineProps<{ title: string; lede?: string; icon?: GlyphName }>()
</script>

<template>
  <header class="ah">
    <span v-if="icon" class="tile" aria-hidden="true"><UiGlyph :name="icon" :size="26" /></span>
    <h1>{{ title }}</h1>
    <p v-if="lede">{{ lede }}</p>
    <slot />
  </header>
</template>

<style scoped>
.ah {
  display: grid;
  gap: 12px;
  margin-block-end: 28px;
}
.tile {
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 56px;
  margin-block-end: 18px;
  border-radius: 16px;
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}
h1 {
  font: 700 44px/60px var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
p {
  font: 400 18px/29px var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
:lang(en) h1,
:lang(en) p {
  font-family: var(--tilw-font-lat);
}
@media (max-width: 860px) {
  h1 { font-size: 31px; line-height: 45px; }
  p { font-size: 17px; line-height: 26px; }
}
</style>
