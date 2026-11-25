<script setup lang="ts">
/**
 * Admin · invitations (feature 006 US3, Figma D5 `310:1219`): the release-1 page inside the console. Pending rows can
 * be resent or withdrawn (withdrawing asks first, since it kills the link); expired and withdrawn ones invited again.
 */
import { isPortError, type Invitation, type InvitationState } from '~/services/types'
import { dateOnly, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.invitations')} · ${t('admin.title')}` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()
onMounted(() => admin.load())

const query = ref('')
const status = ref<'all' | InvitationState>('all')
const statusModel = computed<string | null>({ get: () => status.value, set: v => (status.value = (v || 'all') as 'all' | InvitationState) })
const statusOptions = computed(() => [{ value: 'all', label: t('admin.filterAll') }, ...STATES.map(s => ({ value: s, label: t(`admin.state.${s}`) }))])
const STATES: InvitationState[] = ['pending', 'expired', 'withdrawn', 'used']
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (admin.invitations ?? []).filter(i => (status.value === 'all' || i.state === status.value) && (!q || i.email.includes(q)))
})
const TONE: Record<InvitationState, string> = { pending: 'warning', used: 'success', expired: '', withdrawn: '' }
const inviting = ref(false)

const busy = ref('')
async function run(i: Invitation, fn: () => Promise<unknown>, done: string) {
  busy.value = i.id
  try {
    await fn()
    show(t(done, { email: i.email }), 'success')
  } catch (e) {
    show(isPortError(e, 'conflict') ? t('admin.alreadyMember') : errorText(e), 'error')
  } finally {
    busy.value = ''
  }
}
const confirming = ref<Invitation | null>(null)
const confirmOpen = computed({ get: () => !!confirming.value, set: v => !v && (confirming.value = null) })
async function withdraw() {
  const i = confirming.value
  if (!i) return
  await run(i, () => admin.withdraw(i.id), 'admin.toastWithdrawn')
  confirming.value = null
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.invitations') }}</h1>
        <p class="adm-sub">{{ t('admin.invitations.sub', { n: admin.pendingCount }) }}</p>
      </div>
      <div class="adm-actions"><button type="button" class="adm-btn primary" @click="inviting = true">{{ t('admin.inviteButton') }}</button></div>
    </div>

    <section class="adm-card">
      <div class="adm-toolbar">
        <UiSearchField v-model="query" kind="email" size="sm" :debounce="0" :placeholder="t('admin.search')" :label="t('admin.search')" />
        <span class="adm-field"><label for="f-state">{{ t('admin.filterLabel') }}</label><UiSelect id="f-state" v-model="statusModel" :options="statusOptions" size="sm" /></span>
      </div>
      <div v-if="rows.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.invitations') }}</caption>
          <thead>
            <tr><th scope="col">{{ t('admin.colEmail') }}</th><th scope="col">{{ t('admin.colStatus') }}</th><th scope="col">{{ t('admin.invitations.sent') }}</th><th scope="col">{{ t('admin.invitations.expires') }}</th><th scope="col" class="act"><span class="adm-muted">{{ t('admin.list.actions') }}</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="i in rows" :key="i.id">
              <td><b class="adm-ltr">{{ i.email }}</b></td>
              <td><span class="adm-chip" :class="TONE[i.state]">{{ t(`admin.state.${i.state}`) }}</span></td>
              <td class="nowrap" :title="utc(i.createdAt)">{{ dateOnly(i.createdAt, locale) }}</td>
              <td class="nowrap" :title="utc(i.expiresAt)">{{ i.state === 'pending' ? dateOnly(i.expiresAt, locale) : '—' }}</td>
              <td class="act">
                <template v-if="i.state === 'pending'">
                  <button type="button" class="adm-link" :disabled="busy === i.id" @click="run(i, () => admin.resend(i.id), 'admin.toastResent')">{{ t('admin.resend') }}</button>
                  <button type="button" class="adm-link danger" :disabled="busy === i.id" @click="confirming = i">{{ t('admin.withdraw') }}</button>
                </template>
                <button v-else-if="i.state === 'expired' || i.state === 'withdrawn'" type="button" class="adm-link" :disabled="busy === i.id" @click="run(i, () => admin.invite(i.email), 'admin.toastInvited')">{{ t('admin.inviteAgain') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState :loading="admin.loading" :loaded="admin.invitations !== null" :error="admin.error" :empty="!rows.length" :empty-text="admin.invitations?.length ? t('admin.noMatches') : t('admin.emptyInvitations')" @retry="admin.load()" />
    </section>

    <AdminConfirmDialog
      v-model:open="confirmOpen"
      :title="t('admin.withdrawTitle')"
      :text="confirming ? t('admin.withdrawText', { email: confirming.email }) : ''"
      :confirm-label="t('admin.withdraw')"
      tone="danger"
      @confirm="withdraw"
    />
    <InviteDialog v-model:open="inviting" />
  </div>
</template>
