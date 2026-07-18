# PlantSure

PlantSure is the FeedbackNFC plantation monitoring product.

The product rule:

> An audit that doesn't happen must produce a record, not a silence.

## Layout

This is a plain Next.js app at the repository root. The landing page is
intentionally parked in its own repository; shared UI can be extracted later if
the app and landing page need to consume the same component.

## Run

```bash
npm install
npm run dev
npm run check
```

`npm run check` includes `npm run test:postgres`. Set `TEST_DATABASE_URL` to a
real Postgres database before running it; the migration invariant tests create
and drop an isolated temporary schema. Do not replace this with PGlite or a mock:
the baseline lock and append-only register are database trigger behavior.

For quick local iteration without Postgres:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

## Product specs

Read these in order:

1. `plantsure-phase1-build.md`
2. `plantsure-frontend-spec.md`
3. `plantsure-mockup.html`

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind, shadcn-ready component
structure, Drizzle, Postgres, Clerk, Recharts, MapLibre, Workbox, Dexie, Vercel
Cron, and `@feedbacknfc/sdm`.
