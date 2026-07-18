# PlantSure — Phase 1 Build Spec

**Scope:** Site registry → QR board → audit calendar → field audit → survival % → dashboard, **with missed audits recorded as a first-class fact.**

**Target:** 6–8 weeks on the existing FeedbackNFC codebase.
**Domain:** `plantsure.feedbacknfc.com`
**Stack:** Next.js 15 App Router · Drizzle · Postgres · Clerk · existing evidence storage.

---

## The one rule that defines Phase 1

> **An audit that does not happen must produce a record, not a silence.**

Everything below exists to serve that. If a tradeoff must be made, protect this.

---

## 1. What's in and what's out

| In Phase 1 | Deferred |
|---|---|
| Program | — |
| Site + Location ID + planted count | Batch IDs (add when a site replants) |
| QR board, generated after counts confirmed | NFC / SDM taps |
| Audit calendar, generated at registration | Sampling + confidence intervals |
| Mobile audit form: surviving count, photo, GPS | Species-wise survival |
| Survival % + band | Assurance Score |
| **Window status incl. `missed`** | Escalation levels L2–L5 |
| **Daily cron that marks missed + emails IAFT** | Advisories, tiers, certificates |
| Dashboard: green / amber / red per site | Reports, BRSR export |
| Offline queue | Kannada UI |
| Human-readable ID on board | Zones, correction workflow |

**Two things not to cut:**
- **Offline queue.** Rural, 2G, retired officers. One lost submission and the inspector never trusts the app again.
- **Human-readable Location ID on the board, large.** Faded QR must never block a visit. Manual entry is allowed; it's just marked as such.

---

## 2. Schema

Six tables. Drizzle, Postgres.

```
plantation_programs
plantation_sites
plantation_boards
plantation_audit_windows     ← the heartbeat
plantation_audits
plantation_window_events     ← append-only trail
```

### plantation_programs

```
id                        uuid pk
organization_id           uuid fk        -- the CSR sponsor org
name                      text
knowledge_partner_org_id  uuid fk null   -- IAFT
implementer_org_id        uuid fk null   -- NGO / contractor
monitoring_years          int  default 5
audit_frequency           enum('monthly','quarterly','half_yearly','annual')
                                         default 'quarterly'
survival_threshold        numeric default 85
escalation_email          text           -- IAFT programme desk. required.
status                    enum('active','closed') default 'active'
created_at / updated_at   timestamptz
```

`escalation_email` is **NOT NULL**. A program with nowhere to send a missed-audit notice is a program that cannot fail loudly. Enforce at insert.

### plantation_sites

```
id                    uuid pk
program_id            uuid fk
location_id           text unique        -- KA-TMK-GUB-000123
name                  text
district / taluk / village   text
latitude / longitude  numeric
planted_count         int
planting_date         date
species_notes         text null          -- free text in P1, structured later
status                enum('registered','counts_confirmed','board_generated',
                           'board_installed','monitoring','closed')
monitoring_start      date null          -- set at counts_confirmed
monitoring_end        date null          -- monitoring_start + monitoring_years
created_by_member_id  uuid fk
created_at / updated_at
```

### plantation_boards

```
id                 uuid pk
site_id            uuid fk unique
qr_url             text               -- https://plantsure.feedbacknfc.com/p/{location_id}
generated_at       timestamptz
generated_by       uuid fk
installed_at       timestamptz null
installed_by       uuid fk null
install_photo_url  text null
install_lat / install_lng  numeric null
status             enum('generated','installed','damaged','missing','replaced','retired')
```

### plantation_audit_windows

The heartbeat. **Generated in bulk when counts are confirmed** — all 20 rows at once, not on demand.

```
id                 uuid pk
site_id            uuid fk
sequence_number    int                 -- 1..N
cycle_label        text                -- 'Y1-Q1'
due_date           date
grace_until        date                -- due_date + 14
status             enum('scheduled','completed','missed','waived')
                                       default 'scheduled'
assigned_member_id uuid fk null
audit_id           uuid fk null        -- set on completion
missed_at          timestamptz null
notified_at        timestamptz null    -- idempotency guard for the cron
waiver_reason      text null
waived_by          uuid fk null
waived_at          timestamptz null

unique (site_id, sequence_number)
index on (status, due_date)            -- the cron scans this
```

