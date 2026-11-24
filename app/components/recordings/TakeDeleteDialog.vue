<script setup lang="ts">
/**
 * Delete a take (R2-8 `264:732`, release-1 dialog 6:23 layout). A take on this device and in Drive offers
 * "Delete from this device" (the Drive copy stays and the take shows as In Drive only), "Delete from Drive too" and
 * Cancel. A Drive-only take is deleted from Drive; a device-only take keeps the release-1 confirm.
 */
import type { TakeMeta } from '~/services/takes'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ take: TakeMeta; busy?: boolean }>()
const emit = defineEmits<{ confirm: [everywhere: boolean] }>()
const { t } = useI18n()

const inBoth = computed(() => !props.take.driveOnly && props.take.remote?.state === 'backed_up')
const title = computed(() => (props.take.driveOnly ? t('uploads.deleteDriveTitle') : inBoth.value ? t('uploads.deleteBothTitle') : t('recordings.deleteTitle')))
const lede = computed(() => (props.take.driveOnly ? t('uploads.deleteDriveLede') : inBoth.value ? t('uploads.deleteBothLede') : t('recordings.deleteLede')))
</script>

<template>
  <UiDialog v-model:open="open" :title="title">
    <p>{{ lede }}</p>
    <template #actions>
      <template v-if="inBoth">
        <UiButton tone="danger" :loading="busy" @click="emit('confirm', true)">{{ t('uploads.deleteEverywhere') }}</UiButton>
        <UiButton tone="secondary" :disabled="busy" @click="emit('confirm', false)">{{ t('uploads.deleteDeviceOnly') }}</UiButton>
      </template>
      <UiButton v-else tone="danger" :loading="busy" @click="emit('confirm', true)">{{ take.driveOnly ? t('uploads.deleteFromDrive') : t('recordings.deleteConfirm') }}</UiButton>
      <UiButton tone="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
    </template>
  </UiDialog>
</template>
