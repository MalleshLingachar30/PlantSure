# PlantSure

PlantSure is the FeedbackNFC plantation monitoring product.

The product rule:

> An audit that doesn't happen must produce a record, not a silence.

## Workspace

```text
apps/web                  Next.js app for the PlantSure product
packages/plantsure-ui     Shared PlantSure UI primitives
plantsure-landing/        Existing deployed landing checkout, ignored here
```

The landing page is intentionally parked. Shared product UI should move through
`@feedbacknfc/plantsure-ui`, then the app and landing page can consume the same
timeline without two copies.

## Run

```bash
npm install
npm run dev
npm run check
```

## Current blocker

`plantsure-phase1-build.md` is not present in this checkout. Do not implement
schema, cron, lifecycle, or confirm-counts logic until that build contract is
available.

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind, shadcn-ready component
structure, Drizzle, Postgres, Clerk, Recharts, MapLibre, Workbox, Dexie, Vercel
Cron, and `@feedbacknfc/sdm`.
