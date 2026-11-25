<script setup lang="ts">
/**
 * Admin · dashboard (feature 006 US1, Figma D1 `308:404`, EN D12 `316:2114`): figures for the last 7/30/90/365 days
 * (period in the address), a day-by-day sign-up chart, and attention items that open the matching filtered pages.
 */
import type { AdminDashboard } from '~/services/types'
import { dateTime, money, num } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.dashboard')} · ${t('admin.title')}` })
const route = useRoute()
const router = useRouter()

const PERIODS = [7, 30, 90, 365] as const
const days = computed<number>(() => {
  const d = Number(route.query.days)
  return (PERIODS as readonly number[]).includes(d) ? d : 30
})
const data = ref<AdminDashboard | null>(null)
const error = ref<unknown>(null)
const loading = ref(false)
const errorText = useErrorText()

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await useServices().admin.dashboard(days.value)
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
watch(days, load, { immediate: true })
const setDays = (d: number) => router.replace({ query: d === 30 ? {} : { days: String(d) } })

const bytes = (n: number) => formatBytes(n, locale.value)
const chart = computed(() => (data.value?.signups.byDay ?? []).map(d => ({ label: d.date, value: d.count })))
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.dashboard') }}</h1>
        <p v-if="data" class="adm-sub">{{ t('admin.dash.sub', { n: days, at: dateTime(data.generatedAt, locale) }) }}</p>
      </div>
      <div class="adm-actions">
        <div class="adm-seg" role="group" :aria-label="t('admin.dash.period')">
          <button v-for="p in PERIODS" :key="p" type="button" :aria-pressed="days === p" @click="setDays(p)">{{ t('admin.dash.days', { n: p }) }}</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="adm-note error" role="alert">
      {{ errorText(error) }}
      <button type="button" class="adm-link" @click="load">{{ t('common.retry') }}</button>
    </div>
    <UiSkeleton v-else-if="!data" h="320px" />

    <template v-if="data">
      <section v-if="data.attention.pendingRequests || data.attention.waitlistNotInvited" class="att" :aria-label="t('admin.dash.attention')">
        <b>{{ t('admin.dash.attention') }}</b>
        <NuxtLink v-if="data.attention.pendingRequests" class="adm-link" to="/admin/subscriptions?tab=requests&state=pending">{{ t('admin.dash.pendingRequests', { n: data.attention.pendingRequests }) }}</NuxtLink>
        <NuxtLink v-if="data.attention.waitlistNotInvited" class="adm-link" to="/admin/waitlist?invited=false">{{ t('admin.dash.waitlistNotInvited', { n: data.attention.waitlistNotInvited }) }}</NuxtLink>
      </section>

      <section class="adm-card adm-card-pad" :aria-label="t('admin.dash.people')">
        <h2>{{ t('admin.dash.people') }}</h2>
        <div class="adm-stats">
          <AdminStat :label="t('admin.dash.signups')" :value="num(data.signups.total)" :note="t('admin.dash.inDays', { n: days })" />
          <AdminStat :label="t('admin.dash.activeDay')" :value="num(data.active.day)" :note="t('admin.dash.last24h')" />
          <AdminStat :label="t('admin.dash.activeWeek')" :value="num(data.active.week)" :note="t('admin.dash.last7')" />
          <AdminStat :label="t('admin.dash.activeMonth')" :value="num(data.active.month)" :note="t('admin.dash.last30')" />
        </div>
        <p class="tot">
          <span>{{ t('admin.dash.total', { n: num(data.users.total) }) }}</span>
          <span>{{ t('admin.dash.admins', { n: data.users.admins }) }}</span>
          <NuxtLink class="adm-link" to="/admin/users?status=suspended">{{ t('admin.dash.suspended', { n: data.users.suspended }) }}</NuxtLink>
          <NuxtLink class="adm-link" to="/admin/users?status=deletion_scheduled">{{ t('admin.dash.deletion', { n: data.users.deletionScheduled }) }}</NuxtLink>
        </p>
      </section>

      <section class="adm-card adm-card-pad">
        <div class="adm-card-head"><h2>{{ t('admin.dash.signupsByDay') }}</h2><span class="adm-muted">{{ t('admin.dash.utcDays') }}</span></div>
        <AdminBarChart :data="chart" :caption="t('admin.dash.signupsByDay')" />
      </section>

      <div class="two">
        <section class="adm-card adm-card-pad">
          <h2>{{ t('admin.dash.revenue') }}</h2>
          <div class="adm-stats">
            <AdminStat :label="t('admin.dash.mrr')" :value="money(data.revenue.mrrCents)" :note="t('admin.dash.paying', { n: data.revenue.payingSubscriptions })" />
            <AdminStat :label="t('admin.dash.payments')" :value="num(data.revenue.payments)" :note="money(data.revenue.paymentsCents)" />
          </div>
        </section>
        <section class="adm-card adm-card-pad">
          <h2>{{ t('admin.dash.ai') }}</h2>
          <div class="adm-stats">
            <AdminStat :label="t('admin.dash.creditsUsed')" :value="num(data.ai.creditsUsed)" :note="t('admin.dash.thisMonth', { n: num(data.ai.creditsUsedThisMonth) })" />
            <AdminStat :label="t('admin.dash.calls')" :value="num(data.ai.calls)" :note="t('admin.dash.failed', { n: data.ai.failedCalls })" />
            <AdminStat :label="t('admin.dash.ownKey')" :value="num(data.ai.ownKeyCalls)" :note="t('admin.dash.noCredits')" />
          </div>
        </section>
      </div>

      <section class="adm-card adm-card-pad">
        <h2>{{ t('admin.dash.storage') }}</h2>
        <div class="adm-stats">
          <AdminStat :label="t('admin.dash.drives')" :value="num(data.storage.linkedDrives)" note="Google Drive" />
          <AdminStat :label="t('admin.dash.takes')" :value="num(data.storage.takes)" :note="bytes(data.storage.bytes)" />
          <AdminStat :label="t('admin.dash.inPeriod')" :value="`+${bytes(data.storage.bytesInPeriod)}`" :note="t('admin.dash.newTakes')" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.att {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  padding: 14px 20px;
  border: 0;
  border-radius: var(--tilw-radius-panel);
  background: var(--tilw-warning-bg);
  color: var(--tilw-warning-ink);
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.att .adm-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.tot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: var(--tilw-text-muted);
  font: 500 13px/1.4 var(--tilw-font-ar);
}
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 18px;
}
</style>
