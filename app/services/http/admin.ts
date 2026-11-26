/**
 * Feature 006: the admin console's HTTP adapter (backend specs/005-admin-console/contracts/openapi.yaml).
 * Lists come back as `Page<T>`: `GET /api/admin/users` keeps its array answer with the cursor in `X-Next-Cursor`;
 * the other paged lists answer `{<items>, nextCursor}`; the audit log's cursor is an integer id.
 */
import type { AdminPort, PracticePort, SettingsPort } from '../ports'
import type {
  AdminAnalytics, AdminConnections, AdminLink, AdminList, AdminPreferences, AdminRow, AdminScript, AdminTake, PracticeSession,
  AdminAiCall, AdminDashboard, AdminOverride, AdminPlan, AdminPlanLimit, AdminSettings, AdminSubscription, AdminSubscriptionRow,
  AdminUpgradeRequest, AdminUserDetail, AdminUserRow, AiKeyState, AiUsage, AuditAction, AuditEntry, CreditEntry, FeatureFlag,
  Invitation, LedgerEntry, LimitDefinition, Page, PaymentsPage, PublicSettings, WaitlistEntry,
} from '../types'
import type { HttpClient } from './client'

const seg = encodeURIComponent

/** `?a=1&b=x`, leaving out empty values; booleans as true/false. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${seg(k)}=${seg(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

/** `{<key>: T[], nextCursor}` → `Page<T>` (plus any extra fields, e.g. payment totals). */
function page<T>(key: string) {
  return (res: Record<string, unknown> | null): Page<T> => ({
    ...(res ?? {}),
    items: ((res?.[key] as T[] | undefined) ?? []),
    nextCursor: (res?.nextCursor as string | null | undefined) ?? null,
  })
}

/** `{<key>: T[], nextCursor}` → exactly `Page<T>` (feature 007 sub-resources). */
function items<T>(key: string) {
  return (res: Record<string, unknown> | null): Page<T> => ({ items: ((res?.[key] as T[] | undefined) ?? []), nextCursor: (res?.nextCursor as string | null | undefined) ?? null })
}

