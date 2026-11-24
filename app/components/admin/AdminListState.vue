<script setup lang="ts">
/**
 * Feature 006 (FR-005): the shared states under a list: first load skeleton, load error with Retry, empty, and
 * "Load more" for paged lists (with a polite status for screen readers).
 */
defineProps<{ loading: boolean; loaded: boolean; error: unknown; empty: boolean; done?: boolean; paged?: boolean; emptyText?: string; count?: number }>()
const emit = defineEmits<{ retry: []; more: [] }>()
const { t } = useI18n()
const errorText = useErrorText()
</script>

<template>
  <div v-if="!loaded && loading" class="adm-more"><UiSkeleton h="120px" /></div>
  <div v-else-if="error" class="adm-more" role="alert">
    <span class="adm-err">{{ errorText(error) }}</span>
    <button type="button" class="adm-btn" @click="emit('retry')">{{ t('common.retry') }}</button>
  </div>
  <p v-else-if="loaded && empty" class="adm-empty">{{ emptyText ?? t('admin.list.empty') }}</p>
  <div v-else-if="paged && loaded" class="adm-more">
    <span v-if="count !== undefined" class="adm-muted" aria-live="polite">{{ t('admin.list.shown', { n: count }) }}</span>
    <button v-if="!done" type="button" class="adm-btn" :disabled="loading" @click="emit('more')">{{ loading ? t('admin.list.loading') : t('admin.list.more') }}</button>
    <span v-else class="adm-muted">{{ t('admin.list.end') }}</span>
  </div>
</template>
