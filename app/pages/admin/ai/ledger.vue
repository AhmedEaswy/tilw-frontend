<script setup lang="ts">
/**
 * Admin · credit ledger (feature 006 US5, Figma D8 `312:2183`): every credit entry across everyone, newest first,
 * filtered by person, kind and period, with the admin who made each grant or correction. "Grant credits" finds a
 * person by email and opens the same form as the user detail.
 */
import type { AdminUserRow, CreditKind } from '~/services/types'
import { dateTime, dayToIso, num, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.ledger')} · ${t('admin.title')}` })
const KINDS: CreditKind[] = ['monthly', 'plan_change', 'grant', 'charge', 'refund', 'correction', 'own_key', 'overrun']

const list = usePagedList(cursor => useServices().admin.ledger({
  userId: filters.userId,
  kind: filters.kind as CreditKind | undefined,
  from: dayToIso(filters.from),
  to: dayToIso(filters.to, true),
}, cursor))
const filters = useQueryFilters(['userId', 'kind', 'from', 'to'] as const, { allowed: { kind: KINDS }, onChange: () => void list.reload() })
onMounted(() => void list.reload())

const who = ref<AdminUserRow | null>(null)
watch(who, w => (filters.userId = w?.id))
const pickOpen = ref(false)
const grantee = ref<AdminUserRow | null>(null)
const grantOpen = ref(false)
function startGrant() {
  grantee.value = null
  pickOpen.value = true
}
function chosen() {
  if (!grantee.value) return
  pickOpen.value = false
  grantOpen.value = true
}
const tone = (k: CreditKind) => (k === 'grant' ? 'info' : k === 'refund' ? 'success' : k === 'correction' ? 'warning' : k === 'overrun' ? 'error' : '')
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.ledger') }}</h1>
        <p class="adm-sub">{{ t('admin.ledger.sub') }}</p>
      </div>
      <div class="adm-actions"><button type="button" class="adm-btn primary" @click="startGrant">{{ t('admin.detail.a.credits') }}</button></div>
    </div>
    <section class="adm-card">
      <div class="adm-toolbar">
        <div class="who"><PersonPicker v-model="who" :label="t('admin.ledger.person')" /></div>
        <label class="adm-muted">{{ t('admin.ledger.kind') }}
          <select v-model="filters.kind" class="adm-select"><option :value="undefined">{{ t('admin.list.all') }}</option><option v-for="k in KINDS" :key="k" :value="k">{{ t(`admin.kind.${k}`) }}</option></select>
        </label>
        <label class="adm-muted">{{ t('admin.range.from') }} <input v-model="filters.from" class="adm-input" type="date"></label>
        <label class="adm-muted">{{ t('admin.range.to') }} <input v-model="filters.to" class="adm-input" type="date"></label>
        <span v-if="filters.userId && !who" class="adm-chip info">{{ t('admin.subs.onePerson') }} <button type="button" class="adm-link" :aria-label="t('common.close')" @click="filters.userId = undefined">×</button></span>
      </div>
      <div v-if="list.items.value.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.ledger') }}</caption>
          <thead><tr>
            <th scope="col">{{ t('admin.audit.when') }}</th><th scope="col">{{ t('admin.users.person') }}</th><th scope="col">{{ t('admin.ledger.kind') }}</th>
            <th scope="col" class="n">{{ t('admin.ledger.amount') }}</th><th scope="col">{{ t('admin.ledger.by') }}</th><th scope="col">{{ t('admin.ledger.reason') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in list.items.value" :key="e.id">
              <td class="nowrap" :title="utc(e.createdAt)">{{ dateTime(e.createdAt, locale) }}</td>
              <td>
                <NuxtLink v-if="e.user.email" :to="`/admin/users/${encodeURIComponent(e.user.id)}`" class="adm-person"><b>{{ e.user.name }}</b><small class="adm-ltr">{{ e.user.email }}</small></NuxtLink>
                <span v-else class="adm-muted">{{ t('admin.deletedPerson') }}</span>
              </td>
              <td><span class="adm-chip" :class="tone(e.kind)">{{ t(`admin.kind.${e.kind}`) }}</span></td>
              <td class="n"><b :class="{ plus: e.amount > 0 }">{{ e.amount > 0 ? '+' : '' }}{{ num(e.amount) }}</b></td>
              <td><span class="adm-ltr">{{ e.createdBy?.email ?? '—' }}</span></td>
              <td>{{ e.reason ?? (e.capability ? t(`admin.capability.${e.capability}`) : '—') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" @retry="list.reload" @more="list.more"
      />
    </section>

    <UiDialog v-model:open="pickOpen" :title="t('admin.detail.a.credits')">
      <form class="adm-form" @submit.prevent="chosen">
        <PersonPicker v-model="grantee" :label="t('admin.ledger.person')" />
        <div class="adm-dialog-actions">
          <button type="button" class="adm-btn" @click="pickOpen = false">{{ t('common.cancel') }}</button>
          <button type="submit" class="adm-btn primary" :disabled="!grantee">{{ t('admin.ledger.next') }}</button>
        </div>
      </form>
    </UiDialog>
    <CreditsDialog v-if="grantee" v-model:open="grantOpen" :user-id="grantee.id" :name="grantee.name" @done="list.reload" />
  </div>
</template>

<style scoped>
.who {
  inline-size: min(280px, 100%);
}
.who :deep(.adm-label) {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tilw-text-muted);
  font-weight: 500;
}
.plus {
  color: var(--tilw-status-success);
}
</style>
