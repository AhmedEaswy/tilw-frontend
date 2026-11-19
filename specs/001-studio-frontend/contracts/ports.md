# Service Port Contracts

UI and stores depend only on these interfaces. Phase 1: `services/mock/*`. Later: `services/http/*`
mapped to the Laravel routes in the right-hand column (proposed — backend not built yet).

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
- `LegacyStore.scan()` → `LegacyScript[]` — reads old keys only after consent; adding one calls `ScriptsPort.create`.
- `TakesRepo` (IndexedDB): `list()`, `get(id)`, `put(take)`, `remove(id)`, `estimate()`.

## Mock behaviour knobs (`/__mock`, dev only)
`latencyMs` (default 300), `failRate`, `forceConflictOnNextSave`, `expireTokens`, `offline`, and an
"outbox" listing the reset/invite links that would have been emailed.
