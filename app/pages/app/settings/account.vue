<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.profile')} · tilwprompter` })
// Edit name and change password (G5) land in T093. The profile menu links here already.
</script>

<template>
  <div>
    <ScreenPlaceholder :title="t('nav.profile')" task="T093" />
    <UiButton tone="secondary" to="/app/settings">{{ t('nav.settings') }}</UiButton>
  </div>
</template>
