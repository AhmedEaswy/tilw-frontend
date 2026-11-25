<script setup lang="ts">
/**
 * Limit reached (R2-2 `262:790`), built from the release-1 New-script dialog (6:23): names the limit, its value and
 * the current usage, and offers the way forward: Upgrade to Pro, plus Archive a script or Shorten when they help.
 * Opened from anywhere by `useLimitError().handle(e)`; mounted once in the app layout.
 */
import { describeLimit } from '~/utils/limits'

const { t } = useI18n()
const { current, close } = useLimitError()
const upgrade = useUpgrade()
const plan = usePlanStore()
const route = useRoute()

const open = computed({
  get: () => current.value !== null,
  set: v => !v && close(),
})
const copy = computed(() => describeLimit(current.value))
const showUpgrade = computed(() => copy.value.upgrade && !plan.isPro && upgrade.available.value)

async function archive() {
  close()
  // The library is where scripts are archived; show every active one.
  useScriptsStore().filter = 'all'
  if (route.path !== '/app/scripts') await navigateTo('/app/scripts')
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t(copy.title)">
    <p>{{ t(copy.text, copy.params) }}</p>
    <p v-if="showUpgrade" class="pro">{{ t('limits.dialog.proHint') }}</p>
    <template #actions>
      <UiButton v-if="showUpgrade" @click="upgrade.open()">{{ t('upgrade.cta') }}</UiButton>
      <UiButton v-else-if="copy.action !== 'archive'" @click="close">{{ t('limits.dialog.ok') }}</UiButton>
      <UiButton v-if="copy.action === 'archive'" :tone="showUpgrade ? 'secondary' : 'primary'" icon="archive" @click="archive">{{ t('limits.dialog.archive') }}</UiButton>
      <UiButton tone="secondary" @click="close">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.pro {
  font-size: 18px;
}
</style>
