<script setup lang="ts">
/** Centered empty state (Figma 6:22 empty library, 6:77 recordings first visit). */
import type { GlyphName } from './UiGlyph.vue'
defineProps<{ title: string; text?: string; icon?: GlyphName }>()
</script>

<template>
  <section class="ui-empty">
    <span v-if="icon" class="ic"><UiGlyph :name="icon" :size="28" /></span>
    <h2>{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <div v-if="$slots.default" class="acts"><slot /></div>
  </section>
</template>

<style scoped>
.ui-empty {
  display: grid;
  justify-items: center;
  gap: var(--tilw-space-16);
  padding-block: var(--tilw-space-48);
  text-align: center;
}
.ic {
  display: grid;
  place-items: center;
  inline-size: 64px;
  block-size: 64px;
  border-radius: 16px;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-action-primary);
}
h2 {
  font: var(--tilw-type-heading);
}
p {
  max-inline-size: 42ch;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-body);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--tilw-space-12);
  margin-block-start: var(--tilw-space-8);
}
</style>
