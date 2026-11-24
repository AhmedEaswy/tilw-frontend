# Data model (client): Web app — accounts, plans & storage

Client-side shapes, stores and local persistence. Server tables are in `backend/specs/002-accounts-plans-storage/data-model.md`; wire shapes are in its `contracts/openapi.yaml`. Release-1 shapes in `../001-studio-frontend/data-model.md` stay unless extended here.

## Types (`app/services/types.ts`)

| Type | Fields | Notes |
|---|---|---|
| `LimitKey` | `string` | known: `scripts.max_active`, `scripts.max_words`, `takes.max_minutes`, `ai.credits_monthly`, `storage.auto_sync`, `storage.providers`, `history.versions`, `history.days`, `byok.allowed`, `phone_link.allowed` |
| `LimitValue` | `key`, `type: 'int'│'bool'│'list'`, `label`, `value: number│boolean│string[]│null`, `usage?: number│null`, `overridden: boolean` | `null` on `int` = unlimited |
| `Plan` | `key`, `name`, `priceMonthlyCents`, `priceYearlyCents`, `currency: 'USD'`, `limits: LimitValue[]` | |
| `MyPlan` | `plan: Plan`, `period: 'monthly'│'yearly'│'custom'│null`, `startsAt?`, `endsAt?`, `renewsAfter?`, `limits`, `pendingRequest: UpgradeRequest│null`, `notice?: 'pro_started'│'pro_ended'` | |
| `UpgradeRequest` | `id`, `reference`, `plan`, `period`, `priceCents`, `state`, `createdAt`, `expiresAt` | states as backend |
| `StorageStatus` | `provider: 'google_drive'│null`, `accountEmail?`, `state: 'none'│'linked'│'revoked'`, `syncMode: 'off'│'manual'│'auto'`, `autoSyncAllowed`, `quota?: { usedBytes, totalBytes│null, tilwBytes, tilwTakes }` | |
| `RemoteTake` | `id`, `clientId`, `scriptId│null`, `title`, `kind`, `mime`, `durationMs`, `sizeBytes`, `recordedAt`, `starred`, `providerFileId│null`, `state: 'uploading'│'backed_up'│'unreachable'│'failed'` | `clientId` = release-1 `TakeMeta.id` |
| `ScriptVersionSummary` | `id`, `createdAt`, `reason: 'edit'│'restore'│'ai'`, `wordCount` | |
| `ScriptVersion` | summary + `title`, `body`, `marks`, `direction` | same names as release-1 `Script` |
| `Device` | `id`, `name`, `platform: 'ios'│'android'│'other'│'web'`, `createdAt`, `lastUsedAt│null`, `current` | |
| `PendingEmail` | `email`, `expiresAt` | |
| `Script` / `ScriptSummary` (extended) | + `readOnly: boolean`, `readOnlyReason: LimitKey│null` | |
| `PortErrorCode` (extended) | + `limit_reached`, `storage_full`, `storage_not_linked` | `PortError.limit?: { key, value, usage }` |

## Take place (derived, UI only)

`TakeView` = merge of the device `TakeMeta` (by `id`) and `RemoteTake` (by `clientId`) and the upload queue entry:

| Shown as (chip, Storage status component) | Condition |
|---|---|
| على هذا الجهاز | device only, no queue entry, sync ≠ auto or not linked |
| بانتظار الرفع | queue `waiting` |
| جارٍ الرفع N٪ | queue `uploading` (progress from BroadcastChannel) |
| في Google Drive | device + remote `backed_up` |
| في Drive فقط | remote `backed_up`, no device copy |
| تعذّر النسخ · reason | queue `failed` or remote `failed` |
| غير متاح | remote `unreachable`, no device copy |

## Upload queue (IndexedDB, store `tilw-uploads`)

| Field | Type | Rules |
|---|---|---|
| `key` | `${userId}:${takeId}` | entries of other accounts are ignored |
| `takeId` | string | device take id |
| `remoteId` | string │ null | set after `register` |
| `sessionUrl` | string │ null | Google resumable session |
| `offset` | number | bytes confirmed by Google |
| `state` | `waiting` → `uploading` → (removed on success) │ `failed` | `failed` → `waiting` on Retry |
| `error` | `storage_full` │ `storage_not_linked` │ `network` │ `limit_reached` │ null | |
| `updatedAt` | ISO | |

Owner: the tab holding Web Lock `tilw-uploads`. Progress broadcast on `BroadcastChannel('tilw-uploads')` as `{ takeId, state, sent, total, error }`.

## Stores

| Store | State | Main actions |
|---|---|---|
| `plan` | `plans`, `my`, `loading`, `error` | `loadPublic()`, `load()`, `requestUpgrade(period)`, `cancelRequest()`, getter `limit(key)`, `consumeNotice()` |
| `storage` | `status`, `loading` | `load()`, `connect()`, `unlink()`, `setSyncMode(mode)` |
| `uploads` | `entries` by takeId (mirror of queue + live progress) | `enqueue(takeId)`, `retry(takeId)`, `cancel(takeId)`, starts/stops with sign-in |
| `takes` (extended) | + `remote: RemoteTake[]` | `loadRemote()`, `removeEverywhere(id)`, `markUnreachable(id)` |
| `editor` (extended) | + `readOnly`, `versions`, `previewVersion` | `openHistory()`, `preview(id)`, `restore(id)` |
| `auth` (extended) | + `pendingEmail`, `devices` | `requestEmailChange`, `confirmEmail`, `listDevices`, `revokeDevice` |

## Mock persistence additions (`localStorage tilw:mock:*`, IndexedDB `tilw-mock-drive`)

`plans`, `limitDefinitions`, `overrides`, `subscriptions`, `requests`, `versions`, `storage`, `remoteTakes`, `devices`, `emailChange`, `clockOffsetMs`, `driveMode: 'ok'│'full'│'revoked'│'slow'`; uploaded blobs in `tilw-mock-drive`.
