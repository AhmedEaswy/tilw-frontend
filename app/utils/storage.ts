/**
 * Release 2 (US3): where a take is, as the recordings list and take review show it (data-model.md "Take place").
 * Pure so it can be unit-tested.
 */
import type { QueueError, QueueProgress } from '~/services/drive/queue'
import type { TakeMeta } from '~/services/takes'
import type { RemoteTake } from '~/services/types'

export type TakePlace = 'device' | 'waiting' | 'uploading' | 'drive' | 'driveOnly' | 'failed' | 'unreachable'

export interface PlaceInfo {
  place: TakePlace
  /** 0..100 while uploading. */
  percent?: number
  error?: QueueError | null
}

export function takePlace(take: TakeMeta, upload: QueueProgress | undefined): PlaceInfo {
  if (take.driveOnly) {
    const s = take.remote?.state
    if (s === 'unreachable') return { place: 'unreachable' }
    if (s === 'failed') return { place: 'failed' }
    return { place: 'driveOnly' }
  }
  if (upload && upload.state !== 'done' && upload.state !== 'removed') {
    if (upload.state === 'failed') return { place: 'failed', error: upload.error }
    if (upload.state === 'uploading') {
      return { place: 'uploading', percent: upload.total ? Math.min(100, Math.floor((upload.sent / upload.total) * 100)) : 0 }
    }
    return { place: 'waiting', error: upload.error }
  }
  if (take.remote?.state === 'backed_up') return { place: 'drive' }
  if (take.remote?.state === 'failed') return { place: 'failed' }
  return { place: 'device' }
}

/** A Drive-only take shaped like a device take, so the recordings list and review can show it. */
export function remoteAsMeta(r: RemoteTake): TakeMeta {
  return {
    id: `r_${r.id}`,
    scriptId: r.scriptId ?? 'none',
    scriptTitle: r.title,
    number: 0,
    kind: r.kind,
    mimeType: r.mime,
    durationMs: r.durationMs,
    sizeBytes: r.sizeBytes,
    starred: r.starred,
    createdAt: r.recordedAt,
    remote: { id: r.id, state: r.state, providerFileId: r.providerFileId },
    driveOnly: true,
  }
}

/** Device takes with the service's view of their Drive copy, plus takes that are only in Drive (merged by clientId). */
export function mergeTakes(device: TakeMeta[], remote: RemoteTake[]): TakeMeta[] {
  const byClient = new Map(remote.map(r => [r.clientId, r]))
  const merged = device.map((t) => {
    const r = byClient.get(t.id)
    if (!r) return t
    byClient.delete(t.id)
    return { ...t, remote: { id: r.id, state: r.state, providerFileId: r.providerFileId } }
  })
  const onlyRemote = [...byClient.values()].filter(r => r.state !== 'uploading').map(remoteAsMeta)
  return [...merged, ...onlyRemote].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
