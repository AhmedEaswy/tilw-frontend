<script setup lang="ts">
/**
 * Admin · AI calls (feature 006 US5, Figma D8 `312:1878`): newest first, filters for status (a Failures shortcut),
 * provider, capability, person and period, with the failure reason as the service recorded it.
 */
import type { AdminAiCall, AiCapability } from '~/services/types'
import { dateTime, dayToIso, num, utc } from '~/utils/admin'
import { PROVIDER_NAMES } from '~/components/brand/ProviderMark.vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.calls')} · ${t('admin.title')}` })
const CAPS: AiCapability[] = ['format', 'transcribe', 'captions']
const STATUSES = ['pending', 'succeeded', 'failed'] as const

const list = usePagedList(cursor => useServices().admin.aiCalls({
  status: filters.status as AdminAiCall['status'] | undefined,
  provider: filters.provider,
  capability: filters.capability as AiCapability | undefined,
  userId: filters.userId,
  from: dayToIso(filters.from),
  to: dayToIso(filters.to, true),
}, cursor))
const filters = useQueryFilters(['status', 'provider', 'capability', 'userId', 'from', 'to'] as const, {
  allowed: { status: STATUSES, capability: CAPS },
  onChange: () => void list.reload(),
})
const range = rangeModel(filters, 'from', 'to')
const today = toIsoDate(new Date())
const provider = filterModel(filters, 'provider')
const capability = filterModel(filters, 'capability')
const PROVIDERS = ['anthropic', 'openai', 'minimax', 'deepseek', 'deepgram'] as const
const providerOptions = computed(() => withAll(t('admin.list.all'), PROVIDERS.map(p => ({ value: p, label: PROVIDER_NAMES[p] }))))
const capabilityOptions = computed(() => withAll(t('admin.list.all'), CAPS.map(c => ({ value: c, label: t(`admin.capability.${c}`) }))))
onMounted(() => void list.reload())
const tone = (s: string) => (s === 'failed' ? 'error' : s === 'succeeded' ? 'success' : 'warning')
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.calls') }}</h1>
        <p class="adm-sub">{{ t('admin.ai.callsSub') }}</p>
      </div>
      <div class="adm-actions">
        <span class="adm-field"><label for="f-range">{{ t('admin.range.label') }}</label><UiDatePicker id="f-range" v-model="range" mode="range" size="sm" :max="today" /></span>
      </div>
    </div>
    <div class="adm-filter">
      <div class="adm-seg" role="group" :aria-label="t('admin.users.status')">
        <button type="button" :aria-pressed="!filters.status" @click="filters.status = undefined">{{ t('admin.list.all') }}</button>
        <button type="button" :aria-pressed="filters.status === 'failed'" @click="filters.status = 'failed'">{{ t('admin.ai.failures') }}</button>
      </div>
      <span class="adm-field"><label for="f-provider">{{ t('admin.ai.provider') }}</label><UiSelect id="f-provider" v-model="provider" :options="providerOptions" size="sm" /></span>
      <span class="adm-field"><label for="f-capability">{{ t('admin.ai.capabilityLabel') }}</label><UiSelect id="f-capability" v-model="capability" :options="capabilityOptions" size="sm" /></span>
      <span v-if="filters.userId" class="adm-chip info">{{ t('admin.subs.onePerson') }} <button type="button" class="adm-link" :aria-label="t('common.close')" @click="filters.userId = undefined">×</button></span>
    </div>
    <section class="adm-card">
      <div v-if="list.items.value.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.calls') }}</caption>
          <thead><tr>
            <th scope="col">{{ t('admin.audit.when') }}</th><th scope="col">{{ t('admin.users.person') }}</th><th scope="col">{{ t('admin.ai.capabilityLabel') }}</th>
            <th scope="col">{{ t('admin.ai.provider') }}</th><th scope="col">{{ t('admin.ai.paidWith') }}</th><th scope="col" class="n">{{ t('admin.ai.units') }}</th>
            <th scope="col" class="n">{{ t('admin.ai.credits') }}</th><th scope="col">{{ t('admin.users.status') }}</th><th scope="col">{{ t('admin.ai.reason') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="c in list.items.value" :key="c.id">
              <td class="nowrap" :title="utc(c.createdAt)">{{ dateTime(c.createdAt, locale) }}</td>
              <td>
                <NuxtLink v-if="c.user.email" :to="`/admin/users/${encodeURIComponent(c.user.id)}`" class="adm-person"><b>{{ c.user.name }}</b><small class="adm-ltr">{{ c.user.email }}</small></NuxtLink>
                <span v-else class="adm-muted">{{ t('admin.deletedPerson') }}</span>
              </td>
              <td>{{ t(`admin.capability.${c.capability}`) }}</td>
              <td class="adm-ltr">{{ c.provider }}</td>
              <td>{{ t(`admin.ai.paid.${c.paidWith}`) }}</td>
              <td class="n">{{ num(c.units) }} {{ t(`admin.ai.unit.${c.unit}`) }}</td>
              <td class="n">{{ num(c.credits) }}</td>
              <td><span class="adm-chip" :class="tone(c.status)">{{ t(`admin.ai.status.${c.status}`) }}</span></td>
              <td><span v-if="c.failure" class="adm-mono err">{{ c.failure }}</span><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.ai.noCalls')" @retry="list.reload" @more="list.more"
      />
    </section>
  </div>
</template>

<style scoped>
.err {
  color: var(--tilw-status-error);
  font-size: 12px;
}
</style>
