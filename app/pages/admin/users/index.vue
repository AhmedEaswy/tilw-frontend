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
const filters = useQueryFilters(['q', 'plan', 'status'] as const, { allowed: { status: STATUSES }, debounce: ['q'], onChange: () => void list.reload() })
const route = useRoute()
// The top-bar search navigates here with ?q=; keep the box in step.
watch(() => route.query.q, q => (filters.q = typeof q === 'string' ? q : undefined))

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

    <section class="adm-card">
      <div class="adm-toolbar">
        <input v-model="filters.q" type="search" class="adm-input" dir="auto" :placeholder="t('admin.users.search')" :aria-label="t('admin.users.search')">
        <label class="adm-muted">{{ t('admin.users.plan') }}
          <select v-model="filters.plan" class="adm-select">
            <option :value="undefined">{{ t('admin.list.all') }}</option>
            <option v-for="p in admin.plans ?? []" :key="p.key" :value="p.key">{{ planName(p.key) }}</option>
          </select>
        </label>
        <label class="adm-muted">{{ t('admin.users.status') }}
          <select v-model="filters.status" class="adm-select">
            <option :value="undefined">{{ t('admin.list.all') }}</option>
            <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`admin.status.${s}`) }}</option>
          </select>
        </label>
        <span class="adm-grow adm-muted">{{ t('admin.users.newest') }}</span>
      </div>
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
