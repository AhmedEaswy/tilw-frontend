<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.recordings')} · tilwprompter` })
</script>

<template>
  <ScreenPlaceholder :title="t('nav.recordings')" task="T080–T083" />
</template>
