import type { Metadata } from 'next'
import {
  VisitTimeline,
  type VisitTimelineEntry,
  plantSureStorySequence,
} from '@feedbacknfc/plantsure-ui'

export const metadata: Metadata = {
  title: 'Visit timeline · PlantSure',
  robots: { index: false, follow: false },
}

const activeSiteSequence: VisitTimelineEntry[] = [
  'done',
  'done',
  'done',
  'done',
  'done',
  'done',
  'due',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
]

const fiveStateSequence: VisitTimelineEntry[] = [
  { state: 'done', label: 'Checked on 15 July' },
  { state: 'done', label: 'Checked on 15 October' },
  { state: 'waived', label: 'Not required after flood damage' },
  { state: 'overdue', label: 'No one visited' },
  'due',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
  'scheduled',
]

export default function TimelineScratchPage() {
  return (
    <main className="mx-auto max-w-[1080px] px-6 py-10 sm:py-14">
      <header className="border-b pb-6" style={{ borderColor: 'var(--rule)' }}>
        <p className="eyebrow">PlantSure</p>
        <h1 className="page-title mt-3">Visit timeline</h1>
        <p className="body-copy mt-3 max-w-[62ch]">
          Twenty scheduled checks over five years. A missed check remains part
          of the record.
        </p>
      </header>

      <section className="py-9" aria-labelledby="demo-programme">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Demo programme</p>
            <h2 id="demo-programme" className="section-title mt-2">
              Green Karnataka 2021
            </h2>
            <p className="body-copy mt-1 text-[14px]">
              Sindhi Seva Samaj · IAFT + appointed NGO
            </p>
          </div>
          <div className="mono text-right text-[13px] leading-relaxed text-[var(--ink-soft)]">
            <div>600 plants</div>
            <div>9 checked · 11 overdue</div>
          </div>
        </div>

        <VisitTimeline
          sequence={plantSureStorySequence}
          labelledBy="demo-programme"
          caption="The first nine checks happened. From year three onward, the missed visits stay visible instead of becoming silence."
        />
      </section>

      <section
        className="border-t py-9"
        style={{ borderColor: 'var(--rule)' }}
        aria-labelledby="active-site"
      >
        <div className="mb-7">
          <p className="site-id text-[var(--ink-faint)]">
            KA-TMK-GUB-000123
          </p>
          <h2 id="active-site" className="section-title mt-2">
            Gubbi site 1
          </h2>
          <p className="body-copy mt-1 text-[14px]">
            Gubbi, Tumakuru · monitored to July 2031
          </p>
        </div>

        <VisitTimeline
          sequence={activeSiteSequence}
          labelledBy="active-site"
          caption="The next check is due now. Future checks are already scheduled."
        />
      </section>

      <section
        className="border-t py-9"
        style={{ borderColor: 'var(--rule)' }}
        aria-labelledby="all-states"
      >
        <div className="mb-7">
          <p className="eyebrow">State check</p>
          <h2 id="all-states" className="section-title mt-2">
            Five states
          </h2>
        </div>

        <VisitTimeline
          sequence={fiveStateSequence}
          labelledBy="all-states"
          caption="Checked, no one visited, due now, scheduled, and not required all remain visible in the same five-year record."
        />
      </section>
    </main>
  )
}
