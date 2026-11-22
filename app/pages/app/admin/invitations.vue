<script setup lang="ts">
/**
 * Admin · invitations: one list, a status on each row, a filter to narrow it. Pending rows can be resent or withdrawn;
 * expired and withdrawn rows can be invited again. A withdrawal asks first, since it kills the link.
 */
import { isPortError, type Invitation, type InvitationState } from '~/services/types'

definePageMeta({ layout: 'app', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.tabInvitations')} · ${t('admin.title')} · tilwprompter` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const query = ref('')
const status = ref<'all' | InvitationState>('all')
const STATES: InvitationState[] = ['pending', 'expired', 'withdrawn', 'used']
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (admin.invitations ?? []).filter(i => (status.value === 'all' || i.state === status.value) && (!q || i.email.includes(q)))
})
const CHIP: Record<InvitationState, string> = { pending: 'pend', used: 'ok', expired: 'err', withdrawn: 'mut' }

const busyId = ref('')
async function run(i: Invitation, fn: () => Promise<unknown>, done: string) {
  busyId.value = i.id
  try {
    await fn()
    show(t(done, { email: i.email }))
  } catch (e) {
    show(isPortError(e, 'conflict') ? t('admin.alreadyMember') : errorText(e), 'error')
  } finally {
    busyId.value = ''
  }
}
const resend = (i: Invitation) => run(i, () => admin.resend(i.id), 'admin.toastResent')
const inviteAgain = (i: Invitation) => run(i, () => admin.invite(i.email), 'admin.toastInvited')

const confirming = ref<Invitation | null>(null)
const confirmOpen = computed({
  get: () => !!confirming.value,
  set: (v) => {
    if (!v) confirming.value = null
  },
})
async function withdraw() {
  const i = confirming.value
  if (!i) return
  await run(i, () => admin.withdraw(i.id), 'admin.toastWithdrawn')
  confirming.value = null
}
</script>

<template>
  <AdminFrame>
    <UiBanner v-if="admin.error" tone="error">
      {{ t('admin.loadFailed') }}
      <template #action><UiButton size="sm" tone="secondary" @click="admin.load()">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <div class="tools">
      <input v-model="query" type="search" dir="auto" class="search" :placeholder="t('admin.search')" :aria-label="t('admin.search')">
      <label class="sel">
        <span class="sr">{{ t('admin.filterLabel') }}</span>
        <select v-model="status">
          <option value="all">{{ t('admin.filterLabel') }}: {{ t('admin.filterAll') }}</option>
          <option v-for="s in STATES" :key="s" :value="s">{{ t('admin.filterLabel') }}: {{ t(`admin.state.${s}`) }}</option>
        </select>
      </label>
    </div>

    <UiSkeleton v-if="admin.invitations === null && admin.loading" h="240px" />
    <UiEmptyState v-else-if="admin.invitations && !admin.invitations.length" :title="t('admin.emptyInvitations')" icon="mail" />
    <p v-else-if="!rows.length && admin.invitations" class="none">{{ t('admin.noMatches') }}</p>

    <div v-else-if="rows.length" class="card">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ t('admin.colEmail') }}</th>
            <th>{{ t('admin.colStatus') }}</th>
            <th>{{ t('admin.colDate') }}</th>
            <th><span class="sr">{{ t('admin.resend') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in rows" :key="i.id">
            <td class="em" dir="ltr">{{ i.email }}</td>
            <td :data-label="t('admin.colStatus')"><span class="chip" :class="CHIP[i.state]">{{ t(`admin.state.${i.state}`) }}</span></td>
            <td class="mu" :data-label="t('admin.colDate')">{{ relativeTime(i.usedAt ?? i.createdAt, locale) }}</td>
            <td class="act">
              <template v-if="i.state === 'pending'">
                <UiButton size="sm" tone="secondary" :loading="busyId === i.id" @click="resend(i)">{{ t('admin.resend') }}</UiButton>
                <UiButton size="sm" tone="ghost" class="danger" :disabled="busyId === i.id" @click="confirming = i">{{ t('admin.withdraw') }}</UiButton>
              </template>
              <UiButton v-else-if="i.state === 'expired' || i.state === 'withdrawn'" size="sm" tone="secondary" :loading="busyId === i.id" @click="inviteAgain(i)">{{ t('admin.inviteAgain') }}</UiButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiDialog v-model:open="confirmOpen" :title="t('admin.withdrawTitle')">
      <p v-if="confirming">{{ t('admin.withdrawText', { email: confirming.email }) }}</p>
      <template #actions>
        <UiButton tone="danger" @click="withdraw">{{ t('admin.withdraw') }}</UiButton>
        <UiButton tone="secondary" @click="confirming = null">{{ t('common.cancel') }}</UiButton>
      </template>
    </UiDialog>
  </AdminFrame>
</template>

<style scoped src="~/assets/css/admin-table.css"></style>
