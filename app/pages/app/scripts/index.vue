<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.scripts')} · tilwprompter` })
</script>

<template>
  <ScreenPlaceholder :title="t('nav.scripts')" task="T040–T047" />
</template>
