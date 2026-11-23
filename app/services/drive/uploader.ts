/**
 * Browser → Google Drive transfer (release 2, research §7). Uses Google's resumable upload protocol over `fetch`;
 * no Google script is loaded. Take bytes go only to www.googleapis.com, never to the Tilw API (constitution IV).
 *
 * 1. POST …/upload/drive/v3/files?uploadType=resumable with the file metadata → session URL in `Location`.
 * 2. PUT 8 MiB chunks with `Content-Range`; 308 = continue from the `Range` Google reports; 200/201 = done.
 * After a reload, `resume` first asks Google how much it already has (`Content-Range: bytes *\/total`).
 *
 * Errors: 401 → DriveTokenError (the queue refreshes the token once, then reports storage_not_linked);
 * 403 storageQuotaExceeded → storage_full; 404 on the session → not_found (start a new session);
 * anything else → network (the queue retries).
 */
import type { DriveSession, DriveUploader } from '../ports'
import { PortError } from '../types'

export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
export const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
/** Multiple of 256 KiB, as Google requires for every chunk but the last. */
export const CHUNK_BYTES = 8 * 1024 * 1024

/** The access token was refused (expired or revoked). */
export class DriveTokenError extends Error {
  constructor() {
    super('drive_token')
    this.name = 'DriveTokenError'
  }
}

async function reasonOf(res: Response): Promise<string | null> {
  try {
    const body = await res.json() as { error?: { errors?: { reason?: string }[]; status?: string } }
    return body.error?.errors?.[0]?.reason ?? body.error?.status ?? null
  } catch {
    return null
  }
}

async function fail(res: Response): Promise<never> {
  if (res.status === 401) throw new DriveTokenError()
  if (res.status === 404 || res.status === 410) throw new PortError('not_found')
  if (res.status === 403) {
    const reason = await reasonOf(res)
    if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded') throw new PortError('storage_full')
    // insufficientPermissions: the drive.file grant was withdrawn.
    if (reason === 'insufficientPermissions' || reason === 'appNotAuthorizedToFile') throw new PortError('storage_not_linked')
  }
  throw new PortError('network')
}

/** "bytes=0-1048575" → 1048576 (bytes Google has). No header = nothing yet. */
export function rangeEnd(header: string | null): number {
  const m = header?.match(/bytes=\d+-(\d+)/)
  return m ? Number(m[1]) + 1 : 0
}

export function createDriveUploader(opts: { fetch?: typeof fetch; chunkBytes?: number } = {}): DriveUploader {
  const f: typeof fetch = opts.fetch ?? ((...a) => fetch(...a))
  const chunk = opts.chunkBytes ?? CHUNK_BYTES

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await f(url, init)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e
      throw new PortError('network')
    }
  }

  async function done(res: Response): Promise<{ fileId: string }> {
    const body = await res.json() as { id?: string }
    if (!body.id) throw new PortError('unknown')
    return { fileId: body.id }
  }

  return {
    async start(file, meta, folderId, token): Promise<DriveSession> {
      const res = await send(`${DRIVE_UPLOAD}?uploadType=resumable&fields=id`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': meta.mimeType,
          'X-Upload-Content-Length': String(file.size),
        },
        body: JSON.stringify({ name: meta.name, mimeType: meta.mimeType, parents: [folderId] }),
      })
      if (!res.ok) await fail(res)
      const url = res.headers.get('Location')
      if (!url) throw new PortError('unknown')
      return { url }
    },

    async resume(session, file, token, onProgress, signal) {
      const total = file.size
      const auth = { Authorization: `Bearer ${token}` }
      // How much does Google already have?
      let res = await send(session.url, { method: 'PUT', headers: { ...auth, 'Content-Range': `bytes */${total}` }, signal })
      if (res.status === 200 || res.status === 201) return done(res)
      if (res.status !== 308) await fail(res)
      let offset = rangeEnd(res.headers.get('Range'))
      onProgress(offset, total)

      while (offset < total) {
        const end = Math.min(total, offset + chunk)
        res = await send(session.url, {
          method: 'PUT',
          headers: { ...auth, 'Content-Range': `bytes ${offset}-${end - 1}/${total}` },
          body: file.slice(offset, end),
          signal,
        })
        if (res.status === 200 || res.status === 201) {
          onProgress(total, total)
          return done(res)
        }
        if (res.status !== 308) await fail(res)
        offset = rangeEnd(res.headers.get('Range'))
        onProgress(offset, total)
      }
      // Google confirmed every byte but has not answered with the file yet: ask once more.
      res = await send(session.url, { method: 'PUT', headers: { ...auth, 'Content-Range': `bytes */${total}` }, signal })
      if (res.status === 200 || res.status === 201) return done(res)
      return fail(res)
    },

    async download(fileId, token) {
      const res = await send(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) await fail(res)
      return res.blob()
    },

    async remove(fileId, token) {
      const res = await send(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok && res.status !== 404) await fail(res)
    },
  }
}
