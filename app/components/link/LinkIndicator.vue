<script setup lang="ts">
/**
 * Feature 004 (Figma L2 `277:511`): the link status in the reading masthead — a dot and a label that opens the
 * Connect phone panel. A badge shows a waiting request. Status changes are announced politely and never move focus
 * or resize anything on the reading surface (principle V).
 */
import type { LinkStatus } from '~/services/link/host'

const props = defineProps<{ status: LinkStatus; badge?: boolean; expanded?: boolean }>()
defineEmits<{ open: [] }>()
const { t } = useI18n()

const tone = computed(() => {
  switch (props.status) {
    case 'connected': return 'ok'
    case 'waiting':
    case 'starting':
    case 'partnerOffline': return 'wait'
    default: return 'off'
  }
})
</script>

<template>
  <button type="button" class="ind" :class="tone" :aria-expanded="expanded" @click="$emit('open')">
    <span class="dot" aria-hidden="true" />
    <span class="label" aria-live="polite">{{ t(`link.status.${status}`) }}</span>
    <span v-if="badge" class="badge" aria-hidden="true" />
  </button>
</template>

<style scoped>
.ind {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 44px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 22px;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
  font: 500 15px/1.36 var(--tilw-font-ar);
  white-space: nowrap;
}
.ind:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.ind.wait {
  border-color: var(--tilw-stage-cue);
}
.dot {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--tilw-stage-secondary);
}
.ok .dot {
  background: var(--tilw-status-success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tilw-status-success) 35%, transparent);
}
.wait .dot {
  background: var(--tilw-stage-cue);
}
.badge {
  position: absolute;
  inset-block-start: 4px;
  inset-inline-end: 6px;
  inline-size: 9px;
  block-size: 9px;
  border-radius: 50%;
  background: var(--tilw-stage-rec);
}
</style>
