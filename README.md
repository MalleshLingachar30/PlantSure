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

## Product specs

Read these in order:

1. `plantsure-phase1-build.md`
2. `plantsure-frontend-spec.md`
3. `plantsure-mockup.html`

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind, shadcn-ready component
structure, Drizzle, Postgres, Clerk, Recharts, MapLibre, Workbox, Dexie, Vercel
Cron, and `@feedbacknfc/sdm`.
