<script setup lang="ts">
/**
 * Admin · audit log (feature 006 US7, Figma D9 `313:1849`): every admin change, newest first, 50 at a time, filtered
 * by admin, action (from the service's action list, grouped by target), target and date range.
 */
import { actionKey, dayToIso } from '~/utils/admin'

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
const filters = useQueryFilters(['adminId', 'action', 'targetType', 'targetId', 'from', 'to'] as const, { debounce: ['targetId'], onChange: () => void list.reload() })
onMounted(() => {
  void list.reload()
  void admin.loadActions().catch(() => {})
})
const grouped = computed(() => {
  const g: Record<string, string[]> = {}
  for (const a of admin.actions ?? []) (g[a.targetType] ??= []).push(a.action)
  return g
})
const label = (a: string) => (te(`admin.audit.action.${actionKey(a)}`) ? t(`admin.audit.action.${actionKey(a)}`) : a)
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
        <label class="adm-muted">{{ t('admin.audit.action.label') }}
          <select v-model="filters.action" class="adm-select">
            <option :value="undefined">{{ t('admin.audit.allActions') }}</option>
            <optgroup v-for="(acts, target) in grouped" :key="target" :label="String(target)">
              <option v-for="a in acts" :key="a" :value="a">{{ label(a) }} · {{ a }}</option>
            </optgroup>
          </select>
        </label>
        <input v-model="filters.targetId" class="adm-input adm-ltr" type="search" :placeholder="t('admin.audit.targetId')" :aria-label="t('admin.audit.targetId')">
        <label class="adm-muted">{{ t('admin.range.from') }} <input v-model="filters.from" class="adm-input" type="date"></label>
        <label class="adm-muted">{{ t('admin.range.to') }} <input v-model="filters.to" class="adm-input" type="date"></label>
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