export function createHttpAdmin(api: HttpClient): AdminPort {
  return {
    waitlist: f => api.get<WaitlistEntry[]>(`/api/admin/waitlist${query({ q: f?.q, invited: f?.invited })}`),
    removeWaitlist: id => api.del<void>(`/api/admin/waitlist/${seg(id)}`),
    invitations: () => api.get<Invitation[]>('/api/admin/invitations'),
    invite: input => api.post<Invitation>('/api/admin/invitations', input),
    resend: id => api.post<Invitation>(`/api/admin/invitations/${seg(id)}/resend`),
    withdraw: id => api.del<void>(`/api/admin/invitations/${seg(id)}`),

    dashboard: p => api.get<AdminDashboard>(`/api/admin/dashboard${query(typeof p === 'number' ? { days: p } : p)}`),
    users: async (f, cursor, limit) => {
      const res = await api.get<{ body: AdminUserRow[] | null; headers: Headers }>(
        `/api/admin/users${query({ q: f.q, plan: f.plan, status: f.status, cursor, limit })}`,
        { as: 'raw' },
      )
      return { items: res.body ?? [], nextCursor: res.headers.get('X-Next-Cursor') || null }
    },
    user: id => api.get<AdminUserDetail>(`/api/admin/users/${seg(id)}`),
    suspend: (id, reason) => api.post<AdminUserDetail>(`/api/admin/users/${seg(id)}/suspend`, { reason }),
    unsuspend: id => api.post<AdminUserDetail>(`/api/admin/users/${seg(id)}/unsuspend`),
    sendPasswordReset: id => api.post<{ sentTo: string }>(`/api/admin/users/${seg(id)}/password-reset`),
    changePlan: (id, input) => api.put<AdminUserDetail>(`/api/admin/users/${seg(id)}/plan`, input),
    grantAdmin: id => api.post<AdminUserDetail>(`/api/admin/users/${seg(id)}/admin`),
    revokeAdmin: id => api.del<AdminUserDetail>(`/api/admin/users/${seg(id)}/admin`),
    scheduleDeletion: (id, reason) => api.del<AdminUserDetail>(`/api/admin/users/${seg(id)}`, { reason }),
    cancelDeletion: id => api.post<AdminUserDetail>(`/api/admin/users/${seg(id)}/restore`),
    addCredits: (id, input, key) =>
      api.post<CreditEntry>(`/api/admin/users/${seg(id)}/credits`, input, key ? { headers: { 'Idempotency-Key': key } } : {}),
    setOverride: (id, key, input) => api.put<AdminOverride>(`/api/admin/users/${seg(id)}/overrides/${seg(key)}`, input),
    removeOverride: (id, key) => api.del<void>(`/api/admin/users/${seg(id)}/overrides/${seg(key)}`),
    userSubscriptions: id => api.get<AdminSubscription[]>(`/api/admin/users/${seg(id)}/subscriptions`),
    grantSubscription: (id, input) => api.post<AdminSubscription>(`/api/admin/users/${seg(id)}/subscriptions`, input),

    plans: () => api.get<AdminPlan[]>('/api/admin/plans'),
    createPlan: input => api.post<AdminPlan>('/api/admin/plans', input),
    updatePlan: (id, input) => api.patch<AdminPlan>(`/api/admin/plans/${seg(id)}`, input),
    setPlanLimit: (id, key, value) => api.put<AdminPlanLimit>(`/api/admin/plans/${seg(id)}/limits/${seg(key)}`, { value }),
    unsetPlanLimit: (id, key) => api.del<void>(`/api/admin/plans/${seg(id)}/limits/${seg(key)}`),
    limitDefinitions: () => api.get<LimitDefinition[]>('/api/admin/limit-definitions'),
    defineLimit: input => api.post<LimitDefinition>('/api/admin/limit-definitions', input),

    subscriptions: async (f, cursor) =>
      page<AdminSubscriptionRow>('subscriptions')(await api.get(`/api/admin/subscriptions${query({ ...f, cursor })}`)),
    updateSubscription: (id, patch) => api.patch<AdminSubscription>(`/api/admin/subscriptions/${seg(id)}`, patch),
    requests: f => api.get<AdminUpgradeRequest[]>(`/api/admin/subscription-requests${query({ q: f?.q, state: f?.state })}`),
    fulfilRequest: (id, input) => api.post<AdminSubscription>(`/api/admin/subscription-requests/${seg(id)}/fulfil`, input ?? {}),
    rejectRequest: (id, note) => api.post<AdminUpgradeRequest>(`/api/admin/subscription-requests/${seg(id)}/reject`, note ? { note } : {}),
    payments: async (f, cursor) => {
      const res = await api.get<Record<string, unknown> | null>(`/api/admin/payments${query({ ...f, cursor })}`)
      const p = page<PaymentsPage['items'][number]>('payments')(res)
      return { items: p.items, nextCursor: p.nextCursor, count: Number(res?.count ?? 0), totalCents: Number(res?.totalCents ?? 0), currency: 'USD' }
    },

    aiUsage: (period, groupBy) => api.get<AiUsage>(`/api/admin/ai/usage${query({ ...period, groupBy })}`),
    aiCalls: async (f, cursor) => page<AdminAiCall>('calls')(await api.get(`/api/admin/ai/calls${query({ ...f, cursor })}`)),
    ledger: async (f, cursor) => page<LedgerEntry>('entries')(await api.get(`/api/admin/credits/ledger${query({ ...f, cursor })}`)),

    settings: () => api.get<AdminSettings>('/api/admin/settings'),
    setSignupMode: mode => api.patch<AdminSettings>('/api/admin/settings', { signupMode: mode }),
    setFormatProvider: formatProvider => api.patch<AdminSettings>('/api/admin/settings', { formatProvider }),
    setAiKey: (provider, input) => api.put<AiKeyState>(`/api/admin/settings/ai-keys/${seg(provider)}`, input),
    removeAiKey: provider => api.del<AiKeyState>(`/api/admin/settings/ai-keys/${seg(provider)}`),
    setFlag: (key, input) => api.put<FeatureFlag>(`/api/admin/feature-flags/${seg(key)}`, input),
    removeFlag: key => api.del<void>(`/api/admin/feature-flags/${seg(key)}`),

    auditLog: async (f, cursor) => {
      const res = await api.get<{ entries?: AuditEntry[]; nextCursor?: string | number | null } | null>(
        `/api/admin/audit-log${query({ ...f, cursor: cursor ? Number(cursor) : undefined })}`,
      )
      return { items: res?.entries ?? [], nextCursor: res?.nextCursor == null ? null : String(res.nextCursor) }
    },
    auditActions: () => api.get<AuditAction[]>('/api/admin/audit-log/actions'),

    // ---------- feature 007 (backend specs/007-admin-insights) ----------
    analytics: p => api.get<AdminAnalytics>(`/api/admin/analytics${query(typeof p === 'number' ? { days: p } : p)}`),
    userTakes: async (id, cursor, limit) => items<AdminTake>('takes')(await api.get(`/api/admin/users/${seg(id)}/takes${query({ cursor, limit })}`)),
    userScripts: async (id, cursor, limit) => items<AdminScript>('scripts')(await api.get(`/api/admin/users/${seg(id)}/scripts${query({ cursor, limit })}`)),
    userLinks: async (id, cursor, limit) => items<AdminLink>('links')(await api.get(`/api/admin/users/${seg(id)}/links${query({ cursor, limit })}`)),
    userConnections: id => api.get<AdminConnections>(`/api/admin/users/${seg(id)}/connections`),
    userPreferences: id => api.get<AdminPreferences>(`/api/admin/users/${seg(id)}/preferences`),
    admins: () => api.get<AdminList>('/api/admin/admins'),
    addAdmin: input => api.post<AdminRow>('/api/admin/admins', input),
    updateAdmin: (id, permissions) => api.patch<AdminRow>(`/api/admin/admins/${seg(id)}`, { permissions }),
    removeAdmin: id => api.del<void>(`/api/admin/admins/${seg(id)}`),
  }
}

/** Feature 007: `POST /api/practice-sessions`. */
export function createHttpPractice(api: HttpClient): PracticePort {
  return { log: input => api.post<PracticeSession>('/api/practice-sessions', input) }
}

export function createHttpSettings(api: HttpClient): SettingsPort {
  return { public: () => api.get<PublicSettings>('/api/settings') }
}
