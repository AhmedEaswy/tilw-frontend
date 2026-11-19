# Data Model (frontend view)

Server-owned entities are mocked in Phase 1 with the same shapes the Laravel API will return.

```ts
type Locale = 'ar' | 'en'
type Theme = 'system' | 'light' | 'dark'

interface User {
  id: string
  name: string                 // "ليان سالم"
  email: string
  locale: Locale
  theme: Theme
  reading: ReadingSettings     // account-wide (G15, decided): rehearsal and settings both write here
  createdAt: string
}

interface ReadingSettings {
  mode: 'constant' | 'manual'  // بسرعة ثابتة | يدوي
  wpm: number                  // 60..220, default 120
  fontSize: 'S' | 'M' | 'L' | 'XL'
  mirror: boolean
  lineWidth: 'narrow' | 'medium' | 'wide'
  countdownSec: 0 | 3 | 5
  // text direction is NOT here: it is per script (Script.direction), G15
}

interface Script {
  id: string
  title: string
  body: string                 // paragraphs separated by "\n\n"
  marks: DeliveryMark[]
  direction: 'auto' | 'rtl' | 'ltr'   // per script (G15); 'auto' detects from first strong character
  pinned: boolean
  archivedAt: string | null
  version: number              // optimistic concurrency → conflict screens 6:72/6:73
  updatedAt: string
  lastOpenedAt: string | null
  lastPosition: { paragraph: number; offset: number } | null
  // derived on client: wordCount, paragraphCount, estMinutes = wordCount / reading.wpm
}

interface DeliveryMark {
  id: string
  type: 'emphasis' | 'pause' | 'note'
  start: number                // char offset in body
  end: number                  // = start for pause
  pauseSec?: number
  note?: string
}

/** Device-only. Lives in IndexedDB key `tilw:take:<id>`; never sent to the server. */
interface Take {
  id: string
  scriptId: string
  scriptTitle: string          // snapshot, so the list survives script rename/delete
  number: number               // "المحاولة ٢"
  label?: string               // "الافتتاح الكامل"
  kind: 'audio' | 'video'
  mimeType: string             // video/mp4 | video/webm | audio/webm | audio/mp4
  durationMs: number
  sizeBytes: number
  starred: boolean             // G8
  createdAt: string
  blob: Blob
}

interface LegacyScript {        // read from old browser storage only after consent (6:68)
  key: string
  title: string
  kind: 'draft' | 'saved'
  body: string
}

// Server-side, mocked
interface WaitlistEntry { email: string; createdAt: string }
interface Invitation { token: string; email: string; expiresAt: string; usedAt: string | null }
interface PasswordReset { token: string; email: string; expiresAt: string; usedAt: string | null }
```

## Client state (Pinia)

| Store | Holds | Persists to |
|---|---|---|
| `auth` | `user`, `status: 'unknown'|'guest'|'authed'` | port (session) |
| `prefs` | locale, theme | cookie |
| `scripts` | list, filter, sort, query, lastOpenedId | port |
| `editor` | working copy, dirty, saveState (`idle|saving|saved|offline|conflict`), undo stack | port + localStorage draft |
| `reader` | settings, playing, paragraph, offset, saveError | port (settings, position) |
| `takes` | take metadata list, quota estimate | IndexedDB |

## Validation rules
- Email: RFC-lite regex, trimmed, lower-cased.
- Password: ≥ 8 chars (FR-007 pending clarification).
- Script title: 1–120 chars; body ≤ 200k chars; import file ≤ 1 MB, `text/plain` or `.txt`.
- WPM: 60–220 step 10.
