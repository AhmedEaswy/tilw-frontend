<script setup lang="ts">
/**
 * The report period control for the dashboard and Analytics: the 7 / 30 / 90 / 365-day tabs, then a "Custom" tab that
 * opens a date-range field right after them. Picking a range puts `from`/`to` in the address (useAdminPeriod).
 */
import { ADMIN_PERIODS, todayUtc, useAdminPeriod } from '~/composables/useAdminPeriod'
import type { UiDateRange } from '~/utils/uiControls'

const { t } = useI18n()
const { range, days, setDays, setRange } = useAdminPeriod()

// The field shows while a custom range is in the address, or once "Custom" is chosen and before a range is picked.
const customOpen = ref(!!range.value)
watch(range, r => { if (r) customOpen.value = true })
const custom = computed(() => customOpen.value || !!range.value)

const draft = ref<UiDateRange | null>(range.value ? { ...range.value } : null)
watch(range, r => { draft.value = r ? { ...r } : null })
watch(draft, r => { if (r?.from && r.to && (r.from !== range.value?.from || r.to !== range.value?.to)) setRange(r) })

function pick(d: number) {
  customOpen.value = false
  setDays(d)
}
const max = todayUtc()
// At most 366 days back (the backend's limit for a range).
const min = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
</script>

<template>
  <div class="period">
    <div class="adm-seg" role="group" :aria-label="t('admin.dash.period')">
      <button v-for="p in ADMIN_PERIODS" :key="p" type="button" :aria-pressed="!custom && days === p" @click="pick(p)">{{ t('admin.dash.days', { n: p }) }}</button>
      <button type="button" :aria-pressed="custom" data-testid="period-custom" @click="customOpen = true">{{ t('admin.customPeriod.tab') }}</button>
    </div>
    <UiDatePicker
      v-if="custom"
      v-model="draft"
      mode="range"
      size="sm"
      :min="min"
      :max="max"
      :clearable="false"
      :label="t('admin.customPeriod.label')"
      :placeholder="t('admin.customPeriod.placeholder')"
      class="range"
      data-testid="period-range"
    />
  </div>
</template>

<style scoped>
.period {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.range {
  min-inline-size: 240px;
}
</style>
