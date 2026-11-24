<script setup lang="ts">
/**
 * Feature 005: one AI message card (A2 messages board `294:416`): a coloured start edge, title, text and actions.
 * Used in the format drawer and the speech dialogs for refusals, failures and the negative balance.
 */
withDefaults(defineProps<{ title: string; text?: string; tone?: 'warning' | 'error' | 'info' }>(), { tone: 'warning' })
</script>

<template>
  <div class="ai-msg" :class="`t-${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <b>{{ title }}</b>
    <p v-if="text">{{ text }}</p>
    <slot />
    <div v-if="$slots.actions" class="acts"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.ai-msg {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 10px;
  border-inline-start: 4px solid var(--tilw-stage-cue, var(--tilw-action-primary));
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
}
.t-error {
  border-inline-start-color: var(--tilw-status-error);
}
.t-info {
  border-inline-start-color: var(--tilw-action-primary);
}
b {
  font: 700 17px/1.45 var(--tilw-font-ar);
}
p {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 14px/1.6 var(--tilw-font-ar);
}
.acts {
  display: grid;
  gap: 8px;
  margin-block-start: 4px;
}
</style>
