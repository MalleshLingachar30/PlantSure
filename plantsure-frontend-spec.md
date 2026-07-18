# PlantSure — Frontend Spec (Phase 1)

**For:** gg
**Scope:** Every screen in Phase 1, with layout, copy, and states.
**Stack:** Next.js 15 App Router · Tailwind · shadcn/ui · Recharts · Lucide icons

Read this alongside `plantsure-phase1-build.md` (schema + cron). This document covers only what the user sees.

---

## 1. Who is actually using this

Three people. None of them are us. Build for them, not for the demo.

**Ravi — retired forest officer, 61, inspector.**
Standing in a field. Entry-level Android. 2G, sometimes nothing. Sun on the screen. He'll use this four times a year, so he relearns it every time. **He types one number and leaves.** If it takes more than five minutes, he goes back to his notebook.

**Priya — CSR manager, 34, sponsor.**
Opens this once a quarter, before a meeting. Needs one screen that tells her whether the money worked, and whether anything needs her attention. **She is not going to read a table of twenty-four rows.** She wants to know: is anything wrong?

**Suresh — IAFT programme desk, 45.**
Lives in this daily. Manages sites across four districts. Needs to see what's slipping before the sponsor does. **He's the one who gets the missed-audit email**, and this is where he comes to act on it.

---

## 2. Language rules

The single biggest thing that makes this feel professional is **not using our vocabulary in the interface.**

Our schema has `plantation_audit_windows` with a `status` enum. Ravi has never heard of a window. He has a visit that's due.

| Never write this | Write this |
|---|---|
| Audit window | Visit · Scheduled check |
| Window status: missed | Check overdue · No one visited |
| Location ID | Site ID |
| Baseline lock / counts confirmed | Confirm planting details |
| Survival rate | Plants alive · Survival |
| Band: critical | Needs attention |
| Threshold breach | Below target |
| Evidence capture | Photos |
| GPS status: questionable | Location unclear |
| Escalation | Notify IAFT |
| Batch, commitment, ledger, heartbeat | *(never appears in UI at all)* |
| Submit | Save check |

Rules:
- **Sentence case everywhere.** Never Title Case. Never ALL CAPS except the site ID.
- **Active voice.** "Save check", not "Submit audit record."
- **The same word for the same thing, everywhere.** If it's a "check" on the form, it's a "check" on the dashboard and a "check" in the email.
- **No exclamation marks. No emoji. No congratulation.** This is an instrument.
- **Numbers over adjectives.** "487 of 600 alive" beats "good survival."

### Copy for the hard parts

**Overdue check** — factual, not accusatory. Nobody is a villain; someone got busy.
> No one has checked this site since 12 March. The Year 2 check was due 12 June.

**Confirming planting details** — this is irreversible, so say so plainly.
> Once you confirm, these numbers go on the site board and can't be edited. The board is printed from them, and every future check compares against them.

**Empty dashboard**
> No sites yet. Register your first plantation site to start monitoring.

**Failed sync**
> 3 checks saved on this phone. They'll upload when you have signal.

Never: "Oops!", "Something went wrong", "Please try again later."

---

## 3. Design direction

**The instrument, not the app.**

The reference is a field logbook and a laboratory instrument — something that records what happened, plainly, and whose plain readings are trustworthy *because* it's capable of showing bad news. Not a startup dashboard. Not a nature charity. No stock photos of hands holding saplings.

The one thing this interface must feel is **honest**. It's selling the idea that a missed check will be visible. So the design should never look like it's selling anything.

### Tokens

```css
/* Surface — paper, not white. Warm, matte, field-notebook. */
--paper:        #FAF9F5;   /* page */
--card:         #FFFFFF;   /* raised */
--rule:         #E5E2D9;   /* hairlines */
--rule-strong:  #C9C5B8;   /* emphasis */

/* Ink */
--ink:          #1F1E1B;   /* primary */
--ink-soft:     #5F5D55;   /* secondary */
--ink-faint:    #8B887E;   /* labels, hints */

/* Status — earned, not decorative. Use ONLY for status. */
--alive:        #3B6D11;   /* on target */
--alive-bg:     #EAF3DE;
--watch:        #854F0B;   /* below target */
--watch-bg:     #FAEEDA;
--overdue:      #A32D2D;   /* no one visited — the loudest thing on screen */
--overdue-bg:   #FCEBEB;

/* Structure */
--radius:       6px;       /* restrained. this is a document, not a toy. */
--radius-card:  10px;
```

