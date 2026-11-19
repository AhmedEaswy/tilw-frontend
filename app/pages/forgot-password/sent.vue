<script setup lang="ts">
/** Reset request sent (6:102). Same message whether or not the email has an account. T021. */
definePageMeta({ layout: 'auth', authBack: '/forgot-password' })
const { t } = useI18n()
useHead({ title: () => `${t('auth.recovery.sentTitle')} · tilwprompter` })
const isMock = useRuntimeConfig().public.servicesMode === 'mock'
</script>

<template>
  <div class="sent">
    <AuthHeading icon="mail-check" :title="t('auth.recovery.sentTitle')" :lede="t('auth.recovery.sentLede')" />
    <UiButton to="/signin" block icon-end="arrow-action">{{ t('auth.recovery.backToSignIn') }}</UiButton>
    <UiBanner v-if="isMock" tone="info">
      {{ t('auth.recovery.mockHint') }} <NuxtLink to="/__mock" class="ltr">/__mock</NuxtLink>
    </UiBanner>
  </div>
</template>

<style scoped>
.sent {
  display: grid;
  gap: 22px;
}
.sent :deep(.ui-btn) {
  min-block-size: 52px;
  border-radius: 10px;
}
.sent a.ltr {
  color: var(--tilw-action-primary);
}
</style>