### plantation_audits

```
id                  uuid pk
site_id             uuid fk
window_id           uuid fk null        -- null = ad-hoc audit outside a window
client_uuid         text unique         -- idempotency for offline replay
auditor_member_id   uuid fk
audited_at          timestamptz         -- device-claimed
received_at         timestamptz         -- server. authoritative.
access_method       enum('qr','manual')
planted_count       int                 -- snapshot at audit time
surviving_count     int
missing_count       int                 -- generated: planted - surviving
survival_rate       numeric             -- generated
band                enum('healthy','watch','poor','critical')  -- generated
latitude / longitude / gps_accuracy_m   numeric null
distance_from_site_m numeric null       -- computed server-side
gps_status          enum('confirmed','plausible','questionable','unavailable')
photo_urls          jsonb               -- min 2
remarks             text null
created_at
```

`missing_count`, `survival_rate`, and `band` are **generated columns**. Never let the client send a survival rate.

### plantation_window_events

Append-only. This is your evidence that the system was watching.

```
id           uuid pk
window_id    uuid fk
event_type   enum('generated','completed','missed','notified','waived','reopened')
detail       jsonb
actor        text          -- member id, or 'system'
created_at   timestamptz
```

**Never delete a `missed` event.** Not by admin, not by IAFT, not by Grobet. That permanence is the product.

---

## 3. Location ID

Format: `{STATE}-{DISTRICT}-{VILLAGE}-{SEQ}` → `KA-TMK-GUB-000123`

- 3-letter codes, uppercase, from a seeded Karnataka district/taluk table
- `SEQ` is a 6-digit zero-padded per-program sequence
- Generated **server-side only**, inside the transaction that creates the site
- Immutable once assigned. No edit path. Ever.
- Use a Postgres sequence or `SELECT ... FOR UPDATE` — not `count(*) + 1`

---

## 4. Lifecycle

```
site registered
   └─> plantation completed on ground
         └─> counts confirmed        ← IRREVERSIBLE. this is the gate.
               ├─> monitoring_start = today
               ├─> monitoring_end   = today + monitoring_years
               ├─> ALL audit windows generated (20 rows for 5yr quarterly)
               └─> board generation unlocked
                     └─> board printed + installed (photo + GPS)
                           └─> site status = monitoring
```

**Counts confirmed is the point of no return.** Board carries the counts; if you print before confirming, the board lies for five years. After confirmation, `planted_count` requires a correction workflow (Phase 2) — not an edit.

### Window generation

```ts
// runs inside the confirm-counts transaction
const windows = []
const cyclesPerYear = { monthly: 12, quarterly: 4, half_yearly: 2, annual: 1 }[freq]
const total = program.monitoring_years * cyclesPerYear

for (let i = 1; i <= total; i++) {
  const due = addMonths(monitoringStart, i * (12 / cyclesPerYear))
  windows.push({
    siteId, sequenceNumber: i,
    cycleLabel: `Y${Math.ceil(i / cyclesPerYear)}-Q${((i - 1) % cyclesPerYear) + 1}`,
    dueDate: due,
    graceUntil: addDays(due, 14),
    status: 'scheduled',
  })
}
await db.insert(plantationAuditWindows).values(windows)
```

All 20 rows exist from day one. **The five-year obligation is now a set of database rows with dates on them, not a sentence in a PDF.**

---

## 5. The cron

`/api/cron/audit-heartbeat` — daily, 06:00 IST. Vercel Cron.

**This job is the product.** Everything else is scaffolding around it.

```ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response('unauthorized', { status: 401 })

  const today = new Date()

  // 1. mark missed
  const missed = await db.update(plantationAuditWindows)
    .set({ status: 'missed', missedAt: today })
    .where(and(
      eq(plantationAuditWindows.status, 'scheduled'),
      lt(plantationAuditWindows.graceUntil, today),
    ))
    .returning()

  for (const w of missed) {
    await db.insert(plantationWindowEvents).values({
      windowId: w.id, eventType: 'missed', actor: 'system',
      detail: { dueDate: w.dueDate, graceUntil: w.graceUntil },
    })
  }

  // 2. notify IAFT — one digest per program, not per window
  const pending = await db.select().from(plantationAuditWindows)
    .where(and(
      eq(plantationAuditWindows.status, 'missed'),
      isNull(plantationAuditWindows.notifiedAt),
    ))

  const byProgram = groupBy(pending, w => w.programId)
  for (const [programId, windows] of byProgram) {
    await sendMissedAuditDigest(programId, windows)   // → program.escalation_email
    await db.update(plantationAuditWindows)
      .set({ notifiedAt: new Date() })
      .where(inArray(plantationAuditWindows.id, windows.map(w => w.id)))
    await db.insert(plantationWindowEvents).values(
      windows.map(w => ({ windowId: w.id, eventType: 'notified', actor: 'system' }))
    )
  }

  // 3. heartbeat ping — dead man's switch
  await fetch(process.env.HEARTBEAT_PING_URL!)

  return Response.json({ missed: missed.length, notified: pending.length })
}
```

