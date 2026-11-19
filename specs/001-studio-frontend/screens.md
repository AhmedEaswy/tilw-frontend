# Screen Inventory → Routes

Figma file `t9xEIr22yKOj7o2Ft32hxb`, page `02 · Prototype`. Node ids are `6:xx`
(open with `?node-id=6-xx`). ★ = sent by the owner as the build order. Phone / English / compact
variants are responsive or locale states of the same route, not separate pages.

## Public & auth

| Route | State | Figma | Notes |
|---|---|---|---|
| `/` | Landing | 6:2 · 6:3 en · 6:4 phone | Already built from the v4 artifact |
| `/demo` | Reader demo playing / paused | 6:6–6:17 (ar, en, phone) | Try without account |
| `/contact` | Contact | 6:5 | |
| `/signin` | Sign in | ★6:62 · 6:100 phone | "Forgot password" link |
| `/forgot-password` | Request reset | 6:101 phone | Desktop variant not drawn — reuse 6:62 frame |
| `/forgot-password/sent` | Check your email | 6:102 phone | |
| `/reset-password?token=` | Set new password / success / expired | built from 6:62 / 6:100 | G2 — approved, T022 |
| `/invite/:token` | Create account / expired / used | built from 6:62 / 6:100 | G1 — approved, T031–T032 |
| `/waitlist` | Join waitlist | ★6:63 | |
| `/waitlist/confirmed` | You're on the list | ★6:64 | |
| `/privacy` | Privacy policy | ★6:81 | Full Arabic document |
| `/terms` | Terms of use | ★6:82 | Full Arabic document |

## App shell — `/app/**` (top nav: نصوصي · تسجيلاتي · الإعدادات; phone uses bottom tabs)

| Route | State | Figma | Notes |
|---|---|---|---|
| `/app/scripts` | Library | ★6:18 · 6:20 phone · 6:83 en | Last opened, search, filters, sort |
| | Pinned filter | 6:112 | |
| | Archived filter | 6:111 phone | |
| | Empty library | ★6:22 | |
| | New script dialog | ★6:23 · 6:84 en | |
| | Import dialog | ★6:24 · 6:85 en | |
| | Sort dialog | ★6:25 | |
| | Script actions sheet | 6:108 phone | rename · duplicate · TXT · pin · archive |
| | Rename dialog | 6:109 phone | |
| | Download TXT dialog | 6:110 phone | |
| `/app/scripts/:id` | Editor | ★6:19 · 6:21 phone · 6:86 en | Writing tools, delivery marks |
| | Conflict: compare | ★6:72 | |
| | Conflict: confirm replace | ★6:73 | |
| `/app/scripts/:id/rehearse` | Paused / playing | ★6:26 · 6:27 · 6:31–6:32 phone · 6:87–6:90 en | |
| | Reading settings | ★6:28 · 6:29 manual · 6:33–6:34 phone · 6:36 landscape · 6:37 tablet · 6:105–6:106 320px · 6:91–6:98 en | Side panel / sheet |
| | More controls | ★6:30 · 6:35 phone · 6:107 320px · 6:93/96/99 en | |
| | Position not saved | ★6:79 | |
| | Choose paragraph | ★6:80 | |
| `/app/scripts/:id/record` | Camera: before permission | ★6:38 · 6:40 phone | Mode switch audio / video |
| | Camera: preview | ★6:39 · 6:41 phone | Device pickers |
| | Audio: before permission | ★6:50 · 6:52 phone | |
| | Audio: sound check | ★6:51 · 6:53 phone | |
| | Countdown | ★6:42 · 6:54 · 6:43/6:55 phone | |
| | Recording | ★6:44 · 6:56 · 6:45/6:57 phone | Stop & save, 10-min cap |
| | Permission denied | ★6:78 phone | Desktop variant not drawn |
| `/app/recordings` | Browser originals list | ★6:74 · 6:103 phone | |
| | First visit (empty) | ★6:77 | |
| `/app/recordings/:takeId` | Video take review | ★6:46 · 6:47 phone | |
| | Audio take review | ★6:58 · 6:75 · 6:59 phone | |
| | Download requested | ★6:48 · 6:60 · ★6:76 · 6:49/6:61 phone | |
| `/app/settings` | Preferences | ★6:65 · 6:104 phone | Language, theme, account, reading, export, legacy, legal, sign out |
| `/app/settings/export` | Confirm password → handoff | ★6:66 → ★6:67 | `tilw-account-v1.json` |
| `/app/settings/recover` | Consent → choose → confirm | ★6:68 → ★6:69 → ★6:70/6:71 | Legacy browser scripts |
| `/app/settings/account` | Edit name, change password | built from 6:65 + 6:62 fields | G5 — approved, T093 |
| `/app/settings/delete` | Confirm password → done → signed out | built from 6:66 → 6:67 pattern | G4 — approved, T094 |

## Other pages in the file (reference only)
- `01 · Design system` (0:1) — tokens and components: implement first as `app/assets/css/tokens.css` + base components.
- `03 · Current experience`, `05 · Finesse / Brand comparison` — historical, not built.
- `04 · Marketing / Product story`, `06 · Selected / Two-screen studio` — landing direction; the landing is already built.
