# Tilw Prompter Frontend Constitution

## Core Principles

### I. Arabic-first, bilingual by construction
Arabic (RTL) is the default locale; English (LTR) is a full peer, not a translation afterthought.
Every screen MUST render correctly in both directions using logical CSS properties
(`inline-start/end`, `padding-inline`, etc.) and MUST NOT hard-code user-facing strings —
all copy lives in locale files. Mixed-direction script text is supported per script.

### II. Figma is the source of truth for UI
Screens are implemented from the "Tilw Prompter · Studio redesign" Figma file (page `02 · Prototype`).
Design tokens (colour, type, spacing, radius) come from page `01 · Design system` and are expressed
once as CSS custom properties. Deviations from Figma MUST be recorded in the spec's gap list,
never silently improvised. Where Figma has no screen, the gap is raised for design before build,
unless it is a trivial system state (loading, generic error) that reuses existing components.

### III. Frontend-only behind a swappable data port (NON-NEGOTIABLE for this phase)
The app talks to data exclusively through typed service interfaces (`AuthPort`, `ScriptsPort`,
`AccountPort`, ...). Phase 1 ships a mock adapter (in-browser persistence + simulated latency and
failures). The Laravel API adapter replaces it later with no UI changes. Components and stores
MUST NOT call `fetch` or touch storage directly.

### IV. Recordings never touch Tilw's servers
Audio/video takes are stored in the browser (IndexedDB) and downloaded as original files. When the
person links their own storage (Google Drive first) and chooses manual or auto sync, the app MAY
upload takes directly from the browser to that storage; take bytes MUST NOT be sent to, proxied by,
or stored on the Tilw API, which holds take metadata only. Sync is off by default, and a take is
never deleted from the device because an upload failed.
Camera and microphone are requested only on explicit user action in the recording studio, and the
app MUST remain usable (write, rehearse) when permission is denied.

### V. Eyes on the lens — reading surfaces stay calm
The rehearsal and recording surfaces prioritise legibility and zero-surprise controls: keyboard
shortcuts (Space, Esc, arrows), no layout shift while reading, reduced-motion respected, and
reading position is never lost silently (recovery screens exist for that).

### VI. Accessible and testable
WCAG 2.2 AA contrast and keyboard reachability for all interactive elements. Every user story has
an independent acceptance test (Vitest for stores/services, Playwright for flows) running against
the mock adapter.

## Technology Constraints
- Nuxt 4 + Vue 3 + TypeScript (strict). Pinia for state. `@nuxtjs/i18n` for ar/en.
- Plain CSS with design tokens (matching the existing landing page); no CSS framework.
- Marketing routes are SSR/prerendered; `/app/**` runs client-side only.
- No third-party analytics or trackers (privacy policy promises essential cookies only).

## Development Workflow
- Spec Kit flow: constitution → specify → clarify → plan → tasks → implement, one screen group at a time.
- Each screen group is reviewed against its Figma frame (screenshot diff by eye) before merge.
- Gaps found during implementation are appended to `specs/<feature>/gaps.md` with a proposed resolution.

## Governance
This constitution overrides ad-hoc choices. Amendments are made by editing this file with a version
bump and a note in the commit message. Reviews check principles II, III and IV explicitly.

**Version**: 1.1.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-22

Amendment 1.1.0 (2026-11-22, release 2): principle IV changed from "Recordings never leave the device"
to "Recordings never touch Tilw's servers" to allow opt-in backup to the person's own storage
(owner decision, `release-2-plan.md`).