### Non-negotiables for this job

1. **Idempotent.** Runs twice on the same day = same result. `notified_at` is the guard.
2. **Digest, not per-window email.** Ten missed windows in one program = one email listing ten sites. Per-window email = filtered to a folder by week two = the notification is dead.
3. **Dead man's switch.** Ping an external monitor (Healthchecks.io, cron-job.org) on every success. **If the cron dies silently, the product keeps looking fine while doing nothing — which is the exact failure you're selling against.** Alert on missed ping within 26h.
4. **Treat cron failure as P1.** Not a warning. The instrument has stopped.

### The email

Plain, factual, actionable. Not a marketing template.

```
Subject: PlantSure — 3 audits missed · Green Karnataka 2026

3 scheduled audits have passed their due date without a
recorded audit.

  KA-TMK-GUB-000123  Gubbi site 1    Y2-Q3  due 12 Jun  overdue 19d
  KA-TMK-GUB-000141  Gubbi site 4    Y2-Q3  due 12 Jun  overdue 19d
  KA-KLR-HSN-000088  Hassan north    Y1-Q4  due 20 Jun  overdue 11d

These sites are now amber on the programme dashboard.

Record the audits or log a documented reason:
https://plantsure.feedbacknfc.com/programs/{id}/windows

— PlantSure, automated. This notice is recorded permanently.
```

That last line matters. It tells the reader the record exists whether or not they act.

---

## 6. Board

Printed **after** counts confirmed.

```
┌──────────────────────────────────┐
│  PLANTSURE · VERIFIED SITE       │
│                                  │
│  KA-TMK-GUB-000123               │  ← 48pt+. readable at 2m.
│                                  │     NOT only inside the QR.
│  ABC Foundation                  │
│  Green Karnataka 2026            │
│  Gubbi, Tumakuru                 │
│  600 plants · 15 Jul 2026        │
│  Species: mixed native           │
│                                  │
│      ┌──────────┐                │
│      │  [ QR ]  │  Scan to view  │
│      └──────────┘                │
│                                  │
│  Monitored to Jul 2031           │  ← the commitment, in public
└──────────────────────────────────┘
```

- **Human-readable ID, large.** Faded QR → inspector types the ID → audit still happens (`access_method = 'manual'`).
- **"Monitored to 2031" on the board.** Any villager can see the promise. Cheap, and it works on you the way a gym membership card does.
- Generate as PDF server-side. Print spec (material, mounting, weatherproofing) is a separate doc.

---

## 7. Field audit

`/p/{locationId}` — public-safe by default; authorized inspector sees the audit CTA.

**Form. Six fields. Under 5 minutes.**

```
Site         KA-TMK-GUB-000123 · Gubbi site 1     [prefilled]
Planted      600                                  [prefilled, read-only]

Surviving    [ 487 ]                              ← the only number they type
Photos       [ camera ]  min 2, app camera only
GPS          auto-captured, shown, non-blocking
Remarks      [ optional ]

           → Survival: 81.2% · WATCH
             [ Submit ]
```

- **Surviving count is the only required input.** Everything else is derived or captured.
- Survival % shown live before submit — inspector self-checks a fat-finger.
- **GPS never blocks.** Capture, classify, flag. A blocked inspector in a field with no signal stops using the product.
- **App camera only** for photos, no gallery upload.
- Server timestamp is authoritative; store device time too and flag if they diverge > 48h.

### On submit

```
1. resolve window: nearest 'scheduled' window within ±30d of today
2. insert audit (idempotent on client_uuid)
3. window.status = 'completed', window.audit_id = audit.id
4. window_event: 'completed'
5. site band recomputed → dashboard
```

