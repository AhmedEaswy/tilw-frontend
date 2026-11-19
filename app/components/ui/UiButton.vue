<script setup lang="ts">
/**
 * Figma "Action" (3:32). Tones: primary (main action), secondary, dark, cue (accent on the reading stage),
 * ghost (tertiary). Renders a NuxtLink when `to` is set.
 */
import type { RouteLocationRaw } from 'vue-router'
import type { GlyphName } from './UiGlyph.vue'

const props = withDefaults(
  defineProps<{
    tone?: 'primary' | 'secondary' | 'dark' | 'cue' | 'ghost' | 'danger'
    to?: RouteLocationRaw
    type?: 'button' | 'submit'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    size?: 'md' | 'sm'
    icon?: GlyphName
    /** Glyph after the label (auth frames put the forward arrow there). */
    iconEnd?: GlyphName
  }>(),
  { tone: 'primary', type: 'button', size: 'md' },
)

const tag = computed(() => (props.to && !props.disabled ? resolveComponent('NuxtLink') : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
    class="ui-btn"
    :class="[`t-${tone}`, `s-${size}`, { block, loading }]"
  >
    <UiGlyph v-if="icon" :name="icon" :size="size === 'sm' ? 18 : 20" />
    <span class="lbl"><slot /></span>
    <UiGlyph v-if="iconEnd" :name="iconEnd" :size="18" />
    <span v-if="loading" class="spin" aria-hidden="true" />
  </component>
</template>

<style scoped>
.ui-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-block-size: var(--tilw-control-h);
  min-inline-size: 120px;
  padding-inline: var(--tilw-space-24);
  border: 1px solid transparent;
  border-radius: var(--tilw-radius-control);
  font: var(--tilw-type-control);
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.ui-btn.s-sm {
  min-block-size: 40px;
  min-inline-size: 0;
  padding-inline: var(--tilw-space-16);
  font: var(--tilw-type-label);
}
.ui-btn.block {
  inline-size: 100%;
}
.ui-btn:not(:disabled):active {
  transform: scale(0.98);
}
.ui-btn:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}

.t-primary { background: var(--tilw-action-solid); color: var(--tilw-text-on-solid); }
.t-primary:not(:disabled):hover { background: color-mix(in srgb, var(--tilw-action-solid) 88%, #000); }
.t-secondary { background: var(--tilw-surface-white); color: var(--tilw-text-ink); border-color: var(--tilw-border-subtle); }
.t-secondary:not(:disabled):hover { border-color: var(--tilw-border-strong); }
.t-dark { background: var(--tilw-stage-background); color: var(--tilw-text-on-stage); }
.t-dark:not(:disabled):hover { background: var(--tilw-stage-surface); }
.t-cue { background: var(--tilw-stage-cue); color: var(--tilw-stage-background); }
.t-cue:not(:disabled):hover { background: #f7c9ac; }
.t-ghost { background: transparent; color: var(--tilw-action-primary); }
.t-ghost:not(:disabled):hover { background: var(--tilw-surface-quiet); }
.t-danger { background: var(--tilw-status-error); color: #f7f2e9; }

.ui-btn:disabled {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  border-color: transparent;
  cursor: not-allowed;
}
.t-secondary:disabled { border-color: var(--tilw-border-subtle); }

.loading .lbl { opacity: 0.35; }
.spin {
  position: absolute;
  inline-size: 18px;
  block-size: 18px;
  border: 2px solid currentColor;
  border-inline-end-color: transparent;
  border-radius: 50%;
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin { to { transform: rotate(360deg); } }
</style>
