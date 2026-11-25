<script setup lang="ts">
/**
 * Admin · users (feature 006 US2, Figma D2 `309:659`): search by email or name, filter by plan and status, newest
 * first, 50 at a time with Load more. Filters live in the address.
 */
import type { AdminStatus } from '~/services/types'
import { dateOnly, dateTime, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.users')} · ${t('admin.title')}` })
const admin = useAdminStore()
const STATUSES = ['active', 'suspended', 'deletion_scheduled', 'admin'] as const

const list = usePagedList(cursor => useServices().admin.users({ q: filters.q, plan: filters.plan, status: filters.status as (typeof STATUSES)[number] | undefined }, cursor))
const filters = useQueryFilters(['q', 'plan', 'status'] as const, { allowed: { status: STATUSES }, onChange: () => void list.reload() })
const q = textModel(filters, 'q')
const plan = computed<string | null>({ get: () => filters.plan ?? null, set: v => (filters.plan = v || undefined) })
const status = filterModel(filters, 'status')
const statusOptions = computed(() => withAll(t('admin.list.all'), STATUSES.map(s => ({ value: s, label: t(`admin.status.${s}`) }))))

onMounted(() => {
  void list.reload()
  void admin.loadPlans().catch(() => {})
})
const tone = (s: AdminStatus) => (s === 'active' ? 'success' : s === 'suspended' ? 'error' : 'warning')
const planName = (key: string | null) => {
  const p = admin.plans?.find(x => x.key === key)
  return p ? (locale.value === 'ar' ? p.nameAr : p.nameEn) : (key ?? '—')
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.users') }}</h1>
        <p class="adm-sub">{{ t('admin.users.sub') }}</p>
      </div>
    </div>

    <div class="adm-filter">
      <UiSearchField v-model="q" size="sm" :placeholder="t('admin.users.search')" :label="t('admin.users.search')" />
      <span class="adm-field"><label for="f-plan">{{ t('admin.users.plan') }}</label><AdminPlanSelect id="f-plan" v-model="plan" :plans="admin.plans ?? []" :all-label="t('admin.list.all')" /></span>
      <span class="adm-field"><label for="f-status">{{ t('admin.users.status') }}</label><UiSelect id="f-status" v-model="status" :options="statusOptions" size="sm" /></span>
      <span class="adm-grow adm-muted">{{ t('admin.users.newest') }}</span>
    </div>
    <section class="adm-card">
      <div class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.users') }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('admin.users.person') }}</th>
              <th scope="col">{{ t('admin.users.plan') }}</th>
              <th scope="col">{{ t('admin.users.status') }}</th>
              <th scope="col">{{ t('admin.users.admin') }}</th>
              <th scope="col">{{ t('admin.users.joined') }}</th>
              <th scope="col">{{ t('admin.users.lastActive') }}</th>
              <th scope="col">{{ t('admin.users.pending') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in list.items.value" :key="u.id">
              <td>
                <NuxtLink :to="`/admin/users/${encodeURIComponent(u.id)}`" class="adm-person">
                  <b>{{ u.name }}</b><small class="adm-ltr">{{ u.email }}</small>
                </NuxtLink>
              </td>
              <td><span class="adm-chip" :class="u.plan === 'free' ? '' : 'info'">{{ planName(u.plan) }}</span></td>
              <td><span class="adm-chip" :class="tone(u.status)">{{ t(`admin.status.${u.status}`) }}</span></td>
              <td>{{ u.isAdmin ? t('admin.users.yes') : '—' }}</td>
              <td class="nowrap" :title="utc(u.createdAt)">{{ dateOnly(u.createdAt, locale) }}</td>
              <td class="nowrap" :title="utc(u.lastActiveAt)">{{ u.lastActiveAt ? dateTime(u.lastActiveAt, locale) : '—' }}</td>
              <td><span v-if="u.pendingRequest" class="adm-chip warning adm-ltr">{{ u.pendingRequest.reference }}</span><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.users.none')"
        @retry="list.reload" @more="list.more"
      />
    </section>
  </div>
</template>
