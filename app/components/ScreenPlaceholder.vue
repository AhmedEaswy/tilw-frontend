<script setup lang="ts">
/** Temporary stand-in for routes whose screens are scheduled in later task phases. */
defineProps<{ title: string; task: string }>()
const { t } = useI18n()
</script>

<template>
  <section class="placeholder">
    <h1>{{ title }}</h1>
    <UiBanner tone="info">{{ t('placeholder.text') }} <span class="ltr num">({{ task }})</span></UiBanner>
  </section>
</template>

<style scoped>
.placeholder {
  display: grid;
  gap: var(--tilw-space-24);
  padding-block: 40px;
}
h1 {
  font: var(--tilw-type-page);
}
@media (max-width: 760px) {
  h1 { font: 700 36px/1.36 var(--tilw-font-ar); }
}
</style>
