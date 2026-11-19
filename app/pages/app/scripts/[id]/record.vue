<script setup lang="ts">
definePageMeta({ layout: 'reader' })
const { t } = useI18n()
useHead({ title: () => `${t('library.setupRecording')} · tilwprompter` })
</script>

<template>
  <div class="ph-wrap">
    <ScreenPlaceholder :title="t('library.setupRecording')" task="T070–T076" />
    <UiButton tone="secondary" to="/app/scripts">{{ t('library.backToScripts') }}</UiButton>
  </div>
</template>

<style scoped>
.ph-wrap { padding-inline: max(24px, env(safe-area-inset-left, 0px)) max(24px, env(safe-area-inset-right, 0px)); padding-block-end: 40px; }
</style>
