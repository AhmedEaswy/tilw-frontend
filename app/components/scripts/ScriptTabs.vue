<script setup lang="ts">
/**
 * Script / Recordings tabs at the end of a script's "Back to my scripts" row. Same small segmented look as the admin
 * dashboard's period tabs (`.adm-seg`): a quiet track, the current tab lifted on the white surface. They are links
 * (each view has its own address), so the current one is marked with aria-current.
 */
const props = defineProps<{ scriptId: string; current: 'script' | 'recordings' }>()
const { t } = useI18n()
const tabs = computed(() => [
  { key: 'script', to: `/app/scripts/${props.scriptId}`, label: t('scriptTabs.script') },
  { key: 'recordings', to: `/app/scripts/${props.scriptId}/recordings`, label: t('scriptTabs.recordings') },
])
</script>

<template>
  <nav class="seg" :aria-label="t('scriptTabs.label')">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      :aria-current="tab.key === current ? 'page' : undefined"
      :data-testid="`script-tab-${tab.key}`"
    >{{ tab.label }}</NuxtLink>
  </nav>
</template>

<style scoped>
/* Mirrors `.adm-seg` in assets/css/admin.css (the studio doesn't load the admin stylesheet). */
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--tilw-surface-quiet);
}
.seg a {
  padding: 5px 12px;
  border-radius: 8px;
  color: var(--tilw-text-muted);
  font: 500 13px/1.4 var(--tilw-font-ar);
  text-decoration: none;
  white-space: nowrap;
}
.seg a:hover {
  color: var(--tilw-text-ink);
}
.seg a[aria-current='page'] {
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font-weight: 600;
}
.seg a:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
</style>