**The palette has exactly three status colours and no brand colour.** There is no purple button. There is no gradient. Colour in this interface means *one* thing: the state of a site. If everything is fine, the screen is nearly monochrome. That's the point — **colour appearing means something happened.**

### Type

```
Display / headings   Instrument Serif  — or Source Serif 4 (Google, free)
Body / UI            Inter
Data / IDs / counts  IBM Plex Mono
```

Why: the serif gives it the register of a report rather than a SaaS product. The mono on IDs and counts is functional — `KA-TMK-GUB-000123` is unreadable in a proportional face, and a mono column of numbers can be scanned down.

```
Site ID           14px  IBM Plex Mono   letter-spacing 0.02em
Page title        24px  Source Serif    weight 400
Section heading   17px  Source Serif    weight 400
Body              15px  Inter           weight 400   line-height 1.6
Label / eyebrow   12px  Inter           weight 500   letter-spacing 0.04em  uppercase  --ink-faint
Big number        32px  IBM Plex Mono   weight 500   tabular-nums
```

**`font-variant-numeric: tabular-nums` on every number.** Non-negotiable. Columns of counts that don't align read as amateur.

### The signature element

**The visit timeline.**

Twenty dots. Five years. One row.

```
Y1  ●─●─●─●    Y2  ●─●─○─◐    Y3  ○─○─○─○    Y4  ○─○─○─○    Y5  ○─○─○─○
                        ↑
                     overdue
```

```
●  filled, --alive        check done
◐  half, --ink-faint      due now
○  hollow, --rule-strong  scheduled
●  filled, --overdue      no one visited
```

This is the whole product in one component. It's on the site page, it's in the sponsor dashboard, it's the screenshot in the pitch deck. **A person can see five years of diligence — or one gap — without reading a word.**

Build it as `<VisitTimeline sequence={...} />`. Get it right; everything else is a table.

---

## 4. Screens

Eight. That's all of Phase 1.

```
/plantsure                          Programme list
/plantsure/programs/[id]            Programme dashboard        ← Priya lives here
/plantsure/programs/[id]/sites/new  Register site
/plantsure/sites/[id]               Site detail                ← the timeline
/plantsure/sites/[id]/confirm       Confirm planting details   ← the gate
/plantsure/sites/[id]/board         Site board (print)
/p/[locationId]                     Public page (QR lands here)
/p/[locationId]/check               Record a check             ← Ravi, mobile only
```

---

### 4.1 Programme dashboard — `/plantsure/programs/[id]`

Priya's screen. She opens it before a meeting and needs the answer in four seconds.

```
┌────────────────────────────────────────────────────────────────┐
│  Green Karnataka 2026                                          │
│  ABC Foundation · Monitored to July 2031                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2 sites have an overdue check                           │  │  ← only if >0
│  │  No one has visited since March. IAFT was notified       │  │
│  │  on 19 June.                              [ View sites ] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│    24          14,400        11,982         83.2%              │
│    sites       planted       alive          survival           │
│                                                                │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  SITES                                    [ Register a site ]  │
│                                                                │
│  Site ID              District   Planted  Alive  Survival Last │
│  ─────────────────────────────────────────────────────────────  │
│  KA-TMK-GUB-000123    Tumakuru       600    487    81.2%  Mar ● │
│  KA-TMK-GUB-000124    Tumakuru       600    561    93.5%  Jun ● │
│  KA-KLR-HSN-000088    Hassan         400    —        —    —    │
└────────────────────────────────────────────────────────────────┘
```

**Rules:**

1. **The overdue banner is the first thing on the page, or it isn't there at all.** No banner when everything is fine — the screen goes quiet. That contrast is what makes the banner mean something.
2. **Overdue sorts to the top of the table, always.** Regardless of the column being sorted.
3. **An overdue site is red even if its survival is 95%.** Unverified survival is a claim, not a fact — and the interface should say so. This is the single most important behaviour on the screen and the thing gg is most likely to get wrong. A green site with a red dot is correct.
4. Four stats, no cards, no icons. Big mono number, small label under.
5. Never a pie chart.

### 4.2 Site detail — `/plantsure/sites/[id]`

