<script setup lang="ts">
/**
 * Admin · audit log (feature 006 US7, Figma D9 `313:1849`): every admin change, newest first, 50 at a time, filtered
 * by admin, action (from the service's action list, grouped by target), target and date range.
 */
import { actionKey, dayToIso } from '~/utils/admin'
import type { UiOption } from '~/utils/uiControls'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, te } = useI18n()
useHead({ title: () => `${t('admin.nav.audit')} · ${t('admin.title')}` })
const admin = useAdminStore()

const list = usePagedList(cursor => useServices().admin.auditLog({
  adminId: filters.adminId,
  action: filters.action,
  targetType: filters.targetType,
  targetId: filters.targetId,
  after: dayToIso(filters.from),
  before: dayToIso(filters.to, true),
}, cursor))
const filters = useQueryFilters(['adminId', 'action', 'targetType', 'targetId', 'from', 'to'] as const, { onChange: () => void list.reload() })
const range = rangeModel(filters, 'from', 'to')
const today = toIsoDate(new Date())
onMounted(() => {
  void list.reload()
  void admin.loadActions().catch(() => {})
})
const label = (a: string) => (te(`admin.audit.action.${actionKey(a)}`) ? t(`admin.audit.action.${actionKey(a)}`) : a)
// The service's action list, grouped by target (the group shows as the hint), "label · code" so either can be typed.
const actionOptions = computed<UiOption<string>[]>(() => [...(admin.actions ?? [])]
  .sort((a, b) => a.targetType.localeCompare(b.targetType))
  .map(a => ({ value: a.action, label: `${label(a.action)} · ${a.action}`, hint: a.targetType, group: a.targetType })))
async function findAction(q: string) {
  const term = q.trim().toLocaleLowerCase()
  return actionOptions.value.filter(o => o.label.toLocaleLowerCase().includes(term) || o.hint!.toLocaleLowerCase().includes(term))
}
const action = computed<string | null>({ get: () => filters.action ?? null, set: v => (filters.action = v || undefined) })
const targetId = textModel(filters, 'targetId')
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.audit') }}</h1>
        <p class="adm-sub">{{ t('admin.audit.sub') }}</p>
      </div>
    </div>
    <section class="adm-card">
      <div class="adm-toolbar">
        <span class="adm-field"><label for="f-action">{{ t('admin.audit.action.label') }}</label><UiAutocomplete id="f-action" v-model="action" class="act" :source="findAction" :selected-options="actionOptions" :debounce="0" size="sm" :placeholder="t('admin.audit.allActions')" /></span>
        <UiSearchField v-model="targetId" kind="id" size="sm" :placeholder="t('admin.audit.targetId')" :label="t('admin.audit.targetId')" />
        <span class="adm-field"><label for="f-range">{{ t('admin.range.label') }}</label><UiDatePicker id="f-range" v-model="range" mode="range" size="sm" :max="today" /></span>
        <span v-if="filters.adminId" class="adm-chip info">{{ t('admin.audit.oneAdmin') }} <button type="button" class="adm-link" :aria-label="t('common.close')" @click="filters.adminId = undefined">×</button></span>
      </div>
      <AuditTable v-if="list.items.value.length" :entries="list.items.value" />
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.audit.none')" @retry="list.reload" @more="list.more"
      />
    </section>
  </div>
</template>

<style scoped>
.act {
  inline-size: min(320px, 60vw);
}
</style>
