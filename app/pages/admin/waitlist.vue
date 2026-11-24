<script setup lang="ts">
/**
 * Admin · waitlist (feature 006 US3, Figma D5 `310:974`): the release-1 page inside the console, with search, the
 * invited filter (in the address), a "has an account" mark, and Remove (with confirmation).
 */
import { isPortError, type WaitlistEntry } from '~/services/types'
import { dateOnly, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.waitlist')} · ${t('admin.title')}` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const filters = useQueryFilters(['q', 'invited'] as const, { allowed: { invited: ['true', 'false'] }, debounce: ['q'], onChange: () => void reload() })
const reload = () => admin.load({ q: filters.q?.trim() || undefined, invited: filters.invited === undefined ? undefined : filters.invited === 'true' })
onMounted(reload)
const rows = computed(() => admin.waitlist ?? [])
const inviting = ref(false)

const busy = ref('')
async function invite(w: WaitlistEntry) {
  busy.value = w.id
  try {
    await admin.invite(w.email)
    show(t('admin.toastInvited', { email: w.email }), 'success')
  } catch (e) {
    show(isPortError(e, 'conflict') ? t('admin.alreadyMember') : errorText(e), 'error')
  } finally {
    busy.value = ''
  }
}
const removing = ref<WaitlistEntry | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: v => !v && (removing.value = null) })
const removeError = ref('')
async function remove() {
  const w = removing.value
  if (!w) return
  removeError.value = ''
  try {
    await admin.removeWaitlist(w.id)
    show(t('admin.waitlist.removed', { email: w.email }), 'success')
    removing.value = null
  } catch (e) {
    removeError.value = errorText(e)
  }
}
const state = (w: WaitlistEntry) => (w.hasAccount ? 'account' : w.invited ? 'invited' : 'waiting')
const TONE = { account: 'success', invited: 'info', waiting: '' } as const
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.waitlist') }}</h1>
        <p class="adm-sub">{{ t('admin.waitlist.sub', { n: rows.length, waiting: admin.waitingCount }) }}</p>
      </div>
      <div class="adm-actions"><button type="button" class="adm-btn primary" @click="inviting = true">{{ t('admin.inviteButton') }}</button></div>
    </div>

    <section class="adm-card">
      <div class="adm-toolbar">
        <input v-model="filters.q" type="search" class="adm-input" dir="auto" :placeholder="t('admin.search')" :aria-label="t('admin.search')">
        <div class="adm-seg" role="group" :aria-label="t('admin.waitlist.filter')">
          <button type="button" :aria-pressed="filters.invited === undefined" @click="filters.invited = undefined">{{ t('admin.list.all') }}</button>
          <button type="button" :aria-pressed="filters.invited === 'false'" @click="filters.invited = 'false'">{{ t('admin.waitlist.notInvited') }}</button>
          <button type="button" :aria-pressed="filters.invited === 'true'" @click="filters.invited = 'true'">{{ t('admin.waitlist.invited') }}</button>
        </div>
        <span class="adm-grow adm-muted">{{ t('admin.users.newest') }}</span>
      </div>
      <div v-if="rows.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.waitlist') }}</caption>
          <thead>
            <tr><th scope="col">{{ t('admin.colEmail') }}</th><th scope="col">{{ t('admin.colJoined') }}</th><th scope="col">{{ t('admin.colStatus') }}</th><th scope="col" class="act"><span class="adm-muted">{{ t('admin.list.actions') }}</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="w in rows" :key="w.id">
              <td><b class="adm-ltr">{{ w.email }}</b></td>
              <td class="nowrap" :title="utc(w.joinedAt)">{{ dateOnly(w.joinedAt, locale) }}</td>
              <td><span class="adm-chip" :class="TONE[state(w)]">{{ t(`admin.waitlist.state.${state(w)}`) }}</span></td>
              <td class="act">
                <button v-if="state(w) === 'waiting'" type="button" class="adm-btn primary" :disabled="busy === w.id" @click="invite(w)">{{ t('admin.invite') }}</button>
                <button type="button" class="adm-link danger" @click="removeError = ''; removing = w">{{ t('admin.waitlist.remove') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState :loading="admin.loading" :loaded="admin.waitlist !== null" :error="admin.error" :empty="!rows.length" :empty-text="t('admin.emptyWaitlist')" @retry="reload" />
    </section>

    <AdminConfirmDialog
      v-model:open="removeOpen"
      :title="t('admin.waitlist.removeTitle')"
      :text="removing ? t('admin.waitlist.removeText', { email: removing.email }) : ''"
      :confirm-label="t('admin.waitlist.remove')"
      tone="danger"
      :error="removeError"
      @confirm="remove"
    />
    <InviteDialog v-model:open="inviting" />
  </div>
</template>
