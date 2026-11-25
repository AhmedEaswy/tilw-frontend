import { ADMIN_SECTIONS, type AdminLevel, type AdminPermissions, type AdminRole, type AdminSection, type User } from '~/services/types'

const ALL_EDIT = Object.fromEntries(ADMIN_SECTIONS.map(s => [s, 'edit'])) as AdminPermissions
const NONE = Object.fromEntries(ADMIN_SECTIONS.map(s => [s, 'none'])) as AdminPermissions

/** `edit` includes `view`. */
export function levelAllows(level: AdminLevel | undefined | null, need: 'view' | 'edit'): boolean {
  return need === 'view' ? level === 'view' || level === 'edit' : level === 'edit'
}

/**
 * Feature 007: the signed-in person's admin role and permissions, from the profile.
 * Not an admin → nothing. The super admin → edit everywhere. An admin whose profile predates 007 (no
 * `adminPermissions`) keeps the 005 behaviour: edit everywhere (the API still decides).
 */
export function permissionsOf(user: Pick<User, 'isAdmin' | 'adminRole' | 'adminPermissions'> | null | undefined): { role: AdminRole | null; permissions: AdminPermissions } {
  if (!user?.isAdmin) return { role: null, permissions: { ...NONE } }
  if (user.adminRole === 'super') return { role: 'super', permissions: { ...ALL_EDIT } }
  if (!user.adminPermissions) return { role: user.adminRole ?? 'admin', permissions: { ...ALL_EDIT } }
  return { role: user.adminRole ?? 'admin', permissions: { ...NONE, ...user.adminPermissions } }
}

/** `can('money', 'edit')`, `isSuper`, and the full map, reactive to the session. */
export function useAdminPermissions() {
  const auth = useAuthStore()
  const state = computed(() => permissionsOf(auth.user))
  const can = (section: AdminSection, need: 'view' | 'edit' = 'view') => levelAllows(state.value.permissions[section], need)
  return {
    role: computed(() => state.value.role),
    permissions: computed(() => state.value.permissions),
    isSuper: computed(() => state.value.role === 'super'),
    isAdmin: computed(() => state.value.role !== null),
    can,
  }
}
