<script setup lang="ts">
/** Form column used by every auth screen: banner for form-level errors, fields, actions, footer. */
defineProps<{ error?: string }>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <form class="af" novalidate @submit.prevent="emit('submit')">
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
    <slot />
    <div v-if="$slots.footer" class="foot"><slot name="footer" /></div>
  </form>
</template>

<style scoped>
.af {
  display: grid;
  gap: 22px;
}
.af :deep(.ui-btn) {
  margin-block-start: 8px;
  min-block-size: 52px;
  border-radius: 10px;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  margin-block-start: 14px;
  padding-block-start: 22px;
  border-block-start: 1px solid var(--tilw-border-subtle);
  font: 400 15px/23px var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.foot :deep(a) {
  color: var(--tilw-action-solid);
  font-weight: 500;
  text-decoration: none;
}
.foot :deep(a:hover) {
  text-decoration: underline;
}
</style>
