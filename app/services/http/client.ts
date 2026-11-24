/**
 * Small fetch wrapper for the Laravel API (Sanctum SPA cookie sessions).
 *
 * - Sends cookies (`credentials: 'include'`) and the `X-XSRF-TOKEN` header on every write. The token comes from the
 *   `XSRF-TOKEN` cookie; when it is missing, `GET /sanctum/csrf-cookie` is called first. A `419` (stale token) is
 *   retried once after refreshing the cookie.
 * - Turns every failure into a `PortError` using the API's error envelope `{ code, message, fields?, current? }`.
 *   A request that never reached the server is `network`.
 * Contract: backend/specs/001-backend-api/contracts/openapi.yaml.
 */
import { PortError, type PortErrorCode } from '../types'

export interface HttpClientOptions {
  /** API origin, no trailing slash, e.g. `http://localhost:8000`. */
  baseUrl: string
  fetch?: typeof fetch
  /** Reads a cookie value (already URL-decoded is not required). Defaults to `document.cookie`. */
  readCookie?: (name: string) => string | null
  /** Extra headers on every request (the unit tests send Origin/Referer, which browsers add themselves). */
  headers?: Record<string, string>
}

export interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  /** `json` (default) parses the body, `blob` returns it as a Blob, `none` ignores it. */
  as?: 'json' | 'blob' | 'none'
}

const CODES: readonly PortErrorCode[] = [
  'invalid_credentials', 'validation', 'unauthenticated', 'token_invalid', 'token_expired',
  'conflict', 'not_found', 'rate_limited', 'network', 'unknown',
  'limit_reached', 'storage_full', 'storage_not_linked',
]

function browserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

/** Maps a failed response to a PortError. Exported for tests. */
export async function toPortError(res: Response): Promise<PortError> {
  let body: { code?: unknown; fields?: unknown; current?: unknown; limit?: unknown } | null = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const code = body && typeof body.code === 'string' && (CODES as readonly string[]).includes(body.code)
    ? (body.code as PortErrorCode)
    : res.status === 429 ? 'rate_limited'
      : res.status === 419 || res.status === 401 ? 'unauthenticated'
        : res.status === 404 ? 'not_found'
          : res.status === 507 ? 'storage_full'
            : 'unknown'
  const fields = body && body.fields && typeof body.fields === 'object' ? (body.fields as Record<string, string>) : undefined
  // Release 2: 403 limit_reached carries { key, value, usage }.
  const raw = body?.limit as { key?: unknown; value?: unknown; usage?: unknown } | undefined
  const limit = code === 'limit_reached' && raw && typeof raw.key === 'string'
    ? { key: raw.key, value: (raw.value ?? null) as number | boolean | string[] | null, usage: typeof raw.usage === 'number' ? raw.usage : null }
    : undefined
  return new PortError(code, fields, body?.current, limit)
}

export function createHttpClient(opts: HttpClientOptions) {
  const f: typeof fetch = opts.fetch ?? ((...args) => fetch(...args))
  const readCookie = opts.readCookie ?? browserCookie
  const base = opts.baseUrl.replace(/\/+$/, '')

  // Cross-site dev (SPA and API on different sites): the XSRF-TOKEN cookie is invisible to JS, so the token also
  // comes back in the exposed `X-CSRF-TOKEN` header of the csrf-cookie response.
  let headerToken: string | null = null

  const xsrf = () => {
    const raw = readCookie('XSRF-TOKEN')
    return raw ? decodeURIComponent(raw) : headerToken
  }

  async function send(method: string, path: string, o: RequestOptions, write: boolean): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers, ...o.headers }
    if (o.body !== undefined) headers['Content-Type'] = 'application/json'
    if (write) {
      let token = xsrf()
      if (!token) {
        await refreshCsrf()
        token = xsrf()
      }
      if (token) headers[readCookie('XSRF-TOKEN') ? 'X-XSRF-TOKEN' : 'X-CSRF-TOKEN'] = token
    }
    try {
      return await f(base + path, {
        method,
        credentials: 'include',
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      })
    } catch {
      throw new PortError('network')
    }
  }

  /** `GET /sanctum/csrf-cookie`: starts the session and sets the XSRF-TOKEN cookie. */
  async function refreshCsrf(): Promise<void> {
    try {
      const res = await f(base + '/sanctum/csrf-cookie', { method: 'GET', credentials: 'include', headers: { Accept: 'application/json', ...opts.headers } })
      headerToken = res.headers?.get?.('X-CSRF-TOKEN') ?? null
    } catch {
      throw new PortError('network')
    }
  }

  async function request<T = unknown>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(method)
    let res = await send(method, path, o, write)
    if (res.status === 419 && write) {
      await refreshCsrf()
      res = await send(method, path, o, write)
    }
    if (!res.ok) throw await toPortError(res)
    if (o.as === 'none' || res.status === 204) return undefined as T
    if (o.as === 'blob') return (await res.blob()) as T
    const text = await res.text()
    if (!text) return null as T
    try {
      return JSON.parse(text) as T
    } catch {
      // A 2xx that isn't JSON (an HTML page from a proxy or a misrouted base URL) is not an answer from the service.
      throw new PortError('unknown')
    }
  }

  return {
    request,
    refreshCsrf,
    get: <T>(path: string, o?: RequestOptions) => request<T>('GET', path, o),
    post: <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>('POST', path, { ...o, body }),
    put: <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>('PUT', path, { ...o, body }),
    patch: <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>('PATCH', path, { ...o, body }),
    del: <T>(path: string, body?: unknown, o: RequestOptions = {}) => request<T>('DELETE', path, { ...o, body }),
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>
