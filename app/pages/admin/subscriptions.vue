<script setup lang="ts">
/**
 * Admin · subscriptions and upgrade requests (feature 006 US4, Figma D7 `311:1459`, `311:1800`): two tabs (in the
 * address). Subscriptions: filters by state, plan, source and person, move the end, end early with a reason.
 * Requests: pending first, search by reference or email, Mark paid (start, end, note) or Reject.
 */
import { isPortError, type AdminSubscriptionRow, type AdminUpgradeRequest, type SubscriptionState, type SubscriptionSource } from '~/services/types'
import { dateOnly, dayToIso, money, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.subscriptions')} · ${t('admin.title')}` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const STATES = ['active', 'scheduled', 'ended'] as const
const SOURCES = ['request', 'admin', 'provider'] as const
const RSTATES = ['pending', 'fulfilled', 'rejected', 'cancelled', 'expired'] as const
const filters = useQueryFilters(['tab', 'state', 'plan', 'source', 'userId', 'q'] as const, {
  allowed: { tab: ['subscriptions', 'requests'] },
  onChange: () => void (tab.value === 'requests' ? loadRequests() : subs.reload()),
})
const tab = computed(() => (filters.tab === 'requests' ? 'requests' : 'subscriptions'))
const state = filterModel(filters, 'state')
const source = filterModel(filters, 'source')
const q = textModel(filters, 'q')
const plan = computed<string | null>({ get: () => filters.plan ?? null, set: v => (filters.plan = v || undefined) })
const all = () => t('admin.list.all')
const stateOptions = computed(() => withAll(all(), STATES.map(s => ({ value: s, label: t(`admin.subState.${s}`) }))))
const rstateOptions = computed(() => withAll(all(), RSTATES.map(s => ({ value: s, label: t(`admin.reqState.${s}`) }))))
const sourceOptions = computed(() => withAll(all(), SOURCES.map(s => ({ value: s, label: t(`admin.source.${s}`) }))))
const setTab = (v: 'subscriptions' | 'requests') => {
  filters.state = undefined
  filters.tab = v === 'requests' ? 'requests' : undefined
}

// ---------- subscriptions ----------
const subs = usePagedList(cursor => useServices().admin.subscriptions({
  state: STATES.includes(filters.state as SubscriptionState) ? filters.state as SubscriptionState : undefined,
  plan: filters.plan,
  source: filters.source as SubscriptionSource | undefined,
  userId: filters.userId,
}, cursor))
const tone = (s: string) => (s === 'active' ? 'success' : s === 'scheduled' ? 'info' : '')

const editing = ref<{ row: AdminSubscriptionRow; mode: 'end' | 'move' } | null>(null)
const editOpen = computed({ get: () => !!editing.value, set: v => !v && (editing.value = null) })
const form = reactive({ endsAt: '', reason: 'refund' as 'refund' | 'cancelled' | 'other', note: '' })
const formEnds = computed<string | null>({ get: () => form.endsAt || null, set: v => (form.endsAt = v ?? '') })
const REASONS = ['refund', 'cancelled', 'other'] as const
const formReason = computed<string | null>({ get: () => form.reason, set: v => (form.reason = (v as (typeof REASONS)[number] | null) ?? 'refund') })
const reasonOptions = computed(() => REASONS.map(r => ({ value: r, label: t(`admin.endedReason.${r}`) })))
const formError = ref('')
function openEdit(row: AdminSubscriptionRow, mode: 'end' | 'move') {
  form.endsAt = row.endsAt.slice(0, 10)
  form.reason = 'refund'
  form.note = ''
  formError.value = ''
  editing.value = { row, mode }
}
const editBusy = ref(false)
async function saveEdit() {
  const e = editing.value
  if (!e || editBusy.value) return
  editBusy.value = true
  try {
    const next = e.mode === 'end'
      ? await useServices().admin.updateSubscription(e.row.id, { endedReason: form.reason, note: form.note.trim() || undefined })
      : await useServices().admin.updateSubscription(e.row.id, { endsAt: dayToIso(form.endsAt, true)!, note: form.note.trim() || undefined })
    subs.replace(x => x.id === e.row.id, { ...next, user: e.row.user })
    show(t(e.mode === 'end' ? 'admin.subs.ended' : 'admin.subs.moved'), 'success')
    editing.value = null
  } catch (err) {
    formError.value = isPortError(err, 'validation') ? t('admin.subs.invalid') : errorText(err)
  } finally {
    editBusy.value = false
  }
}

// ---------- requests ----------
const requests = ref<AdminUpgradeRequest[] | null>(null)
const reqError = ref<unknown>(null)
const reqLoading = ref(false)
async function loadRequests() {
  reqLoading.value = true
  reqError.value = null
  try {
    requests.value = await useServices().admin.requests({ q: filters.q?.trim() || undefined, state: RSTATES.includes(filters.state as never) ? filters.state as AdminUpgradeRequest['state'] : undefined })
  } catch (e) {
    reqError.value = e
  } finally {
    reqLoading.value = false
  }
}
const paying = ref<AdminUpgradeRequest | null>(null)
const payOpen = computed({ get: () => !!paying.value, set: v => !v && (paying.value = null) })
const pay = reactive({ startsAt: '', endsAt: '', note: '' })
const payStarts = computed<string | null>({ get: () => pay.startsAt || null, set: v => (pay.startsAt = v ?? '') })
const payEnds = computed<string | null>({ get: () => pay.endsAt || null, set: v => (pay.endsAt = v ?? '') })
const payError = ref('')
function openPay(r: AdminUpgradeRequest) {
  Object.assign(pay, { startsAt: '', endsAt: '', note: '' })
  payError.value = ''
  paying.value = r
}
const payBusy = ref(false)
async function fulfil() {
  const r = paying.value
  if (!r || payBusy.value) return
  payBusy.value = true
  try {
    await useServices().admin.fulfilRequest(r.id, { startsAt: dayToIso(pay.startsAt), endsAt: dayToIso(pay.endsAt, true), note: pay.note.trim() || undefined })
    show(t('admin.reqs.fulfilled', { ref: r.reference }), 'success')
    paying.value = null
    await loadRequests()
  } catch (e) {
    payError.value = isPortError(e, 'conflict') ? t('admin.reqs.notPending') : errorText(e)
  } finally {
    payBusy.value = false
  }
}
const rejecting = ref<AdminUpgradeRequest | null>(null)
const rejectOpen = computed({ get: () => !!rejecting.value, set: v => !v && (rejecting.value = null) })
const rejectError = ref('')
const rejectBusy = ref(false)
async function reject(note: string) {
  const r = rejecting.value
  if (!r || rejectBusy.value) return
  rejectBusy.value = true
  try {
    await useServices().admin.rejectRequest(r.id, note || undefined)
    show(t('admin.reqs.rejected', { ref: r.reference }), 'success')
    rejecting.value = null
    await loadRequests()
  } catch (e) {
    rejectError.value = isPortError(e, 'conflict') ? t('admin.reqs.notPending') : errorText(e)
  } finally {
    rejectBusy.value = false
  }
}
const rtone = (s: string) => (s === 'pending' ? 'warning' : s === 'fulfilled' ? 'success' : '')

onMounted(() => {
  void admin.loadPlans().catch(() => {})
  if (tab.value === 'requests') void loadRequests()
  else void subs.reload()
})
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.subscriptions') }}</h1>
        <p class="adm-sub">{{ tab === 'requests' ? t('admin.reqs.sub') : t('admin.subs.sub') }}</p>
      </div>
    </div>
    <div class="adm-seg" role="group" :aria-label="t('admin.nav.subscriptions')">
      <button type="button" :aria-pressed="tab === 'subscriptions'" @click="setTab('subscriptions')">{{ t('admin.subs.tab') }}</button>
      <button type="button" :aria-pressed="tab === 'requests'" @click="setTab('requests')">{{ t('admin.reqs.tab') }}</button>
    </div>

    <section v-if="tab === 'subscriptions'" class="adm-card">
      <div class="adm-toolbar">
        <span class="adm-field"><label for="f-state">{{ t('admin.subs.state') }}</label><UiSelect id="f-state" v-model="state" :options="stateOptions" size="sm" /></span>
        <span class="adm-field"><label for="f-plan">{{ t('admin.users.plan') }}</label><AdminPlanSelect id="f-plan" v-model="plan" :plans="admin.plans ?? []" :all-label="t('admin.list.all')" /></span>
        <span class="adm-field"><label for="f-source">{{ t('admin.detail.source') }}</label><UiSelect id="f-source" v-model="source" :options="sourceOptions" size="sm" /></span>
        <span v-if="filters.userId" class="adm-chip info">{{ t('admin.subs.onePerson') }} <button type="button" class="adm-link" :aria-label="t('common.close')" @click="filters.userId = undefined">×</button></span>
      </div>
      <div v-if="subs.items.value.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.subs.tab') }}</caption>
          <thead><tr>
            <th scope="col">{{ t('admin.users.person') }}</th><th scope="col">{{ t('admin.users.plan') }}</th><th scope="col">{{ t('admin.detail.period') }}</th>
            <th scope="col">{{ t('admin.detail.from') }}</th><th scope="col">{{ t('admin.detail.to') }}</th><th scope="col">{{ t('admin.detail.source') }}</th>
            <th scope="col">{{ t('admin.users.status') }}</th><th scope="col" class="act"><span class="adm-muted">{{ t('admin.list.actions') }}</span></th>
          </tr></thead>
          <tbody>
            <tr v-for="s in subs.items.value" :key="s.id">
              <td>
                <NuxtLink v-if="s.user.email" :to="`/admin/users/${encodeURIComponent(s.user.id)}`" class="adm-person"><b>{{ s.user.name }}</b><small class="adm-ltr">{{ s.user.email }}</small></NuxtLink>
                <span v-else class="adm-muted">{{ t('admin.deletedPerson') }}</span>
              </td>
              <td class="adm-ltr">{{ s.plan }}</td>
              <td>{{ t(`admin.period.${s.period}`) }}</td>
              <td class="nowrap" :title="utc(s.startsAt)">{{ dateOnly(s.startsAt, locale) }}</td>
              <td class="nowrap" :title="utc(s.endsAt)">{{ dateOnly(s.endsAt, locale) }}</td>
              <td>{{ t(`admin.source.${s.source}`) }}</td>
              <td><span class="adm-chip" :class="tone(s.state)">{{ t(`admin.subState.${s.state}`) }}{{ s.endedReason ? ` · ${t(`admin.endedReason.${s.endedReason}`)}` : '' }}</span></td>
              <td class="act">
                <template v-if="s.state !== 'ended'">
                  <button type="button" class="adm-link" @click="openEdit(s, 'move')">{{ t('admin.subs.move') }}</button>
                  <button type="button" class="adm-link danger" @click="openEdit(s, 'end')">{{ t('admin.subs.end') }}</button>
                </template>
                <span v-else class="adm-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState
        :loading="subs.loading.value" :loaded="subs.loaded.value" :error="subs.error.value" :empty="!subs.items.value.length"
        :done="subs.done.value" paged :count="subs.items.value.length" @retry="subs.reload" @more="subs.more"
      />
    </section>

    <section v-else class="adm-card">
      <div class="adm-toolbar">
        <UiSearchField v-model="q" size="sm" :placeholder="t('admin.reqs.search')" :label="t('admin.reqs.search')" />
        <span class="adm-field"><label for="f-rstate">{{ t('admin.subs.state') }}</label><UiSelect id="f-rstate" v-model="state" :options="rstateOptions" size="sm" /></span>
        <span class="adm-grow adm-muted">{{ t('admin.reqs.latest') }}</span>
      </div>
      <div v-if="requests?.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.reqs.tab') }}</caption>
          <thead><tr>
            <th scope="col">{{ t('admin.reqs.reference') }}</th><th scope="col">{{ t('admin.users.person') }}</th><th scope="col">{{ t('admin.users.plan') }}</th>
            <th scope="col" class="n">{{ t('admin.reqs.price') }}</th><th scope="col">{{ t('admin.reqs.sent') }}</th><th scope="col">{{ t('admin.users.status') }}</th>
            <th scope="col" class="act"><span class="adm-muted">{{ t('admin.list.actions') }}</span></th>
          </tr></thead>
          <tbody>
            <tr v-for="r in requests" :key="r.id">
              <td><b class="adm-ltr">{{ r.reference }}</b></td>
              <td><NuxtLink :to="`/admin/users/${encodeURIComponent(r.userId)}`" class="adm-person"><b>{{ r.name }}</b><small class="adm-ltr">{{ r.email }}</small></NuxtLink></td>
              <td>{{ r.plan }} · {{ t(`admin.period.${r.period}`) }}</td>
              <td class="n">{{ money(r.priceCents) }}</td>
              <td class="nowrap" :title="utc(r.createdAt)">{{ dateOnly(r.createdAt, locale) }}</td>
              <td><span class="adm-chip" :class="rtone(r.state)">{{ t(`admin.reqState.${r.state}`) }}</span></td>
              <td class="act">
                <template v-if="r.state === 'pending'">
                  <button type="button" class="adm-btn primary" @click="openPay(r)">{{ t('admin.reqs.markPaid') }}</button>
                  <button type="button" class="adm-link danger" @click="rejectError = ''; rejecting = r">{{ t('admin.reqs.reject') }}</button>
                </template>
                <span v-else class="adm-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState :loading="reqLoading" :loaded="requests !== null" :error="reqError" :empty="!requests?.length" @retry="loadRequests" />
    </section>

    <UiDialog v-model:open="editOpen" :title="editing ? t(editing.mode === 'end' ? 'admin.subs.endTitle' : 'admin.subs.moveTitle', { name: editing.row.user.name ?? '' }) : ''">
      <form v-if="editing" class="adm-form" @submit.prevent="saveEdit">
        <div v-if="editing.mode === 'move'" class="adm-label"><label for="e-ends">{{ t('admin.subs.newEnd') }}</label><UiDatePicker id="e-ends" v-model="formEnds" :clearable="false" /></div>
        <div v-else class="adm-label"><label for="e-reason">{{ t('admin.subs.reason') }}</label><UiSelect id="e-reason" v-model="formReason" :options="reasonOptions" /></div>
        <label class="adm-label">{{ t('admin.plan.note') }}<textarea v-model="form.note" class="adm-input" dir="auto" maxlength="500" /></label>
        <p v-if="formError" class="adm-note error" role="alert">{{ formError }}</p>
        <div class="adm-dialog-actions">
          <button type="button" class="adm-btn" @click="editing = null">{{ t('common.cancel') }}</button>
          <button type="submit" class="adm-btn" :class="editing.mode === 'end' ? 'danger' : 'primary'" :disabled="editBusy">{{ editing.mode === 'end' ? t('admin.subs.end') : t('common.save') }}</button>
        </div>
      </form>
    </UiDialog>

    <UiDialog v-model:open="payOpen" :title="paying ? t('admin.reqs.payTitle', { ref: paying.reference }) : ''">
      <form v-if="paying" class="adm-form" @submit.prevent="fulfil">
        <p class="adm-muted">{{ t('admin.reqs.payText', { name: paying.name, plan: paying.plan, price: money(paying.priceCents), today: money(paying.currentPriceCents) }) }}</p>
        <div class="adm-row">
          <div class="adm-label"><label for="p-starts">{{ t('admin.reqs.startsAt') }}</label><UiDatePicker id="p-starts" v-model="payStarts" aria-describedby="p-starts-h" /><span id="p-starts-h" class="adm-hint">{{ t('admin.reqs.startsHint') }}</span></div>
          <div class="adm-label"><label for="p-ends">{{ t('admin.reqs.endsAt') }}</label><UiDatePicker id="p-ends" v-model="payEnds" :min="pay.startsAt || null" aria-describedby="p-ends-h" /><span id="p-ends-h" class="adm-hint">{{ t('admin.reqs.endsHint') }}</span></div>
        </div>
        <label class="adm-label">{{ t('admin.plan.note') }}<textarea v-model="pay.note" class="adm-input" dir="auto" maxlength="500" /></label>
        <p v-if="payError" class="adm-note error" role="alert">{{ payError }}</p>
        <div class="adm-dialog-actions">
          <button type="button" class="adm-btn" @click="paying = null">{{ t('common.cancel') }}</button>
          <button type="submit" class="adm-btn primary" :disabled="payBusy">{{ t('admin.reqs.confirmPaid') }}</button>
        </div>
      </form>
    </UiDialog>

    <AdminConfirmDialog
      v-model:open="rejectOpen"
      :title="rejecting ? t('admin.reqs.rejectTitle', { ref: rejecting.reference }) : ''"
      :text="t('admin.reqs.rejectText')"
      :confirm-label="t('admin.reqs.reject')"
      tone="danger"
      :busy="rejectBusy"
      :error="rejectError"
      @confirm="reject"
    />
  </div>
</template>
