# Implementation Plan: Web app — phone link (release 2)

**Branch**: `004-phone-link` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md); backend feature `backend/specs/003-phone-link` ([openapi.yaml](../../../backend/specs/003-phone-link/contracts/openapi.yaml), [realtime.md](../../../backend/specs/003-phone-link/contracts/realtime.md)), complete on backend branch `003-phone-link`; Figma frames to be drawn, listed in [gaps.md](./gaps.md).

## Summary

The work adds phone link to the studio without changing release-1 reading layouts:

- a **Connect phone** panel and link indicator on the rehearse and record pages;
- a public **remote page** (`/remote`) for a phone browser with no account;
- the studio acting as the **reading device** for incoming commands;
- **Settings → Phone links**, and a phone link row on Plan & usage.

Data goes through three new ports (constitution III):

- `LinkPort`: the owner's actions.
- `LinkRelayPort`: party actions with a session or a `rl_` credential.
- `RealtimePort`: the live channel.

The HTTP adapter maps the backend 003 routes and uses `pusher-js` against Reverb. The mock adapter runs a full link between two tabs of the same browser over `BroadcastChannel`.

Commands reach the reader and recorder through a **player registry**: each reading page registers a player that calls the same functions as its own controls. That way remote commands and keyboard shortcuts share one code path, and the link can never stop a take. Decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5, Nuxt 4.6 (unchanged)

**Primary Dependencies**: existing (`pinia`, `@nuxtjs/i18n`, `idb-keyval`, `zod`, `@vueuse/core`), plus **`pusher-js` 8** (realtime client, dynamically imported only when a link opens; research R1) and **`uqr`** (QR as SVG, zero dependencies; R2). Neither is an analytics or tracking script, and both are bundled, not loaded from a CDN.

**Storage**:

- Studio: server state only (Pinia).
- Phone: `localStorage['tilw:remote:v1']` holds the pairing for up to 10 minutes after last use, and `localStorage['tilw:remote:locale']` holds the language choice.
- Mock: KV key `tilw:mock:links:v1`, presence in memory only.

**Testing**:

- Vitest for stores (link, remote), state coalescing, refusal mapping, the recorder-safety rule (R14), and one port contract suite run against the mock and the HTTP adapter (fake fetch and fake Pusher).
- Playwright flows per story with two pages in one browser context (studio and phone) against the mock.
- `test:live` runs the port suite against backend 003 with Reverb.

**Target Platform**: evergreen browsers. Studio: desktop and tablet. Remote: phone browsers from 320×568 (iOS Safari 16+, Android Chrome). Screen Wake Lock where supported; Web Locks with a BroadcastChannel fallback (as the release-2 upload queue does).

**Project Type**: web application (static Nuxt build), frontend repository only

**Performance Goals**:

- A command shows as done on the phone within 0.5 s for 95 % of commands with the real service (SC-002).
- State updates are coalesced to at most one request every 150 ms (the backend allows 10 a second).
- The remote page is interactive in under 2 s on 4G. `pusher-js` and `uqr` are kept out of the main studio bundle.

**Constraints**:

- Reading surfaces don't change size or focus when the link status changes (principle V).
- With previews off, no script text other than the title leaves the studio. The backend strips previews too.
- The remote page makes no account calls and stores only the pairing.
- Every new string is in Arabic and English.

**Scale/Scope**:

- 1 new public route (`/remote`) and 1 new settings section (Phone links).
- 1 panel, 1 indicator and 1 shared controls component.
- About 6 changed files (the rehearse and record pages, Settings, Plan & usage, `utils/limits.ts`, `/__mock`).
- 2 new stores (`link`, `remote`), 3 new ports, 2 new packages.

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1.* Constitution v1.1.0.

| Principle | How the plan satisfies it | Result |
|---|---|---|
| I. Arabic-first, bilingual | All copy goes in `i18n/locales/{ar,en}.json` under `link.*` and `remote.*`, with logical CSS throughout. The remote page defaults to Arabic and uses English only when the phone's language is English (FR-016, R9). Previews keep the script's own text direction. | Pass |
| II. Figma is the source of truth | Figma has no phone-link frames yet (G3). The frames listed in [gaps.md](./gaps.md) are drawn on page `08 · Release 2 · Phone link` from the design-system page **before any screen task starts** (the first task in tasks.md). Trivial states reuse existing components. | Pass, with that task first |
| III. Swappable data port | `LinkPort`, `LinkRelayPort` and `RealtimePort` have mock and HTTP adapters and one shared contract suite. Stores and components never import `pusher-js`, `fetch` or `BroadcastChannel` directly; only `services/http/realtime.ts` and `services/mock/realtime.ts` do. | Pass |
| IV. Recordings never touch Tilw's servers | Phone link carries control messages only. No take bytes, no camera on the phone (the phone's own camera app reads the QR), and the backend refuses link bodies over 4 KB. The link store has no access to the recorder (R14). | Pass |
| V. Calm reading surfaces | A small masthead indicator. Requests appear as a non-modal popover next to it, and during countdown or recording only as a badge (R13). Shortcuts keep working, and incoming commands don't move focus. | Pass |
| VI. Accessible and testable | Each story has a two-page Playwright flow on the mock, and axe runs on the panel and the remote page. Remote targets are at least 44×44, and status changes are announced through a polite live region. | Pass |

