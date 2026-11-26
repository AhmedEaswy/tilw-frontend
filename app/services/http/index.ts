/**
 * HTTP adapter for the service ports: talks to the Laravel API (backend repository). Same behaviour as the mock
 * (services/mock), so the screens do not change. Route table: specs/001-studio-frontend/contracts/ports.md.
 */
import type { Services } from '../ports'
import { createDriveUploader } from '../drive/uploader'
import {
  PortError, isPortError, type Device, type MyPlan, type PendingEmail, type Plan, type RemoteTake, type Script,
  type ScriptPage, type ScriptSummary, type ScriptVersion, type ScriptVersionSummary, type StorageStatus, type SyncMode, type UpgradeRequest,
  type UploadToken, type User,
} from '../types'
import type { LinkAuth, Pairing, PairingCode, PhoneLink, PhoneLinkWithCode, RealtimeSettings } from '../types'
import { createHttpClient, type HttpClientOptions } from './client'
import { createHttpRealtime } from './realtime'
import { createHttpAdmin, createHttpPractice, createHttpSettings } from './admin'
import { createSpeech } from '../ai/speech'
import type { Credits, FormatEstimate, FormatSuggestion, OwnKey, Transcription, TranscriptionEstimate, TranscriptionPermission } from '../types'

const seg = encodeURIComponent

/** Feature 004: the phone signs link calls with its `rl_` credential; the studio uses its session cookie. */
export const linkHeaders = (auth: LinkAuth): Record<string, string> =>
  auth.kind === 'remote' ? { Authorization: `Bearer ${auth.credential}` } : {}

