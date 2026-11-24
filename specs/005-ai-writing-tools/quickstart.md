# Quickstart: AI writing tools (web)

## Mock (no backend)

```powershell
$env:NUXT_PUBLIC_SERVICES_MODE='mock'; npx nuxt dev --port 3140
```

Sign in with the seeded account (see `services/mock/seed.ts`). Then:

1. **Format**: open a script → writing tools → **Format for reading** → cost (Free: 20 credits) → **Format** → preview → **Apply**. History shows an "AI change". On `/__mock`, set *AI formatting* to `changed_words` or `unavailable` and try again: the message says the credits were refunded.
2. **Credits**: Settings → **AI & credits**. Entries list the monthly 20, the charge and any refund. `/__mock` → *Speech* `overrun`, dictate once, and see the negative balance banner.
3. **Dictate**: editor → **Dictate** → allow the microphone → speak → **Stop** → confirm the cost → the fake text is inserted at the caret.
4. **New from audio**: Scripts → **New from audio** → pick an audio file → confirm → **Save as new script**.
5. **Own key**: AI & credits → own key → paste any 20+ character key → saved as `••••last4`. Format again: "your own key, no credits". `/__mock` → *Own key refused* to see the refused flows.
6. **Captions**: Recordings → a take → **Captions** → confirm → download SRT and VTT.

## Against the backend

Run the backend with `AI_FAKE=true` (backend `specs/004-ai-writing-tools/quickstart.md`), then:

```powershell
$env:NUXT_PUBLIC_SERVICES_MODE='http'; npx nuxt dev --port 3140
```

With `AI_FAKE`, permissions come back with `upload.provider = fake`; the web app doesn't upload and completes with `fake-<seconds>`.

## Tests

```powershell
npx vitest run
```

```powershell
npx nuxi typecheck
```

```powershell
$env:E2E_PORT='3140'; $env:NUXT_PUBLIC_SERVICES_MODE='mock'; npx playwright test
```