**Result**: PASS. Post-design re-check: unchanged. The ports and stores add no constitution exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/004-phone-link/
├── spec.md, checklists/
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: types, events, stores, mock data
├── contracts/ports.md   # Phase 1: port delta (LinkPort, LinkRelayPort, RealtimePort)
├── quickstart.md        # Phase 1
├── gaps.md              # Figma frames to draw + gaps found while building
└── tasks.md             # /speckit-tasks
```

### Source Code (changes in `frontend/`)

```text
app/
├── services/
│   ├── ports.ts                 # + LinkPort, LinkRelayPort, RealtimePort; Services + links, relay, realtime
│   ├── types.ts                 # + PhoneLink, Pairing, LinkCommand, LinkAck, StudioState, LinkEvent, LinkAuth, …;
│   │                            #   PortErrorCode + 'partner_offline'
│   ├── http/
│   │   ├── client.ts            # + 'partner_offline' in CODES
│   │   ├── index.ts             # + links/relay routes (bearer header for LinkAuth remote)
│   │   └── realtime.ts          # pusher-js (dynamic import), customHandler auth via the client
│   └── mock/
│       ├── link.ts              # links, codes, remotes, roles, rules as the backend (R11)
│       ├── realtime.ts          # BroadcastChannel socket, heartbeats, presence, offline knob
│       └── index.ts             # + links/relay/realtime; mock Tilw app remote
├── stores/
│   ├── link.ts                  # studio side (data-model: useLinkStore)
│   └── remote.ts                # phone side (data-model: useRemoteStore)
├── composables/
│   ├── useLinkPlayer.ts         # player registry + changed() → coalesced state
│   ├── useHostTab.ts            # Web Lock 'tilw-link-host' + BroadcastChannel 'tilw-link' (R8)
│   └── useWakeLock.ts           # screen wake lock while connected
├── components/link/
│   ├── ConnectPanel.vue         # QR, code, countdown, status, remote, previews, roles, end
│   ├── LinkIndicator.vue        # masthead dot + label + badge, opens the panel
│   ├── LinkRequest.vue          # non-modal popover: second phone / role swap
│   ├── QrCode.vue               # uqr → inline SVG
│   ├── RemoteControls.vue       # shared by /remote and the swapped studio (R10)
│   └── LinkHistory.vue          # Settings → Phone links list
├── layouts/remote.vue           # minimal: brand, language switch, no studio chrome
├── pages/
│   ├── remote.vue               # public phone remote (ssr: false, noindex)
│   ├── app/scripts/[id]/rehearse.vue   # + indicator, panel, useLinkPlayer
│   ├── app/scripts/[id]/record.vue     # + indicator, panel, useLinkPlayer (record start/stop)
│   ├── app/settings/index.vue   # + Phone links section
│   └── __mock.vue               # + phone link knobs (offline tab, mock Tilw app, clock)
├── utils/limits.ts              # KNOWN_LIMITS + 'phone_link.allowed'
nuxt.config.ts                   # routeRules '/remote': { ssr: false }; runtimeConfig.public.realtime
i18n/locales/{ar,en}.json        # + link.*, remote.*
tests/unit/link-*.test.ts, remote-store.test.ts
tests/e2e/link.spec.ts           # two pages per story
```

**Structure Decision**: keep the release-1 layering (ports → stores → pages/components). The only new pattern is the player registry. Pages stay the owners of the reader engine and recorder, and they lend them to the link through `apply` and `snapshot`, so release-1 reading code isn't moved. `/remote` sits outside `/app` because the phone has no account. The plugin's `unauthenticated` redirect only acts on `/app` paths already, and `relay`/`realtime` are left unguarded (contracts/ports.md).

## Complexity Tracking

No constitution violations. Two new dependencies are justified in research R1 (`pusher-js`: protocol, reconnect and presence) and R2 (`uqr`: the QR secret must not go to a third party). Both are bundled, have no network calls of their own beyond the configured realtime host, and load only when phone link is used.