```
┌────────────────────────────────────────────────────────────────┐
│  ← Green Karnataka 2026                                        │
│                                                                │
│  KA-TMK-GUB-000123                          [ Board ] [ Print ]│
│  Gubbi site 1 · Gubbi, Tumakuru                                │
│                                                                │
│  ┌────────────────────────────┐  Planted     600   15 Jul 2026 │
│  │                            │  Alive       487   12 Mar 2027 │
│  │      [ map, static ]       │  Survival  81.2%   below target│
│  │                            │  Board   Installed  16 Jul 2026│
│  └────────────────────────────┘  Species  Mixed native         │
│                                                                │
│  ────────────────────────────────────────────────────────────  │
│  CHECKS                                                        │
│                                                                │
│  Y1 ●─●─●─●   Y2 ●─●─●─●   Y3 ○─○─○─○   Y4 ○─○─○─○  Y5 ○─○─○─○ │
│                       ↑ overdue                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Year 2, check 3 was due 12 June. No one has visited.    │  │
│  │  IAFT notified 19 June.                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  12 Mar 2027   487 alive   81.2%   Ravi K.   [2 photos]        │
│  14 Dec 2026   523 alive   87.2%   Ravi K.   [2 photos]        │
│  18 Sep 2026   578 alive   96.3%   Ravi K.   [3 photos]        │
└────────────────────────────────────────────────────────────────┘
```

- Timeline sits above the history — the shape first, the detail after.
- Photos are thumbnails, click to lightbox. Don't build a gallery.
- Survival trend chart: **skip in Phase 1.** Three data points isn't a trend. The timeline already carries it.

### 4.3 Confirm planting details — `/plantsure/sites/[id]/confirm`

**The most dangerous screen in the product.** It prints the board and generates all twenty checks. It cannot be undone.

```
┌────────────────────────────────────────────────────────────────┐
│  Confirm planting details                                      │
│  KA-TMK-GUB-000123 · Gubbi site 1                              │
│                                                                │
│  These numbers go on the site board and can't be edited        │
│  afterwards. Every future check compares against them.         │
│                                                                │
│  Plants planted     [ 600        ]                             │
│  Planting date      [ 15 Jul 2026]                             │
│  Species            [ Mixed native species        ]            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Confirming will:                                        │  │
│  │  · Print 600 plants on the site board, permanently       │  │
│  │  · Schedule 20 checks from Jul 2026 to Jul 2031          │  │
│  │  · Start the five-year monitoring period                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [ Cancel ]                      [ Confirm planting details ]  │
└────────────────────────────────────────────────────────────────┘
```

- Confirm button is `--ink`, not red. This isn't dangerous — it's **permanent**. Different feeling.
- **No modal on top.** The whole screen is the confirmation. A modal trains people to click through.
- Consequences are listed as facts, not warnings. No ⚠️.

### 4.4 Record a check — `/p/[locationId]/check`

Ravi's screen. **Mobile only.** Design at 380px and never look at it on a desktop.

```
┌──────────────────────────┐
│  Gubbi site 1            │
│  KA-TMK-GUB-000123       │
│  Year 2, check 3         │
│                          │
│  ─────────────────────   │
│                          │
│  Planted                 │
│  600                     │  ← 32px mono. read-only.
│                          │
│  How many are alive?     │  ← the only question
│                          │
│  ┌────────────────────┐  │
│  │       487          │  │  ← 40px. numeric keypad.
│  └────────────────────┘  │     autofocus. huge tap target.
│                          │
│  81.2%  ·  below target  │  ← live, updates as he types
│                          │
│  ─────────────────────   │
│                          │
│  Photos                  │
│  [ 📷 ]  [ 📷 ]  [ + ]   │  ← min 2. camera only.
│                          │
│  Location captured ✓     │  ← never blocks
│                          │
│  Notes (optional)        │
│  [                    ]  │
│                          │
│  ┌────────────────────┐  │
│  │    Save check      │  │  ← full width. 56px tall.
│  └────────────────────┘  │
└──────────────────────────┘
```

**Non-negotiable:**

1. **One number.** Everything else is prefilled, captured, or optional. If gg adds a second required field, the form is wrong.
2. **Live survival %** as he types. He catches his own typo before saving. Costs nothing, saves a bad record.
3. **GPS never blocks.** Capture it, show a tick, move on. Show "Location unclear" if accuracy is poor — and still let him save. **A blocked inspector in a field with no signal stops using the product permanently.**
4. **Camera only**, no gallery picker.
5. **56px minimum tap targets.** He's 61, outdoors, possibly wearing glasses.
6. **Works offline.** Save goes to the queue. He sees "Saved. Will upload when you have signal." — same confirmation either way. He must never know or care.
7. **No spinner over the save.** Optimistic. The record is on his phone; it's safe.

**Pending queue** — top of screen, only when >0:
```
┌──────────────────────────┐
│ 3 checks saved on this   │
│ phone. Uploading when    │
│ you have signal.  [Retry]│
└──────────────────────────┘
```

### 4.5 Public page — `/p/[locationId]`

