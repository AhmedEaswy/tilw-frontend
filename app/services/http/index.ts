/**
 * HTTP adapter for the service ports: talks to the Laravel API (backend repository). Same behaviour as the mock
 * (services/mock), so the screens do not change. Route table: specs/001-studio-frontend/contracts/ports.md.
 */
import type { Services } from '../ports'
import { PortError, isPortError, type Script, type ScriptSummary, type User } from '../types'
import { createHttpClient, type HttpClientOptions } from './client'

const seg = encodeURIComponent

export function createHttpServices(opts: HttpClientOptions): { services: Services; client: ReturnType<typeof createHttpClient> } {
  const api = createHttpClient(opts)

  const services: Services = {
    auth: {
      me: () => api.get<User | null>('/api/user'),
      signIn: input => api.post<User>('/login', input),
      signOut: async () => {
        try {
          await api.post('/logout')
        } catch (e) {
          // Already signed out elsewhere: the goal (no session) is met.
          if (!isPortError(e, 'unauthenticated')) throw e
        }
      },
      requestPasswordReset: input => api.post<void>('/forgot-password', input),
      checkResetToken: token => api.get<{ email: string }>(`/reset-password/${seg(token)}`),
      resetPassword: input => api.post<User>('/reset-password', input),
      checkInvite: token => api.get<{ email: string }>(`/invitations/${seg(token)}`),
      acceptInvite: ({ token, ...rest }) => api.post<User>(`/invitations/${seg(token)}/accept`, rest),
    },

    waitlist: {
      join: input => api.post<void>('/api/waitlist', input),
    },

    scripts: {
      list: () => api.get<ScriptSummary[]>('/api/scripts'),
      search: query => api.get<string[]>(`/api/scripts/search?q=${seg(query)}`),
      get: id => api.get<Script>(`/api/scripts/${seg(id)}`),
      create: input => api.post<Script>('/api/scripts', input),
      // Content changes need the version they were made against; the API answers 409 + the server copy otherwise.
      update: (id, patch, baseVersion) => api.patch<Script>(`/api/scripts/${seg(id)}`, patch, { headers: { 'If-Match': String(baseVersion) } }),
      duplicate: id => api.post<Script>(`/api/scripts/${seg(id)}/duplicate`),
      remove: id => api.del<void>(`/api/scripts/${seg(id)}`),
      savePosition: (id, position) => api.put<void>(`/api/scripts/${seg(id)}/position`, position),
    },

    account: {
      updatePrefs: patch => api.patch<User>('/api/user/preferences', patch),
      updateReading: settings => api.put<User>('/api/user/reading', settings),
      exportData: input => api.post<Blob>('/api/user/export', input, { as: 'blob' }),
      changePassword: input => api.put<void>('/api/user/password', input),
      deleteAccount: input => api.del<void>('/api/user', input),
    },

    // Device-only: the old app's browser keys are not defined for the real service, so there is nothing to offer.
    legacy: {
      scan: async () => [],
    },
  }

  return { services, client: api }
}

export { PortError }
