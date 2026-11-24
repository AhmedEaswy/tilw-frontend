<script setup lang="ts">
/** Drive space (Google's figures) and the space Tilw takes use there (R2-6 `254:564`, FR-009). */
import type { StorageStatus } from '~/services/types'

const props = defineProps<{ quota: NonNullable<StorageStatus['quota']> }>()
const { t, locale } = useI18n()

const used = computed(() => formatBytes(props.quota.usedBytes, locale.value))
const total = computed(() => (props.quota.totalBytes ? formatBytes(props.quota.totalBytes, locale.value) : null))
const free = computed(() => (props.quota.totalBytes ? formatBytes(Math.max(0, props.quota.totalBytes - props.quota.usedBytes), locale.value) : null))
const ratio = computed(() => (props.quota.totalBytes ? Math.min(1, props.quota.usedBytes / props.quota.totalBytes) : null))
const full = computed(() => ratio.value !== null && ratio.value >= 0.98)
</script>

<template>
  <section id="space" class="space" aria-labelledby="space-h">
    <h2 id="space-h">{{ t('storage.spaceTitle') }}</h2>
    <div class="row">
      <div class="top">
        <span>{{ t('storage.driveSpace') }}</span>
        <span class="val" :class="{ full }">{{ total ? t('storage.usedOf', { used, total }) : used }}</span>
      </div>
      <div
        v-if="ratio !== null"
        class="bar"
        role="meter"
        :aria-label="t('storage.driveSpace')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(ratio * 100)"
        :aria-valuetext="t('storage.usedOf', { used, total })"
      >
        <span class="fill" :class="{ full }" :style="{ inlineSize: `${Math.max(2, ratio * 100)}%` }" />
      </div>
      <small v-if="free">{{ full ? t('storage.full') : t('storage.free', { free }) }}</small>
    </div>
    <div class="row">
      <div class="top">
        <span>{{ t('storage.tilwSpace') }}</span>
        <span class="val">{{ formatBytes(quota.tilwBytes, locale) }}</span>
      </div>
      <small>{{ t('storage.tilwTakes', { n: quota.tilwTakes }) }}</small>
    </div>
  </section>
</template>

<style scoped>
.space {
  display: grid;
  gap: 12px;
}
h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.row {
  display: grid;
  gap: 8px;
  padding: 18px 22px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.val {
  color: var(--tilw-text-muted);
  font-weight: 400;
}
.val.full {
  color: var(--tilw-status-error);
}
small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.4 var(--tilw-font-ar);
}
.bar {
  block-size: 6px;
  border-radius: 3px;
  background: var(--tilw-surface-quiet);
  overflow: hidden;
}
.fill {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--tilw-status-success);
}
.fill.full {
  background: var(--tilw-status-error);
}
</style>
