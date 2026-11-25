<script setup lang="ts">
/**
 * Feature 007: add an admin (pick a person, then their permissions) or edit an admin's permissions. The matrix replaces
 * the whole map (sections left out are none). People search needs users (view); without it the email is typed.
 */
import { ADMIN_SECTIONS, isPortError, type AdminPermissions, type AdminRow, type AdminUserRow } from '~/services/types'
import type { UiOption } from '~/utils/uiControls'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ admin?: AdminRow | null }>()
const emit = defineEmits<{ saved: [row: AdminRow] }>()
const { t } = useI18n()
const { can } = useAdminPermissions()
const errorText = useErrorText()

const NONE = Object.fromEntries(ADMIN_SECTIONS.map(s => [s, 'none'])) as AdminPermissions
const STARTER: AdminPermissions = { ...NONE, users: 'view', audit: 'view' }
const perms = ref<AdminPermissions>({ ...STARTER })
const person = ref<string | null>(null)
const picked = ref<AdminUserRow | null>(null)
const email = ref('')
const error = ref('')
const busy = ref(false)
const editing = computed(() => !!props.admin)
const search = computed(() => can('users'))

watch(open, (v) => {
  if (!v) return
  perms.value = props.admin ? { ...props.admin.adminPermissions } : { ...STARTER }
  person.value = null
  picked.value = null
  email.value = ''
  error.value = ''
})

async function people(q: string): Promise<UiOption<string>[]> {
  const page = await useServices().admin.users({ q }, null, 8)
  return page.items.map(r => ({ value: r.id, label: r.name, hint: r.email, data: r, disabled: r.isAdmin || r.status !== 'active' }))
}
function onPick(o: UiOption<string>) {
  picked.value = (o.data as AdminUserRow) ?? null
}

async function submit() {
  error.value = ''
  const api = useServices().admin
  busy.value = true
  try {
    let row: AdminRow
    if (props.admin) {
      row = await api.updateAdmin(props.admin.id, perms.value)
    } else if (search.value) {
      if (!person.value) {
        error.value = t('admin.admins.pickPerson')
        return
      }
      row = await api.addAdmin({ userId: person.value, permissions: perms.value })
    } else {
      const e = normalizeEmail(email.value)
      if (!isEmail(e)) {
        error.value = t('admin.invalidEmail')
        return
      }
      row = await api.addAdmin({ email: e, permissions: perms.value })
    }
    emit('saved', row)
    open.value = false
  } catch (e) {
    error.value = isPortError(e, 'conflict') ? t(editing.value ? 'admin.admins.err.self' : 'admin.admins.err.cannotAdd')
      : isPortError(e, 'super_admin_locked') ? t('admin.admins.err.locked')
        : isPortError(e, 'validation') ? (e.fields?.email || e.fields?.userId ? t('admin.admins.err.noAccount') : t('admin.admins.err.invalid'))
          : errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="admin ? t('admin.admins.editTitle', { name: admin.name }) : t('admin.admins.addTitle')">
    <form id="admin-perms" class="adm-form" novalidate @submit.prevent="submit">
      <template v-if="!admin">
        <div v-if="search" class="adm-label">
          <span id="admin-perms-person">{{ t('admin.admins.person') }}</span>
          <UiAutocomplete
            v-model="person"
            :source="people"
            :min-chars="1"
            aria-labelledby="admin-perms-person"
            :placeholder="t('admin.admins.personPlaceholder')"
            data-testid="admin-person"
            @select="onPick"
          />
          <small class="adm-hint">{{ t('admin.admins.personHint') }}</small>
        </div>
        <UiField v-else v-model="email" type="email" ltr :label="t('admin.emailLabel')" placeholder="name@example.com" autocomplete="off" />
      </template>
      <p v-else class="adm-muted"><span class="adm-ltr">{{ admin.email }}</span></p>
      <AdminPermissionMatrix v-model="perms" :disabled="busy" />
      <p v-if="error" class="adm-err" role="alert">{{ error }}</p>
    </form>
    <template #actions>
      <UiButton type="submit" form="admin-perms" :loading="busy" data-testid="perms-save">{{ admin ? t('admin.admins.save') : t('admin.admins.add') }}</UiButton>
      <UiButton tone="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
    </template>
  </UiDialog>
</template>
