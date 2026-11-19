# Gap Analysis — does the design close the cycle?

**Product cycle**: discover → get access → write → rehearse → record → keep the original → come back.
**Verdict**: The core loop (write → rehearse → record → review → download) is well designed, including
the rarely-drawn states (conflict, position recovery, legacy recovery, permission denied, download handoff).
The cycle is **open at both ends**: there is no way to turn an invitation into an account, no way to finish
a password reset, and the product's headline promise ("هاتفك يتحكم") has no app screens at all.

Severity: 🔴 blocks the cycle · 🟠 breaks a promise made in landing/legal copy · 🟡 robustness/state gap.

| # | Gap | Severity | Evidence | Proposed resolution |
|---|---|---|---|---|
| G1 | **Invitation acceptance / account creation** — ✅ BUILT (T030–T033) | 🔴 | Waitlist (6:63/6:64) is the only entry; "Sign in" assumes an account | `/invite/:token`: name, password, terms checkbox → signed in → empty library. Expired/used invite state. Reuse the 6:62 auth frame. |
| G2 | **Set new password** after reset link, plus success and expired-link states — ✅ BUILT (T022) | 🔴 | Only request (6:101) and "check email" (6:102) exist | `/reset-password?token=`: new + confirm password; expired state with "request a new link". |
| G3 | **Phone remote control** — ⏸ DEFERRED — pairing (QR / short code), remote UI, connection lost/reconnect, which device is "reader" | 🔴 for the brand promise | Landing hero, remote card, plans list it as free; no app frame; page 06 node 149:382 says "تصور للميزة" (a visualisation of the feature) | Decide: (a) Phase 1 ships same-account remote via realtime backend later; frontend builds `/app/remote` + "connect phone" panel in rehearsal against a mock channel (BroadcastChannel between tabs); or (b) remove from marketing until built. Needs design. |
| G4 | **Delete account** — ✅ SCHEDULED T094 | 🟠 | Privacy & terms say "يمكنك حذف حسابك في أي وقت من الإعدادات" | Danger zone in `/app/settings` → confirm password → confirmation screen. |
| G5 | **Change password / name / email** — ✅ SCHEDULED T093 | 🟠 | Settings shows identity read-only | "Account" sub-page with edit name, change password (current + new). Email change can wait for backend. |
| G6 | **Tilw Plus** — ⏸ DEFERRED — AI line-break suggestion in editor, credit balance, upgrade, billing state | 🟠 | Landing plans + "تعرف على بلس داخل التطبيق" CTA points into the app | Decide scope. If in: editor "اقتراح توزيع الأسطر" panel (preview / apply / discard), credits chip, upgrade sheet. Payment is backend. |
| G7 | **Delivery-marks UI** (emphasis / pause / note) — panel, how marks look in editor, reader and recording | 🟠 | Editor has "علامات الإلقاء" button; landing shows highlighted words and "/ وقفة" chips | Draw the marks popover + rendered states; spec reuses landing visual language meanwhile. |
| G8 | **Take management & recording limits** — delete take, star best take, 10-min auto-stop, storage almost full / full, interrupted recording | 🟠/🟡 | Landing: "علّم الأفضل"; studio: "الحد الأقصى 10 دقائق"; privacy warns about clearing site data | Add take actions menu (download / star / delete with confirm), auto-stop toast, quota banner in recordings list, "recording interrupted — partial take saved" state. |
| G9 | **Script lifecycle end** — unarchive, permanent delete | 🟡 | Only "نقل إلى الأرشيف" drawn | Archived item actions: restore, delete permanently (confirm). |
| G10 | **System states** — offline, save failed, session expired, 404, generic error, loading skeletons | 🟡 | None drawn | Reusable status banner + full-page error component built from design-system tokens. |
| G11 | **Import errors & formats** — wrong type, empty, too large, encoding | 🟡 | 6:24 shows the happy path only | Inline error inside the import dialog. TXT only for Phase 1 (docx/srt later?). |
| G12 | **Reader end-of-script & desktop permission-denied** | 🟡 | Rehearsal stops where? Denied only drawn for phone (6:78) | End state: "انتهى النص" with restart / record. Desktop denied reuses 6:38 layout with message. |
| G13 | **English coverage for auth, recording, settings** | 🟡 | English frames exist only for library/editor/rehearsal | Build from locale files; review in browser rather than wait for frames. |
| G14 | **Onboarding after first sign-in** | 🟡 | Empty library is the first screen | Optional: one sample script ("افتتاحية الحلقة") seeded on account creation so rehearsal can be tried immediately. |
| G15 | **Account-level reading defaults vs per-script settings** — ✅ DECIDED | 🟡 | Settings links to "إعدادات القراءة"; rehearsal also edits them | Reading settings are account-wide: changes in rehearsal or settings save to the account. Only text direction is stored per script. |
| G16 | **Contact form** destination and anti-spam — ✅ PLACEHOLDER | 🟡 | 6:5 exists; footer email is a personal address | One config value `runtimeConfig.public.contactEmail` (placeholder `contact@example.com`) used everywhere. Replace before launch. |

