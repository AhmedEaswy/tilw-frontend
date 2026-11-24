<script setup lang="ts">
/** Feature 004, US5 (T048, Figma L8): Settings → Phone links. */
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('link.history.pageTitle')} · tilwprompter` })
</script>

<template>
  <div class="pl">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('link.history.pageTitle') }}</h1>
    <LinkHistory />
  </div>
</template>

<style scoped>
/* Same frame as the other settings pages (storage, plan). */
.pl {
  display: grid;
  gap: 20px;
  padding-block: 30px 48px;
}
.back {
  justify-self: start;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
h1 {
  margin: 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
</style>
