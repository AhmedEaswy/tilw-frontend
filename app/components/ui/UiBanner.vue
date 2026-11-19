<script setup lang="ts">
/** Inline status message (Figma "Feedback at the point of action", 6:118). */
withDefaults(defineProps<{ tone?: 'info' | 'success' | 'error' | 'warning' }>(), { tone: 'info' })
</script>

<template>
  <div class="ui-banner" :class="`t-${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <UiGlyph :name="tone === 'success' ? 'check' : tone === 'error' ? 'close' : 'clock'" :size="20" />
    <div class="txt"><slot /></div>
    <div v-if="$slots.action" class="act"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.ui-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--tilw-space-12);
  padding: var(--tilw-space-12) var(--tilw-space-16);
  border-radius: var(--tilw-radius-control);
  border: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
  font: var(--tilw-type-meta);
}
.txt {
  flex: 1;
  min-inline-size: 0;
  padding-block: 1px;
}
.t-success { color: var(--tilw-status-success); }
.t-success .txt { color: var(--tilw-text-ink); }
.t-error { color: var(--tilw-status-error); border-color: color-mix(in srgb, var(--tilw-status-error) 40%, transparent); }
.t-error .txt { color: var(--tilw-text-ink); }
.t-warning { color: var(--tilw-action-primary); background: var(--tilw-surface-selected); border-color: transparent; }
.t-warning .txt { color: var(--tilw-text-ink); }
.t-info { color: var(--tilw-text-muted); }
</style>