export function createHttpServices(opts: HttpClientOptions & { realtime?: RealtimeSettings | null }): { services: Services; client: ReturnType<typeof createHttpClient> } {
  const api = createHttpClient(opts)
  let notice: 'deletion_cancelled' | null = null
  const drive = createDriveUploader({ fetch: opts.fetch })

  /** POST /login answers the release-1 profile plus `notice` when the sign-in cancelled a scheduled deletion. */
  async function signIn(input: { email: string; password: string }): Promise<User> {
    const res = await api.post<User & { notice?: string | null }>('/login', input)
    const { notice: n, ...user } = res ?? ({} as User & { notice?: string | null })
    notice = n === 'deletion_cancelled' ? n : null
    return user as User
  }

  const services: Services = {
    auth: {
      me: () => api.get<User | null>('/api/user'),
      signIn,
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
      confirmEmail: token => api.post<{ email: string }>('/email/confirm', { token }),
      lastNotice: () => {
        const n = notice
        notice = null
        return n
      },
      // Feature 006: public sign-up, a cookie route like /login (CSRF first).
      signUp: input => api.post<User>('/register', input),
    },

    waitlist: {
      join: input => api.post<void>('/api/waitlist', input),
    },

    scripts: {
      list: () => api.get<ScriptSummary[]>('/api/scripts'),
      page: ({ limit, filter, sort, dir, q, cursor }) => {
        const qs = new URLSearchParams({ limit: String(limit) })
        if (filter) qs.set('filter', filter)
        if (sort) qs.set('sort', sort)
        if (dir) qs.set('dir', dir)
        if (q?.trim()) qs.set('q', q.trim())
        if (cursor) qs.set('cursor', cursor)
        return api.get<ScriptPage>(`/api/scripts?${qs}`)
      },
      search: query => api.get<string[]>(`/api/scripts/search?q=${seg(query)}`),
      get: id => api.get<Script>(`/api/scripts/${seg(id)}`),
      create: input => api.post<Script>('/api/scripts', input),
      // Content changes need the version they were made against; the API answers 409 + the server copy otherwise.
      update: (id, patch, baseVersion) => api.patch<Script>(`/api/scripts/${seg(id)}`, patch, { headers: { 'If-Match': String(baseVersion) } }),
      duplicate: id => api.post<Script>(`/api/scripts/${seg(id)}/duplicate`),
      remove: id => api.del<void>(`/api/scripts/${seg(id)}`),
      savePosition: (id, position) => api.put<void>(`/api/scripts/${seg(id)}/position`, position),
      listVersions: id => api.get<ScriptVersionSummary[]>(`/api/scripts/${seg(id)}/versions`),
      getVersion: (id, versionId) => api.get<ScriptVersion>(`/api/scripts/${seg(id)}/versions/${seg(versionId)}`),
      restoreVersion: (id, versionId, baseVersion) =>
        api.post<Script>(`/api/scripts/${seg(id)}/versions/${seg(versionId)}/restore`, undefined, { headers: { 'If-Match': String(baseVersion) } }),
    },

    account: {
      updatePrefs: patch => api.patch<User>('/api/user/preferences', patch),
      updateReading: settings => api.put<User>('/api/user/reading', settings),
      exportData: input => api.post<Blob>('/api/user/export', input, { as: 'blob' }),
      changePassword: input => api.put<void>('/api/user/password', input),
      deleteAccount: input => api.del<{ deletionDueAt: string }>('/api/user', input),
      requestEmailChange: input => api.post<PendingEmail>('/api/user/email', input),
      pendingEmailChange: () => api.get<PendingEmail | null>('/api/user/email'),
      cancelEmailChange: () => api.del<void>('/api/user/email'),
      resendEmailChange: () => api.post<void>('/api/user/email/resend', undefined, { as: 'none' }),
      listDevices: () => api.get<Device[]>('/api/user/devices'),
      revokeDevice: id => api.del<void>(`/api/user/devices/${seg(id)}`),
    },

    admin: createHttpAdmin(api),
    settings: createHttpSettings(api),
    practice: createHttpPractice(api),

    // Device-only: the old app's browser keys are not defined for the real service, so there is nothing to offer.
    legacy: {
      scan: async () => [],
    },

    plans: {
      listPlans: () => api.get<Plan[]>('/api/plans'),
      myPlan: () => api.get<MyPlan>('/api/user/plan'),
      requestUpgrade: input => api.post<{ request: UpgradeRequest }>('/api/user/subscription-requests', input),
      cancelRequest: () => api.del<void>('/api/user/subscription-requests/current'),
    },

    storage: {
      status: () => api.get<StorageStatus>('/api/storage'),
      connectUrl: async client => (await api.get<{ url: string }>(`/api/storage/google/connect?client=${seg(client)}`)).url,
      unlink: () => api.del<void>('/api/storage'),
      setSyncMode: mode => api.put<{ mode: SyncMode }>('/api/user/sync', { mode }),
      uploadToken: scriptId => api.post<UploadToken>('/api/storage/token', { scriptId: scriptId ?? null }),
      uploader: () => drive,
    },

    remoteTakes: {
      list: scriptId => api.get<RemoteTake[]>(`/api/takes${scriptId ? `?scriptId=${seg(scriptId)}` : ''}`),
      register: input => api.post<RemoteTake>('/api/takes', input),
      update: (id, patch) => api.patch<RemoteTake>(`/api/takes/${seg(id)}`, patch),
      remove: (id, { remote }) => api.del<void>(`/api/takes/${seg(id)}${remote ? '?remote=1' : ''}`),
    },

    // ---------- feature 004: phone link (backend specs/003-phone-link/contracts/openapi.yaml) ----------
    links: {
      start: scriptId => api.post<PhoneLinkWithCode>('/api/links', { scriptId }),
      current: scriptId => api.get<PhoneLink | null>(`/api/links/current?scriptId=${seg(scriptId)}`),
      list: async () => {
        const res = await api.get<PhoneLink[] | { data: PhoneLink[] }>('/api/links')
        return Array.isArray(res) ? res : (res?.data ?? [])
      },
      newCode: id => api.post<PairingCode>(`/api/links/${seg(id)}/codes`),
      update: (id, patch) => api.patch<PhoneLink>(`/api/links/${seg(id)}`, patch),
      end: id => api.del<void>(`/api/links/${seg(id)}`),
      acceptRemote: (id, remoteId) => api.post<PhoneLink>(`/api/links/${seg(id)}/remotes/${seg(remoteId)}/accept`),
      declineRemote: (id, remoteId) => api.post<void>(`/api/links/${seg(id)}/remotes/${seg(remoteId)}/decline`),
    },

    relay: {
      pair: (input, name) => api.post<Pairing>('/api/links/pair', name ? { ...input, name } : input),
      command: (auth, id, cmd) => api.post<void>(`/api/links/${seg(id)}/commands`, cmd, { headers: linkHeaders(auth) }),
      ack: (auth, id, ack) => api.post<void>(`/api/links/${seg(id)}/acks`, ack, { headers: linkHeaders(auth) }),
      state: (auth, id, state) => api.put<void>(`/api/links/${seg(id)}/state`, state, { headers: linkHeaders(auth) }),
      ping: (auth, id) => api.post<void>(`/api/links/${seg(id)}/ping`, undefined, { headers: linkHeaders(auth) }),
      leave: (auth, id) => api.post<void>(`/api/links/${seg(id)}/leave`, undefined, { headers: linkHeaders(auth) }),
      requestRoles: (auth, id, player) => api.post<void>(`/api/links/${seg(id)}/roles`, { player }, { headers: linkHeaders(auth) }),
      answerRoles: (auth, id, accept) => api.post<void>(`/api/links/${seg(id)}/roles/${accept ? 'accept' : 'decline'}`, undefined, { headers: linkHeaders(auth) }),
    },

    realtime: createHttpRealtime({ client: api, settings: opts.realtime ?? null }),

    // ---------- feature 005: AI writing tools (backend specs/004-ai-writing-tools/contracts/openapi.yaml) ----------
    // Only lengths, sizes, types and the provider's request id go to the API; audio goes to the provider (speech).
    ai: {
      formatEstimate: id => api.get<FormatEstimate>(`/api/scripts/${seg(id)}/format/estimate`),
      format: (id, o = {}) => api.post<FormatSuggestion>(`/api/scripts/${seg(id)}/format`, o.useCredits ? { useCredits: true } : {}),
      suggestion: async (id) => {
        try {
          return await api.get<FormatSuggestion>(`/api/scripts/${seg(id)}/format`)
        } catch (e) {
          if (isPortError(e, 'not_found')) return null
          throw e
        }
      },
      discard: id => api.del<void>(`/api/scripts/${seg(id)}/format`),
      apply: id => api.post<Script>(`/api/scripts/${seg(id)}/format/apply`),
      credits: () => api.get<Credits>('/api/ai/credits'),
      keys: async () => {
        const res = await api.get<OwnKey[] | { data: OwnKey[] }>('/api/ai/keys')
        return Array.isArray(res) ? res : (res?.data ?? [])
      },
      saveKey: input => api.put<OwnKey>('/api/ai/keys/text', input),
      deleteKey: () => api.del<void>('/api/ai/keys/text'),
      checkKey: () => api.post<OwnKey>('/api/ai/keys/text/check'),
      transcriptionEstimate: ({ seconds, bytes, mimeType, purpose }) =>
        api.get<TranscriptionEstimate>(`/api/ai/transcriptions/estimate?seconds=${seconds}&bytes=${bytes}&mimeType=${seg(mimeType)}${purpose ? `&purpose=${seg(purpose)}` : ''}`),
      startTranscription: input => api.post<TranscriptionPermission>('/api/ai/transcriptions', input),
      transcription: id => api.get<Transcription>(`/api/ai/transcriptions/${seg(id)}`),
      complete: (id, requestId) => api.post<Transcription>(`/api/ai/transcriptions/${seg(id)}/complete`, { requestId }),
      fail: (id, reason) => api.post<Transcription>(`/api/ai/transcriptions/${seg(id)}/fail`, reason ? { reason } : {}),
    },
    speech: createSpeech({ fetch: opts.fetch }),
  }

  return { services, client: api }
}

export { PortError }
