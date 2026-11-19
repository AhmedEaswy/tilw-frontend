<script setup lang="ts">
/** Toast stack fed by useToast(). Mounted once in app.vue. */
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="ui-toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`t-${t.tone}`" role="status">
        <UiGlyph :name="t.tone === 'error' ? 'close' : 'check'" :size="18" />
        <span>{{ t.text }}</span>
        <button type="button" class="x" :aria-label="$t('common.close')" @click="dismiss(t.id)">
          <UiGlyph name="close" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ui-toasts {
  position: fixed;
  z-index: 100;
  inset-block-end: calc(16px + env(safe-area-inset-bottom, 0px));
  inset-inline-start: 50%;
  translate: -50% 0;
  display: grid;
  gap: 8px;
  inline-size: min(440px, calc(100vw - 32px));
  pointer-events: none;
}
[dir='rtl'] .ui-toasts {
  translate: 50% 0;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 10px 16px;
  padding-inline: 16px 8px;
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
  font: var(--tilw-type-meta);
  box-shadow: var(--tilw-shadow-pop);
}
.toast span {
  flex: 1;
}
.t-success :deep(.ui-glyph) { color: #7fd3a6; }
.t-error :deep(.ui-glyph) { color: #f08a80; }
.x {
  display: grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-stage-secondary);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
