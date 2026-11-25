<script setup lang="ts">
/**
 * Wraps a loading placeholder: marks the region busy and gives it one visually hidden "Loading…" text, so a screen
 * reader meets it once when reading the page. It is not a live region, so it is never announced again while the
 * shimmer runs. Everything drawn inside (UiSkeleton shapes) is aria-hidden.
 *
 * Give it the real content's layout class (`class="grid"`) so the placeholder follows the same grid and breakpoints.
 */
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{ tag?: string; label?: boolean }>(), { tag: 'div', label: true })
const { t } = useI18n()
</script>

<template>
  <component :is="tag" class="skel-region" aria-busy="true" data-skeleton>
    <span v-if="label" class="visually-hidden">{{ t('common.loading') }}</span>
    <slot />
  </component>
</template>
