<script setup lang="ts">
/**
 * Off / Manual / Auto (R2-6). On a plan without automatic sync, Auto shows a lock and a "Pro" tag, and choosing it
 * emits `locked` (the page opens the upgrade sheet) instead of changing the mode. Disabled until Drive is linked.
 */
import type { SyncMode } from '~/services/types'

const props = defineProps<{ mode: SyncMode; autoAllowed: boolean; disabled?: boolean }>()
const emit = defineEmits<{ change: [mode: SyncMode]; locked: [] }>()
const { t } = useI18n()

const modes: SyncMode[] = ['off', 'manual', 'auto']
function pick(m: SyncMode) {
  if (props.disabled || m === props.mode) return
  if (m === 'auto' && !props.autoAllowed) return emit('locked')
  emit('change', m)
}
</script>

<template>
  <section class="sync" aria-labelledby="sync-h">
    <h2 id="sync-h">{{ t('storage.syncTitle') }}</h2>
    <div class="opts" role="radiogroup" :aria-labelledby="'sync-h'" :aria-disabled="disabled || undefined">
      <button
        v-for="m in modes"
        :key="m"
        type="button"
        role="radio"
        class="opt"
        :aria-checked="mode === m"
        :disabled="disabled"
        @click="pick(m)"
      >
        <span class="radio" aria-hidden="true" />
        <span class="txt">
          <b>{{ t(`storage.mode.${m}`) }}<span v-if="m === 'auto' && !autoAllowed" class="pro"><UiGlyph name="privacy" :size="14" />Pro</span></b>
          <small>{{ t(`storage.modeHint.${m}`) }}</small>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.sync {
  display: grid;
  gap: 14px;
}
h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.opts {
  display: grid;
  gap: 10px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 14px;
  min-block-size: 72px;
  padding: 12px 20px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-align: start;
  cursor: pointer;
}
.opt[aria-checked='true'] {
  border-color: var(--tilw-action-primary);
  background: var(--tilw-surface-selected);
}
.opt:disabled {
  cursor: default;
  opacity: 0.55;
}
.opt:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.radio {
  flex: 0 0 auto;
  inline-size: 20px;
  block-size: 20px;
  border: 2px solid var(--tilw-border-strong);
  border-radius: 50%;
}
.opt[aria-checked='true'] .radio {
  border-color: var(--tilw-action-primary);
  box-shadow: inset 0 0 0 4px var(--tilw-surface-selected), inset 0 0 0 10px var(--tilw-action-primary);
}
.txt {
  display: grid;
  gap: 2px;
}
.txt b {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.txt small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.4 var(--tilw-font-ar);
}
.pro {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-cue);
  font: 600 12px/1.6 var(--tilw-font-lat);
}
</style>
