# Service Port Contracts

UI and stores depend only on these interfaces. `services/mock/*` is the in-browser mock; `services/http/*` is the
adapter for the Laravel API (routes in the right-hand column; contract: `backend/specs/001-backend-api/contracts/openapi.yaml`).
Switch with `NUXT_PUBLIC_SERVICES_MODE=http` and `NUXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

> **Release 2:** `PlanPort`, `StoragePort`, `RemoteTakesPort`, the history / email-change / device methods, the changed
> `deleteAccount` and the error kinds `limit_reached`, `storage_full`, `storage_not_linked` are specified in
> [`../../003-accounts-plans-storage/contracts/ports.md`](../../003-accounts-plans-storage/contracts/ports.md).

All methods return `Promise<T>` and reject with `PortError`:

```ts
type PortErrorCode =
  | 'invalid_credentials' | 'validation' | 'unauthenticated' | 'token_invalid' | 'token_expired'
  | 'conflict' | 'not_found' | 'rate_limited' | 'network' | 'unknown'
interface PortError { code: PortErrorCode; fields?: Record<string, string>; current?: unknown }
```

## AuthPort
| Method | Returns | Errors | HTTP (later) |
|---|---|---|---|
| `me()` | `User \| null` | — | `GET /api/user` |
| `signIn({email, password})` | `User` | invalid_credentials, rate_limited | `GET /sanctum/csrf-cookie` → `POST /login` |
| `signOut()` | `void` | — | `POST /logout` |
| `requestPasswordReset({email})` | `void` (always) | rate_limited | `POST /forgot-password` |
| `checkResetToken(token)` | `{email}` | token_invalid, token_expired | `GET /reset-password/{token}` |
| `resetPassword({token, password})` | `User` | token_*, validation | `POST /reset-password` |
| `checkInvite(token)` | `{email}` | token_invalid, token_expired | `GET /invitations/{token}` |
| `acceptInvite({token, name, password})` | `User` | token_*, validation | `POST /invitations/{token}/accept` |

## WaitlistPort
| `join({email})` | `void` | validation, rate_limited | `POST /api/waitlist` |
|---|---|---|---|

## ScriptsPort
| Method | Returns | Errors | HTTP (later) |
|---|---|---|---|
| `list()` | `Script[]` (without body) | — | `GET /api/scripts` |
| `search(query)` | `string[]` (ids; title + body, Arabic-normalised) | — | `GET /api/scripts/search?q=` |
| `get(id)` | `Script` | not_found | `GET /api/scripts/{id}` |
| `create({title, body?})` | `Script` | validation | `POST /api/scripts` |
| `update(id, patch, baseVersion)` | `Script` | conflict (`current` = server copy), validation | `PATCH /api/scripts/{id}` with `If-Match` |
| `duplicate(id)` | `Script` | not_found | `POST /api/scripts/{id}/duplicate` |
| `remove(id)` | `void` | not_found | `DELETE /api/scripts/{id}` |
| `savePosition(id, pos)` | `void` | network | `PUT /api/scripts/{id}/position` |

Pin / archive / rename are `update` patches (`pinned`, `archivedAt`, `title`).

## AccountPort
| Method | Returns | Errors | HTTP (later) |
|---|---|---|---|
| `updatePrefs(patch)` | `User` | validation | `PATCH /api/user/preferences` |
| `updateReading(settings)` | `User` | validation | `PUT /api/user/reading` |
| `exportData({password})` | `Blob` (`tilw-account-v1.json`) | invalid_credentials | `POST /api/user/export` |
| `changePassword({current, next})` *(G5)* | `void` | invalid_credentials, validation | `PUT /user/password` |
| `deleteAccount({password})` *(G4)* | `void` | invalid_credentials | `DELETE /api/user` |

## Device-only (no port)
- `LegacyPort.scan()` → `LegacyScript[]` — reads old keys only after consent; adding one calls `ScriptsPort.create`. Phase 1's mock returns the two sample scripts in `seed.ts` (`LEGACY_SCRIPTS`).
- `TakesRepo` (IndexedDB): `list()`, `get(id)`, `put(take)`, `remove(id)`, `estimate()`.

## Mock behaviour knobs (`/__mock`, dev only)
`latencyMs` (default 300), `failRate`, `forceConflictOnNextSave`, `expireTokens`, `offline`, and an
"outbox" listing the reset/invite links that would have been emailed.

## Later deltas
- **Feature 004 (phone link)** adds `LinkPort`, `LinkRelayPort` and `RealtimePort`, and the `/__mock` phone-link knobs (offline tab, end reason, mock Tilw app). See `specs/004-phone-link/contracts/ports.md`.
- **Feature 005 (AI writing tools)** adds `AiPort` and `SpeechPort`, and the `/__mock` AI knobs (formatting mode, speech provider, own key refused, grant, set balance, edit from another device, expire suggestion). See `specs/005-ai-writing-tools/contracts/ports.md`.
