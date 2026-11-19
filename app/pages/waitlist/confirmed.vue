<script setup lang="ts">
/** Waitlist · confirmed (6:64). Shows the email that just joined; sends people back if they land here directly. T023. */
definePageMeta({ layout: 'auth', authPhoto: 'glass' })
const { t } = useI18n()
useHead({ title: () => `${t('waitlist.doneTitle')} · tilwprompter` })

const joined = useWaitlistEmail()
onMounted(() => {
  if (!joined.value) navigateTo('/waitlist', { replace: true })
})
</script>

<template>
  <div class="done">
    <AuthHeading icon="mail-check" :title="t('waitlist.doneTitle')" :lede="t('waitlist.doneLede')" />
    <p v-if="joined" class="email ltr">{{ joined }}</p>
    <UiButton to="/" block icon-end="play-small">{{ t('waitlist.tryPrompter') }}</UiButton>
  </div>
</template>

<style scoped>
.done {
  display: grid;
  gap: 22px;
}
.done :deep(.ah) {
  margin-block-end: 0;
}
.email {
  font: 500 20px/29px var(--tilw-font-lat);
  color: var(--tilw-text-ink);
  text-align: end;
  margin-block-end: 26px;
}
[dir='ltr'] .email {
  text-align: start;
}
.done :deep(.ui-btn) {
  min-block-size: 52px;
  border-radius: 12px;
}
</style>
