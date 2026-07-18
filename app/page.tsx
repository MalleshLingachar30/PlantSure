import Link from 'next/link'
import {
  VisitTimeline,
  plantSureStorySequence,
} from '@/components/visit-timeline'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1080px] px-6 py-10 sm:py-14">
      <header className="border-b pb-7" style={{ borderColor: 'var(--rule)' }}>
        <p className="eyebrow">PlantSure</p>
        <h1 className="page-title mt-3">Plantation monitoring</h1>
        <p className="body-copy mt-3 max-w-[62ch]">
          Register a planted site, confirm the count once, and turn the five-year
          maintenance promise into dated checks.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin" className="command-button">
            Open registration
          </Link>
          <Link
            href="/plantsure/timeline"
            className="inline-flex min-h-[42px] items-center px-2 text-[14px] underline-offset-4 hover:underline"
            style={{ color: 'var(--ink-soft)' }}
          >
            View timeline
          </Link>
        </div>
      </header>

      <section className="py-9" aria-labelledby="timeline-heading">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">First component</p>
            <h2 id="timeline-heading" className="section-title mt-2">
              Visit timeline
            </h2>
          </div>
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
