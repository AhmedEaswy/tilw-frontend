<script setup lang="ts">
/**
 * Admin · analytics (feature 007, backend `GET /api/admin/analytics?days=`): product use over the last 7/30/90/365 days
 * (period in the address): recordings by length and by day, practice sessions, phone links, scripts, linked drives,
 * own AI keys, and AI use by provider × who paid. Aggregates only, no per-person data. Section users (view).
 */
import { DURATION_BUCKETS, type AdminAnalytics } from '~/services/types'
import { dateTime, num } from '~/utils/admin'
import { clockTime, decimal, percent, providerMark, providerName } from '~/utils/adminInsights'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.analytics')} · ${t('admin.title')}` })
const route = useRoute()
const router = useRouter()
const errorText = useErrorText()

const PERIODS = [7, 30, 90, 365] as const
const days = computed<number>(() => {
  const d = Number(route.query.days)
  return (PERIODS as readonly number[]).includes(d) ? d : 30
})
const setDays = (d: number) => router.replace({ query: d === 30 ? {} : { days: String(d) } })

const data = ref<AdminAnalytics | null>(null)
const error = ref<unknown>(null)
const loading = ref(false)
let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  error.value = null
  try {
    const a = await useServices().admin.analytics(days.value)
    if (mine === seq) data.value = a
  } catch (e) {
    if (mine === seq) error.value = e
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(days, load, { immediate: true })

const buckets = computed(() => DURATION_BUCKETS.map(b => ({ key: b, label: t(`admin.analytics.bucket.${b}`), value: data.value?.takes.durationBuckets[b] ?? 0 })))
const takesByDay = computed(() => (data.value?.takes.byDay ?? []).map(d => ({ label: d.date, value: d.count })))
const practiceByDay = computed(() => (data.value?.practice.byDay ?? []).map(d => ({ label: d.date, value: d.count })))
const linksByDay = computed(() => (data.value?.phoneLinks.byDay ?? []).map(d => ({ label: d.date, value: d.count })))
const byKind = computed(() => [
  { key: 'video', label: t('admin.analytics.video'), value: data.value?.takes.byKind.video ?? 0 },
  { key: 'audio', label: t('admin.analytics.audio'), value: data.value?.takes.byKind.audio ?? 0 },
])
const byVia = computed(() => (['web', 'app', 'phone'] as const).map(v => ({ key: v, label: t(`admin.analytics.via.${v}`), value: data.value?.practice.byVia[v] ?? 0 })))
const byHost = computed(() => (['web', 'app'] as const).map(v => ({ key: v, label: t(`admin.analytics.host.${v}`), value: data.value?.phoneLinks.byHostKind[v] ?? 0 })))
const drives = computed(() => Object.entries(data.value?.drives.byProvider ?? {}).map(([p, n]) => ({ key: p, label: providerName(p), value: n, provider: providerMark(p) })))
const keys = computed(() => (['anthropic', 'openai'] as const).map(p => ({ key: p, label: providerName(p), value: data.value?.ownKeys.byProvider[p] ?? 0, provider: providerMark(p) })))
const aiTotals = computed(() => (data.value?.aiUsage ?? []).reduce((n, r) => ({ calls: n.calls + r.calls, failed: n.failed + r.failed, credits: n.credits + r.credits }), { calls: 0, failed: 0, credits: 0 }))
</script>

<template>
  <div class="adm-page" data-testid="analytics">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.analytics') }}</h1>
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
    <UiSkeleton v-else-if="!data" h="420px" />

    <template v-if="data">
      <!-- The period's figures and the chart of the selected one (recordings) share one panel. -->
      <section class="adm-panel" :aria-label="t('admin.analytics.recordingsByDay')" :aria-busy="loading">
        <div class="adm-stats adm-strip">
          <AdminStat class="is-sel" :label="t('admin.analytics.recordings')" :value="num(data.takes.count)" :note="t('admin.analytics.minutes', { n: decimal(data.takes.totalMinutes) })" />
          <AdminStat :label="t('admin.analytics.practiceSessions')" :value="num(data.practice.sessions)" :note="t('admin.analytics.people', { n: num(data.practice.usersPractising) })" />
          <AdminStat :label="t('admin.analytics.phoneLinks')" :value="num(data.phoneLinks.started)" :note="t('admin.analytics.avgLength', { time: clockTime(data.phoneLinks.avgDurationS) })" />
          <AdminStat :label="t('admin.analytics.newScripts')" :value="num(data.scripts.createdInPeriod)" :note="t('admin.analytics.scriptsNow', { n: num(data.scripts.total) })" />
        </div>
        <div class="adm-chartbox">
          <div class="adm-charthead"><h3>{{ t('admin.analytics.recordingsByDay') }}</h3><span class="adm-muted">{{ t('admin.dash.utcDays') }}</span></div>
          <AdminBarChart :data="takesByDay" :caption="t('admin.analytics.recordingsByDay')" :height="120" />
        </div>
      </section>

      <section class="adm-group" data-testid="an-recordings">
        <div class="adm-ghead"><h2>{{ t('admin.analytics.recordingsTitle') }}</h2><span class="adm-gsub">{{ t('admin.analytics.recordingsNote') }}</span></div>
        <div class="adm-card adm-card-pad">
          <div class="two">
            <div class="blk">
              <h3>{{ t('admin.analytics.byLength') }}</h3>
              <AdminBreakdown :rows="buckets" :caption="t('admin.analytics.byLength')" :label-head="t('admin.analytics.length')" :value-head="t('admin.analytics.recordings')" />
            </div>
            <div class="blk">
              <h3>{{ t('admin.analytics.byKind') }}</h3>
              <AdminSplitBar :parts="byKind" :caption="t('admin.analytics.byKind')" />
            </div>
          </div>
        </div>
      </section>

      <div class="two">
        <section class="adm-group" data-testid="an-practice">
          <div class="adm-ghead"><h2>{{ t('admin.analytics.practiceTitle') }}</h2><span class="adm-gsub adm-end">{{ t('admin.dash.utcDays') }}</span></div>
          <div class="adm-panel">
            <div class="adm-chartbox">
              <AdminBarChart :data="practiceByDay" :caption="t('admin.analytics.practiceByDay')" :height="110" />
            </div>
            <dl class="adm-kv">
              <div><dt>{{ t('admin.analytics.avgDuration') }}</dt><dd class="adm-ltr">{{ clockTime(data.practice.avgDurationS) }}</dd></div>
              <div><dt>{{ t('admin.analytics.recordedShare') }}</dt><dd class="adm-ltr" data-testid="recorded-share">{{ percent(data.practice.recordedShare) }}</dd></div>
              <div><dt>{{ t('admin.analytics.usersPractising') }}</dt><dd class="adm-ltr">{{ num(data.practice.usersPractising) }}</dd></div>
            </dl>
            <div class="adm-chartbox">
              <h3>{{ t('admin.analytics.byVia') }}</h3>
              <AdminSplitBar :parts="byVia" :caption="t('admin.analytics.byVia')" />
            </div>
          </div>
        </section>

        <section class="adm-group" data-testid="an-links">
          <div class="adm-ghead"><h2>{{ t('admin.analytics.linksTitle') }}</h2><span class="adm-gsub adm-end">{{ t('admin.dash.utcDays') }}</span></div>
          <div class="adm-panel">
            <div class="adm-chartbox">
              <AdminBarChart :data="linksByDay" :caption="t('admin.analytics.linksByDay')" :height="110" />
            </div>
            <dl class="adm-kv">
              <div><dt>{{ t('admin.analytics.linksStarted') }}</dt><dd class="adm-ltr">{{ num(data.phoneLinks.started) }}</dd></div>
              <div><dt>{{ t('admin.analytics.avgLinkDuration') }}</dt><dd class="adm-ltr">{{ clockTime(data.phoneLinks.avgDurationS) }}</dd></div>
            </dl>
            <div class="adm-chartbox">
              <h3>{{ t('admin.analytics.byHost') }}</h3>
              <AdminSplitBar :parts="byHost" :caption="t('admin.analytics.byHost')" />
            </div>
          </div>
        </section>
      </div>

      <div class="three">
        <section class="adm-group" data-testid="an-scripts">
          <div class="adm-ghead"><h2>{{ t('admin.analytics.scriptsTitle') }}</h2></div>
          <div class="adm-panel">
            <dl class="adm-kv">
              <div><dt>{{ t('admin.analytics.scriptsTotal') }}</dt><dd class="adm-ltr">{{ num(data.scripts.total) }}</dd></div>
              <div><dt>{{ t('admin.analytics.scriptsActive') }}</dt><dd class="adm-ltr">{{ num(data.scripts.active) }}</dd></div>
              <div><dt>{{ t('admin.analytics.scriptsArchived') }}</dt><dd class="adm-ltr">{{ num(data.scripts.archived) }}</dd></div>
              <div><dt>{{ t('admin.analytics.scriptsCreated') }}</dt><dd class="adm-ltr">{{ num(data.scripts.createdInPeriod) }}</dd></div>
            </dl>
          </div>
        </section>
        <section class="adm-group" data-testid="an-drives">
          <div class="adm-ghead"><h2>{{ t('admin.analytics.drivesTitle') }}</h2><span class="adm-gsub adm-end">{{ t('admin.analytics.now') }}</span></div>
          <div class="adm-card adm-card-pad">
            <AdminBreakdown :rows="drives" :caption="t('admin.analytics.drivesTitle')" :label-head="t('admin.analytics.provider')" :value-head="t('admin.analytics.linked')" />
          </div>
        </section>
        <section class="adm-group" data-testid="an-keys">
          <div class="adm-ghead"><h2>{{ t('admin.analytics.keysTitle') }}</h2><span class="adm-gsub adm-end">{{ t('admin.analytics.now') }}</span></div>
          <div class="adm-card adm-card-pad">
            <AdminBreakdown :rows="keys" :caption="t('admin.analytics.keysTitle')" :label-head="t('admin.analytics.provider')" :value-head="t('admin.analytics.people_col')" />
          </div>
        </section>
      </div>

      <section class="adm-group" data-testid="an-ai" aria-labelledby="an-ai-h">
        <div class="adm-ghead"><h2 id="an-ai-h">{{ t('admin.analytics.aiTitle') }}</h2></div>
        <div class="adm-panel">
          <div v-if="data.aiUsage.length" class="adm-scroll">
            <table class="adm-tbl">
              <caption>{{ t('admin.analytics.aiTitle') }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ t('admin.analytics.provider') }}</th>
                  <th scope="col">{{ t('admin.analytics.paidWith') }}</th>
                  <th scope="col" class="n">{{ t('admin.analytics.calls') }}</th>
                  <th scope="col" class="n">{{ t('admin.analytics.failed') }}</th>
                  <th scope="col" class="n">{{ t('admin.analytics.units') }}</th>
                  <th scope="col" class="n">{{ t('admin.analytics.credits') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.aiUsage" :key="`${r.provider}-${r.paidWith}-${r.unit}`">
                  <td><span class="prov"><ProviderMark v-if="providerMark(r.provider)" :provider="providerMark(r.provider)!" :size="16" />{{ providerName(r.provider) }}</span></td>
                  <td><span class="adm-chip" :class="r.paidWith === 'own_key' ? 'info' : ''">{{ t(`admin.analytics.paid.${r.paidWith}`) }}</span></td>
                  <td class="n adm-ltr">{{ num(r.calls) }}</td>
                  <td class="n adm-ltr">{{ num(r.failed) }}</td>
                  <td class="n">{{ t(`admin.analytics.unit.${r.unit}`, { n: num(r.units) }) }}</td>
                  <td class="n adm-ltr">{{ r.paidWith === 'own_key' ? '—' : num(r.credits) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">{{ t('admin.analytics.total') }}</td>
                  <td class="n adm-ltr">{{ num(aiTotals.calls) }}</td>
                  <td class="n adm-ltr">{{ num(aiTotals.failed) }}</td>
                  <td />
                  <td class="n adm-ltr">{{ num(aiTotals.credits) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else class="adm-empty">{{ t('admin.analytics.noAi') }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 18px;
  align-items: start;
}
.three {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
  align-items: start;
}
.blk {
  display: grid;
  gap: 10px;
  align-content: start;
}
h3 {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 600 13px/1.4 var(--tilw-font-ar);
}
.prov {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
tfoot td {
  border-block-start: 1px solid var(--tilw-hairline);
  background: var(--tilw-band);
  font-weight: 700;
}
</style>
