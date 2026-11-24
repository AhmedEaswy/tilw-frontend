# Service port contracts — release 2 delta

Extends `../../001-studio-frontend/contracts/ports.md`. Release-1 methods keep their signatures except where marked **changed**. Every method rejects with `PortError`; codes below are the ones each method can raise besides `unauthenticated`, `rate_limited` and `unknown`. HTTP routes are from `backend/specs/002-accounts-plans-storage/contracts/openapi.yaml`.

## PortErrorCode (added)

| Code | Meaning | Extra |
|---|---|---|
| `limit_reached` | action exceeds an effective plan limit | `limit: { key, value, usage }` |
| `storage_full` | the linked Drive has no room for the take | — |
| `storage_not_linked` | no linked storage, or Google revoked it | — |

## PlanPort (new)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `listPlans()` | `Plan[]` | — (public) | `GET /api/plans` |
| `myPlan()` | `MyPlan` | — | `GET /api/user/plan` |
| `requestUpgrade({ plan, period })` | `{ request: UpgradeRequest, whatsappUrl: string │ null }` | `validation` | `POST /api/user/subscription-requests` |
| `cancelRequest()` | `void` | `not_found` | `DELETE /api/user/subscription-requests/current` |

Mock: reference `TLW-` + 4 chars; `requestUpgrade` twice returns the same reference; `/__mock` can fulfil, reject or expire it and move the clock.

## StoragePort (new)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `status()` | `StorageStatus` | — | `GET /api/storage` |
| `connectUrl(client: 'web')` | `string` | `limit_reached` | `GET /api/storage/google/connect` |
| `unlink()` | `void` | — | `DELETE /api/storage` |
| `setSyncMode(mode)` | `{ mode }` | `limit_reached` (`storage.auto_sync`), `storage_not_linked` | `PUT /api/user/sync` |
| `uploadToken(scriptId?)` | `{ accessToken, expiresAt, rootFolderId, folderId }` | `storage_not_linked` | `POST /api/storage/token` |
| `uploader()` | `DriveUploader` | — | Google endpoints directly (mock: fake Drive) |

`DriveUploader`: `start(file: Blob, meta, folderId, token) → session`, `resume(session, file, onProgress)`, `download(fileId, token) → Blob`, `remove(fileId, token)`. Errors map to `storage_full`, `storage_not_linked`, `unknown` (network → retried by the queue).

## RemoteTakesPort (new)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `list(scriptId?)` | `RemoteTake[]` | — | `GET /api/takes` |
| `register(input)` | `RemoteTake` (idempotent on `clientId`) | `limit_reached` (`takes.max_minutes`, `storage.providers`), `storage_not_linked`, `storage_full`, `validation` | `POST /api/takes` |
| `update(id, patch)` | `RemoteTake` | `not_found` | `PATCH /api/takes/{id}` |
| `remove(id, { remote })` | `void` | `not_found`, `storage_not_linked` | `DELETE /api/takes/{id}?remote=` |

## ScriptsPort (additions)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `listVersions(id)` | `ScriptVersionSummary[]` | `not_found` | `GET /api/scripts/{id}/versions` |
| `getVersion(id, versionId)` | `ScriptVersion` | `not_found` | `GET …/versions/{versionId}` |
| `restoreVersion(id, versionId, baseVersion)` | `Script` | `conflict` (with current), `limit_reached`, `not_found` | `POST …/versions/{versionId}/restore` + `If-Match` |
| `create`, `duplicate`, `update` (**existing**) | unchanged | **+ `limit_reached`** | unchanged |
| `list`, `get` (**existing**) | items gain `readOnly`, `readOnlyReason` | unchanged | unchanged |

## AccountPort (additions)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `deleteAccount({ password })` (**changed**) | `{ deletionDueAt: string }` | `invalid_credentials`, `validation` | `DELETE /api/user` |
| `requestEmailChange({ email, password })` | `PendingEmail` | `invalid_credentials`, `validation` | `POST /api/user/email` |
| `pendingEmailChange()` | `PendingEmail │ null` | — | `GET /api/user/email` |
| `cancelEmailChange()` | `void` | — | `DELETE /api/user/email` |
| `resendEmailChange()` | `void` | `not_found` | `POST /api/user/email/resend` |
| `listDevices()` | `Device[]` | — | `GET /api/user/devices` |
| `revokeDevice(id)` | `void` | `not_found` | `DELETE /api/user/devices/{id}` |

## AuthPort (additions)

| Method | Returns | Errors | HTTP |
|---|---|---|---|
| `confirmEmail(token)` | `{ email }` | `token_invalid`, `token_expired` | `POST /email/confirm` |
| `lastNotice()` | `'deletion_cancelled' │ null` (cleared on read) | — | from `POST /login` response `notice` |

## Device-only (no port, release-1 rule kept)

`TakesRepo` stays device-only. The upload queue (`services/drive/queue.ts`) reads blobs from it and writes nothing back except the take's remote link in `TakeMeta.remote`.

## Mock knobs (`/__mock`, dev only) — added

Plan of the signed-in person (Free/Pro), any limit value, personal override, request fulfil/reject/expire, clock offset (days), Drive mode (`ok`, `full`, `revoked`, `slow`), add a remote-only take, add a phone device, email-change link (shows the token).
