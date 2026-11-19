<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.settings')} · tilwprompter` })
// Full preferences screen (6:65) lands in T090. Sign out is available now so the auth flow can be completed.
const { signOut, busy } = useSignOut()
</script>

<template>
  <div>
    <ScreenPlaceholder :title="t('nav.settings')" task="T090–T095" />
    <UiButton tone="secondary" :loading="busy" @click="signOut">{{ t('auth.signOut') }}</UiButton>
  </div>
</template>