If no window is in range, the audit still saves with `window_id = null` (ad-hoc). Never reject a real audit for calendar reasons.

### Offline

```
cache:   assigned sites, planted counts, form schema
queue:   Dexie (IndexedDB). photos as Blobs, compressed to ≤400KB client-side.
sync:    background sync on reconnect
key:     client_uuid generated on device → server insert is idempotent
UI:      "3 audits pending upload" + manual retry
```

**One hard rule: the inspector must never lose work.** Everything else in offline can be crude.

---

## 8. Dashboard

Two screens. That's all Phase 1 needs.

### Program view

```
Green Karnataka 2026 · ABC Foundation

  24 sites · 14,400 planted · 11,982 surviving · 83.2% overall

  ● 18 healthy    ● 3 watch    ● 1 poor    ● 2 MISSED AUDIT

  ┌─────────────────────────────────────────────────┐
  │ ⚠ 2 sites have a missed audit window            │
  │   IAFT notified 19 Jun. No audit recorded.      │
  └─────────────────────────────────────────────────┘

  Site               District   Planted  Surviving  Survival  Last audit  Status
  KA-TMK-GUB-000123  Tumakuru       600        487     81.2%   12 Mar      ⚠ MISSED Y2-Q3
  KA-TMK-GUB-000124  Tumakuru       600        561     93.5%   14 Jun      ● healthy
```

**A missed audit is its own status, ranked alongside survival — not a footnote.** A site with 93% survival and a missed window is *not* green. Unverified survival is a claim, not a fact.

### Site view

Identity · map pin · board status · planted baseline · **window timeline** (done / due / missed) · audit history with photos · survival trend.

The window timeline is the thing you demo. Twenty dots, five years, and you can see at a glance whether anyone showed up.

---

## 9. Build order

| Wk | Work | Done when |
|---|---|---|
| 1 | Subdomain, middleware, Clerk redirects, route group, shell | Module boots at plantsure. |
| 2 | Schema, migration, Karnataka district seed, Location ID generator | IDs generate, unique, immutable |
| 3 | Program + site registration, counts confirm gate | Admin registers unaided |
| 3 | **Window bulk generation on confirm** | 20 rows appear at confirm |
| 4 | Board PDF, `/p/{locationId}` public page, install evidence | QR opens correct site |
| 5 | Audit form, GPS/photo, survival calc, window completion | Inspector audits in <5min |
| 6 | **Offline queue** | Airplane mode → submit → reconnect → synced |
| 6 | **Heartbeat cron + digest email + dead man's switch** | **Overdue window → amber + email, unattended** |
| 7 | Program + site dashboards | Totals match raw rows |
| 8 | Pilot hardening, Kannada field strings if time | — |

---

## 10. The pilot test

Run everything else. Then:

**Let one window go overdue on purpose. Touch nothing.**

- Does the window flip to `missed` on the cron's own?
- Does the site turn amber without anyone clicking?
- Does IAFT get the digest?
- Is the `missed` event still in `plantation_window_events` a week later, undeletable?

If yes → you can walk into a CSR office and say *"you don't have to trust that the audits happen — the system tells you when they don't."*

If no → you have a nicer spreadsheet.

That's the demo. One screen, one amber dot, one email nobody sent by hand.

---

## 11. Environment

```
DNS         plantsure.feedbacknfc.com → Vercel
Clerk       redirects for /sign-in, /sign-up, /plantsure
Cron        /api/cron/audit-heartbeat   daily 06:00 IST
CRON_SECRET set, checked on the route
HEARTBEAT_PING_URL  → Healthchecks.io, alert if no ping in 26h   ← P1 alert
Email       existing transactional sender
Storage     existing evidence path, private by default
```

---

## Closing note

Phase 1 is deliberately small. One program, one site type, one number the inspector types, one dashboard.

The only thing that isn't small is the cron — because **that's the only part a competitor can't ship in a fortnight, and the only part that answers the question a CSR head will actually ask.**

If IAFT is as reliable as expected, `missed` reads zero for five years. That empty column, generated by a system that was genuinely capable of showing failure, is stronger evidence than any assurance IAFT could write down.

Build the thermometer that can read a fever. Then hope it never does.
