<script setup lang="ts">
/**
 * Admin · payments (feature 006 US4, Figma D7 `311:2092`): fulfilled upgrade requests for a date range, newest first,
 * with the count and total for the whole range (not just the rows loaded).
 */
import type { PaymentsPage } from '~/services/types'
import { dateOnly, dayToIso, money, num, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.payments')} · ${t('admin.title')}` })

const totals = ref<Pick<PaymentsPage, 'count' | 'totalCents'> | null>(null)
const list = usePagedList(async (cursor) => {
  const page = await useServices().admin.payments({ from: dayToIso(filters.from), to: dayToIso(filters.to, true), userId: filters.userId }, cursor)
  if (!cursor) totals.value = { count: page.count, totalCents: page.totalCents }
  return page
})
const filters = useQueryFilters(['from', 'to', 'userId'] as const, { onChange: () => void list.reload() })
onMounted(() => void list.reload())
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.payments') }}</h1>
        <p class="adm-sub">{{ t('admin.pay.sub') }}</p>
      </div>
      <div class="adm-actions">
        <label class="adm-muted">{{ t('admin.range.from') }} <input v-model="filters.from" class="adm-input" type="date"></label>
        <label class="adm-muted">{{ t('admin.range.to') }} <input v-model="filters.to" class="adm-input" type="date"></label>
      </div>
    </div>
    <div v-if="totals" class="adm-stats" aria-live="polite">
      <AdminStat :label="t('admin.pay.count')" :value="num(totals.count)" :note="t('admin.pay.wholeRange')" />
      <AdminStat :label="t('admin.pay.total')" :value="money(totals.totalCents)" :note="t('admin.pay.usd')" />
      <AdminStat :label="t('admin.pay.average')" :value="totals.count ? money(Math.round(totals.totalCents / totals.count)) : '—'" :note="t('admin.pay.perPayment')" />
    </div>
    <section class="adm-card">
      <div v-if="list.items.value.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.payments') }}</caption>
          <thead><tr>
            <th scope="col">{{ t('admin.pay.date') }}</th><th scope="col">{{ t('admin.reqs.reference') }}</th><th scope="col">{{ t('admin.users.person') }}</th>
            <th scope="col">{{ t('admin.users.plan') }}</th><th scope="col" class="n">{{ t('admin.pay.amount') }}</th><th scope="col">{{ t('admin.pay.recordedBy') }}</th><th scope="col">{{ t('admin.plan.note') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in list.items.value" :key="p.id">
              <td class="nowrap" :title="utc(p.paidAt)">{{ dateOnly(p.paidAt, locale) }}</td>
              <td><b class="adm-ltr">{{ p.reference }}</b></td>
              <td>
                <NuxtLink v-if="p.user.email" :to="`/admin/users/${encodeURIComponent(p.user.id)}`" class="adm-person"><b>{{ p.user.name }}</b><small class="adm-ltr">{{ p.user.email }}</small></NuxtLink>
                <span v-else class="adm-muted">{{ t('admin.deletedPerson') }}</span>
              </td>
              <td>{{ p.plan }} · {{ t(`admin.period.${p.period}`) }}</td>
              <td class="n"><b>{{ money(p.amountCents) }}</b></td>
              <td><span class="adm-ltr">{{ p.recordedBy?.email ?? '—' }}</span></td>
              <td>{{ p.note ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" @retry="list.reload" @more="list.more"
      />
    </section>
  </div>
</template>
