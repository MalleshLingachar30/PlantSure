import Link from 'next/link'
import { VisitTimeline, plantSureStorySequence } from '@feedbacknfc/plantsure-ui'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1080px] px-6 py-10 sm:py-14">
      <header className="border-b pb-7" style={{ borderColor: 'var(--rule)' }}>
        <p className="eyebrow">PlantSure</p>
        <h1 className="page-title mt-3">Product scaffold</h1>
        <p className="body-copy mt-3 max-w-[62ch]">
          The build contract is still missing locally. This scaffold sets up the
          app shell and shared timeline package without inventing schema or cron
          behaviour.
        </p>
      </header>

      <section className="py-9" aria-labelledby="timeline-heading">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">First component</p>
            <h2 id="timeline-heading" className="section-title mt-2">
              Visit timeline
            </h2>
          </div>
          <Link
            href="/plantsure/timeline"
            className="text-[14px] underline-offset-4 hover:underline"
            style={{ color: 'var(--ink-soft)' }}
          >
            Open scratch page
          </Link>
        </div>

        <VisitTimeline
          sequence={plantSureStorySequence}
          labelledBy="timeline-heading"
          caption="The demo sequence is nine checked visits and eleven overdue visits."
        />
      </section>
    </main>
  )
}