## Decisions
- **Decided 2026-11-19**: G3 phone remote — **deferred**. G6 Tilw Plus — **deferred**. Phase 1 is a
  **static build** (no backend), data via the in-browser mock.

- **Decided 2026-11-19**: G1, G2, G4, G5 — **approved to build from the existing auth frame** (6:62 / 6:100)
  and settings frames (6:65, 6:66 → 6:67) without new Figma. Scheduled: G2 → T022 (US1), G1 → T030–T033 (US2),
  G5 → T093, G4 → T094 (US8).

- **Decided 2026-11-19**: G15 — reading settings (mode, WPM, font size, mirror, line width, countdown) are
  **account-wide**; **text direction is per script**. Applies in T061–T063 and T090.

- **Decided 2026-11-19**: G16 — use a **placeholder** contact address (`contact@example.com`) from a single
  config value; the personal address in Figma is not used. Replacing it is a pre-launch checklist item.

### Still open
- None. All owner decisions for Phase 1 are made; implementation can start at Phase 1 Setup.

## Found while building US5 (rehearsal, 2026-11-19)
- **Cue line size**: Figma draws the current line larger than its neighbours (56 vs 40 px). Built with one
  size for all lines and the current paragraph lit, so nothing reflows while the text scrolls (constitution V).
- **Font size and line width as steps**: the steppers show px (48, 640) but the data model stores
  `S|M|L|XL` and `narrow|medium|wide`. Mapped S/M/L/XL → 40/48/56/64 px and narrow/medium/wide → 520/640/760 px;
  phones scale the font to 62.5 % (48 → 30, as in 6:31).
- **Manual mode transport**: 6:29 still shows "تشغيل". In manual mode it is disabled and the WPM chip is
  hidden; Space and the arrows step paragraphs.
- **Rewind glyph** (6:26): goes back to the start of the current paragraph (or the previous one when already
  at its start). Figma doesn't say.
- **Shortcuts list** (6:30) shows Space and Esc only; the arrows (next/previous paragraph, Up/Down pace) are
  added as a third line.
- **Choose paragraph (6:80)** is drawn inside the app navigation; the reader has no navigation, so the card
  sits on the paper surface alone. "إغلاق" on 6:79 returns to the editor.
- **End of script (G12)**: built as proposed — "انتهى النص" over the glass with "من البداية" and
  "إعداد التسجيل".
- **Digits**: the reader uses Western digits in both languages, as the frames do ("الفقرة 2 من 3").
- **Dark theme**: the settings panel and recovery screens follow the app theme (paper tokens); Figma only
  has light versions.
- **Rehearsal countdown** uses the recording countdown frame (6:42 / 6:43) across the whole stage, under the
  reader's own header (no studio masthead or logo). The label reads "يبدأ التدريب بعد" instead of
  "يبدأ التسجيل بعد", because nothing is recorded. "إلغاء" and Esc cancel it.

## Found while building the shell (2026-11-19)
- **Account menu**: the profile initial in the header (6:18) now opens a menu with the name and email,
  "الملف الشخصي" (→ `/app/settings/account`, placeholder until T093), "الإعدادات", a "الوضع الداكن" switch,
  and "تسجيل الخروج". Figma has no frame for it; built from the design-system surfaces, switch and glyphs.
  The switch saves an explicit light or dark choice; going back to "system" stays in settings (T090).

## Found while building US6 (recording studio, 2026-11-19)
- **Badge and indicator copy**: the frames say "معاينة تجريبية" and "تسجيل تجريبي" (prototype wording). Built as
  "معاينة مباشرة" (live preview) and "جارٍ التسجيل" (recording) so a real take isn't labelled a trial.
- **Audio sound check (6:51)** shows a decorative waveform captioned "عينة توضيحية". Built as a live waveform
  from the microphone with "صوتك الآن".
- **Camera preview is mirrored** like a mirror; the recorded file is not. Figma doesn't say.
- **Desktop denied (G12)**: built as proposed — the 6:38 layout with the denied heading, "إعادة المحاولة",
  "متابعة التدريب" and the permissions help in the side panel. The help itself (steps dialog) has no frame.
- **G8 states built without frames**: a take stops and is saved on its own at 10:00, when the tab is hidden or
  the device disconnects, and when browser storage would run out; each shows a toast. The last minute shows
  "متبقٍ 00:59" in place of "الحد الأقصى 10 دقائق". If saving to the browser fails, a dialog offers to download
  the file at once. A low-storage banner shows in setup under 200 MB free.
- **Countdown before a take** uses the account-wide countdown setting (6:30 "Set the delay before starting a
  take"); "بدون" starts recording at once.
- **After "إيقاف وحفظ"** the studio opens "تسجيلاتي". The take review screen (6:46 / 6:58) comes in T081.
- **"تغيير النص"** goes to the library; there is no in-studio script picker in Figma.

