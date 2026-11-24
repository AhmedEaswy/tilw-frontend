# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Admin console (feature 006)

The admin console lives at `/admin` (spec: `specs/006-admin-console/`). Only admins can open it.

- **Mock mode:** sign in as `admin@example.com` (seed password in `app/services/mock/seed.ts`), or use **Sign in as admin** on `/__mock`. The admin knobs are on `/__mock` too.
- **Static hosting:** `/admin/**` is client-rendered like `/app/**`. The host must rewrite it to `200.html`.
- **Environment variables:**
  - `NUXT_PUBLIC_ENVIRONMENT` (`local`, `staging` or `production`) sets the badge in the console's top bar.
  - `NUXT_PUBLIC_SUPPORT_EMAIL` is named in the "account suspended" message.