Where the QR lands. Anyone can see it — villager, sponsor, journalist.

```
┌──────────────────────────┐
│  PLANTSURE               │
│                          │
│  Gubbi site 1            │
│  Gubbi, Tumakuru         │
│  KA-TMK-GUB-000123       │
│                          │
│  600 plants              │
│  Planted 15 July 2026    │
│  Mixed native species    │
│                          │
│  ABC Foundation          │
│  Monitored to July 2031  │
│                          │
│  ─────────────────────   │
│  Last checked            │
│  12 March 2027           │
│  487 of 600 alive        │
│                          │
│  [ photo ]  [ photo ]    │
│                          │
│  ─────────────────────   │
│  [ Record a check ]      │  ← authorised only
└──────────────────────────┘
```

- **Never shows:** inspector name or contact, internal notes, exact GPS, contractor details.
- **Manual entry fallback**, if the QR is faded and they typed the ID: same page, works identically.
- "Monitored to July 2031" is the public promise. Leave it prominent.

### 4.6 Site board — `/plantsure/sites/[id]/board`

Server-rendered PDF. Preview on screen, download to print.

```
┌────────────────────────────────┐
│  PLANTSURE                     │
│  ────────────────────────────  │
│                                │
│  KA-TMK-GUB-000123             │  ← 48pt mono. readable at 2m.
│                                │     NOT only in the QR.
│  ABC Foundation                │
│  Green Karnataka 2026          │
│  Gubbi, Tumakuru               │
│                                │
│  600 plants · 15 July 2026     │
│  Mixed native species          │
│                                │
│      ┌────────────┐            │
│      │            │            │
│      │    [QR]    │  Scan to   │
│      │            │  view      │
│      └────────────┘            │
│                                │
│  Monitored to July 2031        │
└────────────────────────────────┘
```

**The human-readable ID must be large.** Boards fade, get mud-splattered, get vandalised. When the QR won't scan, Ravi types the ID and the check still happens. **A damaged board must never block a visit.**

---

## 5. Components to build

Ten. Everything else is composition.

```
<VisitTimeline sequence={...} />     ← the signature. get this right first.
<SiteIdBadge id="KA-TMK-GUB-000123" copyable />
<StatusDot status="alive|watch|overdue|scheduled" />
<StatCell value={11982} label="alive" />
<OverdueBanner windows={[...]} />
<SiteTable rows={[...]} />           ← overdue always sorts first
<CheckForm site={...} window={...} />
<PhotoCapture min={2} />             ← camera only
<PendingQueue count={n} onRetry={} />
<BoardPreview site={...} />
```

---

## 6. Quality floor

Not optional, not "if there's time."

- **Mobile first on `/p/*`.** Ravi's screens are designed at 380px. Desktop is the afterthought there — the opposite of everywhere else.
- **Tabular numerals on every number.** `font-variant-numeric: tabular-nums`.
- **Keyboard focus visible.** Suresh uses this all day; he'll tab.
- **Colour never carries meaning alone.** Every status dot has a text label beside it. Red-green colour blindness is ~8% of men, and our audience is mostly men over 40.
- **`prefers-reduced-motion` respected.**
- **No layout shift** when the overdue banner appears. Reserve nothing, but don't jump.
- **Empty states are written**, not `No data`.

---

## 7. What gg should build in order

1. **`<VisitTimeline />` in isolation.** Storybook or a scratch page. Get all five states right — done, due, scheduled, overdue, waived. **This is the product; build it first and the rest follows.**
2. Tokens + type scale as CSS vars. Nothing else until this is settled.
3. Site table with the overdue-sorts-first rule.
4. Programme dashboard around it.
5. Site detail.
6. Confirm screen.
7. **Check form on mobile — test on a real cheap Android in sunlight, not in Chrome devtools.**
8. Public page.
9. Board PDF.

---

## 8. The test

Not "does it look good." Ask:

> **Can Priya tell in four seconds whether anything needs her attention?**
> **Can Ravi record a check in under two minutes, one-handed, in the sun?**
> **When a check is missed, does the screen look different without anyone touching it?**

If yes to all three, ship it. If the answer to the third is no, nothing else matters.

---

## 9. The one thing to get right

The interface has exactly one job that the schema can't do: **make a missed check impossible to overlook.**

Everything else — the serif, the mono, the paper background — is in service of that. A quiet, monochrome, document-like screen exists so that when one dot turns red, **the person cannot un-see it.**

If the design ends up busy, or colourful, or full of cards and icons and badges, that red dot becomes just another element and the product stops working. **Restraint is the feature here, not the taste.**
