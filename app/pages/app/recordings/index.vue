<script setup lang="ts">
/**
 * Recordings kept in this browser, for every script (US7, T080). The list itself is RecordingsView, shared with a
 * script's Recordings tab (/app/scripts/:id/recordings).
 */
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.recordings')} · tilwprompter` })
</script>

<template>
  <RecordingsView />
</template>
