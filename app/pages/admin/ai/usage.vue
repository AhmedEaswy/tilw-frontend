<script setup lang="ts">
/**
 * Admin · AI usage (feature 006 US5, Figma D8 `312:1564`): totals for a period and groups by provider, capability,
 * day (with a chart, every UTC day, zeros included) or person (top 100 by credits, linking to the person).
 */
import type { AiUsage, UsageGroupBy } from '~/services/types'
import { dayToIso, num } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useHead({ title: () => `${t('admin.nav.usage')} · ${t('admin.title')}` })
const GROUPS: UsageGroupBy[] = ['provider', 'capability', 'day', 'user']

const data = ref<AiUsage | null>(null)
const error = ref<unknown>(null)
const loading = ref(false)
const filters = useQueryFilters(['groupBy', 'from', 'to'] as const, { allowed: { groupBy: GROUPS }, onChange: () => void load() })
const groupBy = computed<UsageGroupBy>(() => (filters.groupBy as UsageGroupBy) ?? 'provider')
async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await useServices().admin.aiUsage({ from: dayToIso(filters.from), to: dayToIso(filters.to, true) }, groupBy.value)
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
onMounted(load)
const chart = computed(() => (groupBy.value === 'day' ? (data.value?.groups ?? []).map(g => ({ label: g.key, value: g.credits })) : []))
const keyLabel = (k: string) => (groupBy.value === 'capability' ? t(`admin.capability.${k}`) : k)
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.usage') }}</h1>
        <p class="adm-sub">{{ t('admin.ai.usageSub') }}</p>
      </div>
      <div class="adm-actions">
        <label class="adm-muted">{{ t('admin.range.from') }} <input v-model="filters.from" class="adm-input" type="date"></label>
        <label class="adm-muted">{{ t('admin.range.to') }} <input v-model="filters.to" class="adm-input" type="date"></label>
      </div>
    </div>
    <AdminListState :loading="loading" :loaded="!!data" :error="error" :empty="false" @retry="load" />

    <template v-if="data">
      <div class="adm-stats">
        <AdminStat :label="t('admin.ai.calls')" :value="num(data.totals.calls)" :note="t('admin.ai.callsNote', { ok: num(data.totals.succeeded), failed: num(data.totals.failed), pending: num(data.totals.pending) })" />
        <AdminStat :label="t('admin.ai.credits')" :value="num(data.totals.credits)" :note="t('admin.ai.creditsNote')" />
        <AdminStat :label="t('admin.ai.words')" :value="num(data.totals.words)" :note="t('admin.capability.format')" />
        <AdminStat :label="t('admin.ai.seconds')" :value="num(data.totals.seconds)" :note="t('admin.ai.secondsNote')" />
        <AdminStat :label="t('admin.dash.ownKey')" :value="num(data.totals.ownKeyCalls)" :note="t('admin.dash.noCredits')" />
      </div>

      <section class="adm-card">
        <div class="adm-toolbar">
          <div class="adm-seg" role="group" :aria-label="t('admin.ai.groupBy')">
            <button v-for="g in GROUPS" :key="g" type="button" :aria-pressed="groupBy === g" @click="filters.groupBy = g === 'provider' ? undefined : g">{{ t(`admin.ai.by.${g}`) }}</button>
          </div>
          <span class="adm-grow adm-muted">{{ t('admin.dash.utcDays') }}</span>
        </div>
        <div v-if="groupBy === 'day'" class="adm-card-pad">
          <AdminBarChart :data="chart" :caption="t('admin.ai.creditsByDay')" :height="120" />
        </div>
        <div class="adm-scroll">
          <table class="adm-tbl">
            <caption>{{ t(`admin.ai.by.${groupBy}`) }}</caption>
            <thead><tr>
              <th scope="col">{{ t(`admin.ai.col.${groupBy}`) }}</th>
              <th scope="col" class="n">{{ t('admin.ai.calls') }}</th><th scope="col" class="n">{{ t('admin.ai.ok') }}</th><th scope="col" class="n">{{ t('admin.ai.failed') }}</th>
              <th scope="col" class="n">{{ t('admin.ai.credits') }}</th><th scope="col" class="n">{{ t('admin.ai.words') }}</th><th scope="col" class="n">{{ t('admin.ai.seconds') }}</th><th scope="col" class="n">{{ t('admin.dash.ownKey') }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="g in data.groups" :key="g.key">
                <td>
                  <NuxtLink v-if="groupBy === 'user' && g.user?.email" :to="`/admin/users/${encodeURIComponent(g.key)}`" class="adm-person"><b>{{ g.user.name }}</b><small class="adm-ltr">{{ g.user.email }}</small></NuxtLink>
                  <span v-else-if="groupBy === 'user'" class="adm-muted">{{ t('admin.deletedPerson') }}</span>
                  <b v-else class="adm-ltr">{{ keyLabel(g.key) }}</b>
                </td>
                <td class="n">{{ num(g.calls) }}</td><td class="n">{{ num(g.succeeded) }}</td><td class="n">{{ num(g.failed) }}</td>
                <td class="n"><b>{{ num(g.credits) }}</b></td><td class="n">{{ num(g.words) }}</td><td class="n">{{ num(g.seconds) }}</td><td class="n">{{ num(g.ownKeyCalls) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!data.groups.length" class="adm-empty">{{ t('admin.ai.noCalls') }}</p>
      </section>
    </template>
  </div>
</template>
