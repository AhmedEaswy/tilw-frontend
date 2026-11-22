# Design gaps — accounts, plans & storage (release 2)

**Status (2026-11-22, revised after owner review)**: Figma file `t9xEIr22yKOj7o2Ft32hxb`, page **`07 · Release 2 · Plans & storage`** (`249:100`).

**Owner rule**: pages that already exist keep their release-1 design. Each release-2 frame for an existing page is an **exact copy of the release-1 frame** from `02 · Prototype` with only the subscription parts added. Plans always use the **home-page plans poster** (`index.vue` `#plans`), not a new card design.

## Existing pages — copy + additions only

| # | Page | Copied from | Figma frame | What was added |
|---|---|---|---|---|
| R2-2 | Script library, active-script limit | `6:18` | `262:790` | "20 من 20 نصاً نشطاً" next to Import; limit dialog built from the New-script dialog `6:23` (Archive a script / Upgrade to Pro) |
| R2-3 | Script editor, read-only over limit | `6:19` | `262:893` | Status chip "للقراءة فقط"; sand banner above the page; Marks and Undo dimmed; "السجل" added to writing tools |
| R2-9 | Script editor, History | `6:19` | `262:954` | "السجل" in writing tools; History drawer in the reading-settings drawer style (`6:28`): versions, read-only preview, Restore |
| R2-7 | Recordings, Drive status | `6:74` | `262:1018` | Existing **Storage status** component (`5:180`) on every take: In Google Drive / On this device / Backup failed · Drive full / In Drive only (take from another device); "نسخ إلى Drive" link; storage mode line |
| R2-7 | Take review, back up | `6:46` | `264:676` | Status chip; "نسخ إلى Google Drive" secondary action; "حذف المحاولة" link |
| R2-8 | Take review, delete choice | `6:46` | `264:732` | Delete dialog from `6:23`: delete from device and Drive / device only / cancel |
| R2-6 | Recording setup, Free | `6:39` | `264:798` | Footer: "مدة المحاولة حتى 10 دقائق · حتى 60 في Pro" |
| R2-6 | Recording setup, Pro | `6:39` | `264:885` | Footer: 60 minutes; hint "تُنسخ المحاولة إلى Google Drive تلقائياً بعد الحفظ" |
| R2-6 | Recording, Pro cap | `6:44` | `264:972` | "الحد الأقصى 60 دقيقة" |
| R2-1 | Settings | `6:65` | `264:1017` | Two rows in the existing row style: Plan & usage, Storage; plan name in the account card |
| R2-12 | Delete account, done | `6:66` (task card) | `264:1106` | Copy: deletion date in 14 days, sign in to cancel, what stays |
| R2-10 | `/confirm-email` success and expired | `6:66` (task card) | `264:1125`, `264:1144` | New page in the existing task-card layout |
| — | Rehearsal (`6:26`…) | — | — | **No change**: nothing in rehearsal depends on the plan |

## Plans (home-page poster)

| # | Screen | Figma frame | Notes |
|---|---|---|---|
| R2-13 | Landing `#plans` | `259:692` | Captured from the running home page, then only: "Plus" → "Pro", price row with monthly / yearly switch ($77 / year, $8 / month), Free and Pro feature lines from the plan limits, CTA "احصل على Tilw Pro" |
| R2-4 | Upgrade to Pro (in app) | `264:1321` | The same poster in a dialog over Plan & usage; Free CTA becomes "خطتك الحالية", Pro CTA "متابعة على واتساب" |

## New pages (no release-1 frame; built in the settings page style of `6:65`)

| # | Screen | Figma frame | Notes |
|---|---|---|---|
| R2-1 | Plan & usage, Free | `252:179` | Plan card in the account-card style; usage meters; AI credits row greyed until feature 004 |
| R2-5 | Plan & usage, request pending | `252:297` | Reference TLW-7K3Q, reopen WhatsApp, cancel request (also the fallback when WhatsApp did not open) |
| R2-5 | Plan & usage, Pro ending soon | `252:381` | Banner + what changes when back on Free |
| R2-6 | Storage, not linked / linked | `254:501`, `254:564` | What Tilw can see in Drive; Off / Manual / Auto (Auto locked with Pro tag on Free); space meters |
| R2-10/11 | Account: email change pending + devices | `255:724` | The account page exists in code (T093) without a frame; review against the built page before build |

Local helper components on the page (`R2 / Studio header`, `R2 / Settings row`, `R2 / Usage meter`, `R2 / Sync badge`, `R2 / Banner`) are used only by the new pages above. Existing pages use the release-1 components (Action, Glyph, Storage status).

Not drawn: phone layouts, dark theme and English. They follow the matching release-1 frames (`6:20`, `6:103`, `6:104`, `11:*` dark, `6:83`+ English) with the same additions.

Notes:
- "Pending-deletion banner": signing in cancels deletion on the service (backend 002, US7), so a signed-in person never sees a pending deletion; it is the one-time "deletion cancelled" notice instead.
- Prices in frames are the starting values; real values come from the service.
