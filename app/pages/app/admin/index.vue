<script setup lang="ts">
/** Admin · waitlist: everyone who left an email, with an Invite action on each row that has not been invited yet. */
import { isPortError, type WaitlistEntry } from '~/services/types'

definePageMeta({ layout: 'app', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.title')} · tilwprompter` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const query = ref('')
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = admin.waitlist ?? []
  return q ? all.filter(w => w.email.includes(q)) : all
})
const busyId = ref('')

async function invite(w: WaitlistEntry) {
  busyId.value = w.id
  try {
    await admin.invite(w.email)
    show(t('admin.toastInvited', { email: w.email }))
  } catch (e) {
    show(isPortError(e, 'conflict') ? t('admin.alreadyMember') : errorText(e), 'error')
  } finally {
    busyId.value = ''
  }
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
    </div>

    <UiSkeleton v-if="admin.waitlist === null && admin.loading" h="240px" />
    <UiEmptyState v-else-if="admin.waitlist && !admin.waitlist.length" :title="t('admin.emptyWaitlist')" icon="mail" />
    <p v-else-if="!rows.length && admin.waitlist" class="none">{{ t('admin.noMatches') }}</p>

    <div v-else-if="rows.length" class="card">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ t('admin.colEmail') }}</th>
            <th>{{ t('admin.colJoined') }}</th>
            <th>{{ t('admin.colStatus') }}</th>
            <th><span class="sr">{{ t('admin.invite') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in rows" :key="w.id">
            <td class="em" dir="ltr">{{ w.email }}</td>
            <td class="mu" :data-label="t('admin.colJoined')">{{ relativeTime(w.joinedAt, locale) }}</td>
            <td :data-label="t('admin.colStatus')">
              <span class="chip" :class="w.invited ? 'pend' : 'mut'">{{ w.invited ? t('admin.invited') : t('admin.waiting') }}</span>
            </td>
            <td class="act">
              <span v-if="w.invited" class="mu">{{ t('admin.invitationSent') }}</span>
              <UiButton v-else size="sm" :loading="busyId === w.id" @click="invite(w)">{{ t('admin.invite') }}</UiButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminFrame>
</template>

<style scoped src="~/assets/css/admin-table.css"></style>
