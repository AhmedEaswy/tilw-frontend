<script setup lang="ts">
/**
 * Admin · admins (feature 007, backend `/api/admin/admins`): every admin, the super admin first; add one from people
 * search, edit their permission matrix, remove admin access (the account stays). Every route here needs admins
 * (edit), so without it the page explains that instead of the list. The super admin's row is locked, and an admin
 * can't change their own access.
 */
import { ADMIN_SECTIONS, isPortError, type AdminLevel, type AdminList, type AdminRow } from '~/services/types'
import { dateTime, utc } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.admins')} · ${t('admin.title')}` })
const auth = useAuthStore()
const { can } = useAdminPermissions()
const errorText = useErrorText()
const { show } = useToast()
const allowed = computed(() => can('admins', 'edit'))

const data = ref<AdminList | null>(null)
const error = ref<unknown>(null)
const loading = ref(false)
async function load() {
  if (!allowed.value) return
  loading.value = true
  error.value = null
  try {
    data.value = await useServices().admin.admins()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
onMounted(load)

const sections = computed(() => (data.value?.sections.length ? data.value.sections : [...ADMIN_SECTIONS]))
const isSelf = (a: AdminRow) => a.id === auth.user?.id
const locked = (a: AdminRow) => a.adminRole === 'super' || isSelf(a)
const lockReason = (a: AdminRow) => (a.adminRole === 'super' ? t('admin.admins.lockedSuper') : isSelf(a) ? t('admin.admins.lockedSelf') : undefined)
const tone = (l: AdminLevel) => (l === 'edit' ? 'success' : l === 'view' ? 'info' : '')
const granted = (a: AdminRow) => sections.value.filter(s => a.adminPermissions[s] !== 'none')

const dialogOpen = ref(false)
const editing = ref<AdminRow | null>(null)
function add() {
  editing.value = null
  dialogOpen.value = true
}
function edit(a: AdminRow) {
  editing.value = a
  dialogOpen.value = true
}
function saved(row: AdminRow) {
  show(editing.value ? t('admin.admins.toastSaved', { name: row.name }) : t('admin.admins.toastAdded', { name: row.name }), 'success')
  void load()
}

const removing = ref<AdminRow | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: v => !v && (removing.value = null) })
const removeError = ref('')
const removeBusy = ref(false)
function askRemove(a: AdminRow) {
  removeError.value = ''
  removing.value = a
}
async function remove() {
  const a = removing.value
  if (!a) return
  removeBusy.value = true
  try {
    await useServices().admin.removeAdmin(a.id)
    show(t('admin.admins.toastRemoved', { name: a.name }), 'success')
    removing.value = null
    void load()
  } catch (e) {
    removeError.value = isPortError(e, 'super_admin_locked') ? t('admin.admins.err.locked')
      : isPortError(e, 'conflict') ? t('admin.admins.err.cannotRemove')
        : errorText(e)
  } finally {
    removeBusy.value = false
  }
}
</script>

<template>
  <div class="adm-page" data-testid="admins">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.admins') }}</h1>
        <p class="adm-sub">{{ t('admin.admins.sub') }}</p>
      </div>
      <div v-if="allowed" class="adm-actions">
        <button type="button" class="adm-btn primary" data-testid="add-admin" @click="add">{{ t('admin.admins.addButton') }}</button>
      </div>
    </div>

    <p v-if="!allowed" class="adm-note" data-testid="admins-forbidden">{{ t('admin.admins.needEdit') }}</p>

    <section v-else class="adm-card">
      <div v-if="data?.admins.length" class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.nav.admins') }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('admin.admins.admin') }}</th>
              <th scope="col">{{ t('admin.admins.role') }}</th>
              <th scope="col">{{ t('admin.admins.permissions') }}</th>
              <th scope="col">{{ t('admin.admins.lastActive') }}</th>
              <th scope="col" class="act"><span class="sr">{{ t('admin.list.actions') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in data.admins" :key="a.id" :data-testid="`admin-row-${a.id}`">
              <td>
                <span class="adm-person">
                  <NuxtLink v-if="can('users')" :to="`/admin/users/${encodeURIComponent(a.id)}`"><b>{{ a.name }}</b></NuxtLink>
                  <b v-else>{{ a.name }}</b>
                  <small class="adm-ltr">{{ a.email }}</small>
                </span>
              </td>
              <td>
                <span class="chips">
                  <span class="adm-chip" :class="a.adminRole === 'super' ? 'warning' : 'info'">{{ a.adminRole === 'super' ? t('admin.admins.super') : t('admin.admins.roleAdmin') }}</span>
                  <span v-if="a.adminRole === 'super'" class="adm-chip" data-testid="locked">{{ t('admin.admins.locked') }}</span>
                  <span v-if="isSelf(a)" class="adm-chip">{{ t('admin.admins.you') }}</span>
                  <span v-if="a.status !== 'active'" class="adm-chip error">{{ t(`admin.status.${a.status}`) }}</span>
                </span>
              </td>
              <td>
                <span v-if="a.adminRole === 'super'" class="adm-muted">{{ t('admin.admins.everything') }}</span>
                <span v-else-if="!granted(a).length" class="adm-muted">{{ t('admin.admins.nothing') }}</span>
                <span v-else class="chips" data-testid="perm-summary">
                  <span v-for="s in granted(a)" :key="s" class="adm-chip" :class="tone(a.adminPermissions[s])">{{ t(`admin.admins.sections.${s}`) }} · {{ t(`admin.admins.level.${a.adminPermissions[s]}`) }}</span>
                </span>
              </td>
              <td class="nowrap" :title="utc(a.lastActiveAt)">{{ a.lastActiveAt ? dateTime(a.lastActiveAt, locale) : '—' }}</td>
              <td class="act">
                <span class="row-actions">
                  <button type="button" class="adm-btn" :disabled="locked(a)" :title="lockReason(a)" :aria-label="`${t('admin.admins.edit')} · ${a.name}`" data-testid="edit-admin" @click="edit(a)">{{ t('admin.admins.edit') }}</button>
                  <button type="button" class="adm-btn danger" :disabled="locked(a)" :title="lockReason(a)" :aria-label="`${t('admin.admins.remove')} · ${a.name}`" data-testid="remove-admin" @click="askRemove(a)">{{ t('admin.admins.remove') }}</button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminListState :loading="loading" :loaded="!!data" :error="error" :empty="!data?.admins.length" @retry="load" />
      <p v-if="data" class="adm-foot">{{ t('admin.admins.lockNote') }}</p>
    </section>

    <AdminPermissionsDialog v-model:open="dialogOpen" :admin="editing" @saved="saved" />
    <AdminConfirmDialog
      v-model:open="removeOpen"
      :title="removing ? t('admin.admins.removeTitle', { name: removing.name }) : ''"
      :text="removing ? t('admin.admins.removeText', { name: removing.name, email: removing.email }) : ''"
      :confirm-label="t('admin.admins.remove')"
      tone="danger"
      :busy="removeBusy"
      :error="removeError"
      @confirm="remove"
    />
  </div>
</template>

<style scoped>
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.row-actions {
  display: inline-flex;
  gap: 6px;
}
.foot {
  font-size: 12.5px;
}
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
