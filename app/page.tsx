import Link from 'next/link'
import { Reveal } from '@/components/reveal'
import {
  VisitTimeline,
  plantSureStorySequence,
} from '@/components/visit-timeline'

const allCheckedSequence = Array.from({ length: 20 }, () => 'done' as const)

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <PlatformEntry />
        <TheRecord />
        <Audiences />
        <Partners />
        <Enquiry />
      </main>
      <Footer />
    </>
  )
}

function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-sm"
      style={{
        borderColor: 'var(--rule)',
        background: 'rgba(250, 249, 245, 0.9)',
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--ink)] focus:px-3 focus:py-2 focus:text-[13px] focus:text-[var(--paper)]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
        <Link
          href="/"
          className="text-[15px] font-semibold"
          style={{ color: 'var(--ink)' }}
        >
          PlantSure
        </Link>
        <nav className="flex items-center gap-5" aria-label="Primary">
          <a
            href="#how"
            className="hidden text-[13.5px] underline-offset-4 hover:underline sm:inline"
            style={{ color: 'var(--ink-soft)' }}
          >
            How it works
          </a>
          <Link
            href="/p/KA-BNR-GUB-000002"
            className="hidden text-[13.5px] underline-offset-4 hover:underline sm:inline"
            style={{ color: 'var(--ink-soft)' }}
          >
            Public record
          </Link>
          <Link href="/admin" className="command-button min-h-[34px] px-3 py-1.5 text-[13px]">
            Open platform
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1080px] px-6 pb-20 pt-16 sm:pt-24">
      <Reveal>
        <p className="eyebrow">Plantation monitoring · Five-year assurance</p>
      </Reveal>

      <Reveal delay={80}>
        <h1 className="serif mt-5 max-w-[19ch] text-[38px] font-normal leading-[1.12] sm:text-[54px]">
          Every plantation is promised five years of care.
        </h1>
      </Reveal>

      <Reveal delay={160}>
        <p
          className="mt-6 max-w-[54ch] text-[17px] leading-[1.65] sm:text-[18px]"
          style={{ color: 'var(--ink-soft)' }}
        >
          Most get one. Not because anyone intended otherwise, but because
          nothing was watching in year three. PlantSure registers the site,
          prints the QR board, schedules every check, and keeps the record
          visible.
        </p>
      </Reveal>

      <Reveal delay={240}>
        <figure
          className="mt-14 rounded-[10px] border p-7 sm:p-9"
          style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
        >
          <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="mono text-[13px]">KA-BNR-GUB-000002</span>
            <span className="eyebrow">Live platform record</span>
          </figcaption>
          <p className="mb-7 text-[14px]" style={{ color: 'var(--ink-faint)' }}>
            600 plants · Gubbi, Bengaluru Rural · monitored to 2031
          </p>

          <VisitTimeline
            sequence={plantSureStorySequence}
            caption="Twenty checks are scheduled over five years. Nine happened in this story. The other eleven are not missing from the record; they are marked as the days nobody came."
          />
        </figure>
      </Reveal>

      <Reveal delay={320}>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/admin" className="command-button px-6 py-3 text-[15px]">
            Register a site
          </Link>
          <Link
            href="/p/KA-BNR-GUB-000002"
            className="text-[15px] underline-offset-4 hover:underline"
            style={{ color: 'var(--ink-soft)' }}
          >
            View sample public record
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

function Problem() {
  const years = [
    {
      n: 'Year 1',
      t: 'Everyone is watching',
      d: 'The planting is photographed, the report is filed, the cheque clears. Survival is high because attention is high.',
    },
    {
      n: 'Year 2',
      t: 'The coordinator moves on',
      d: 'The person who signed the commitment changes role. The obligation lives in a PDF that nobody opens.',
    },
    {
      n: 'Year 3',
      t: 'Silence looks like success',
      d: 'No visit means no report. No report means no bad news. The dashboard still shows year one, and it still looks green.',
    },
  ]

  return (
    <section
      className="border-y"
      style={{ background: 'var(--paper-deep)', borderColor: 'var(--rule)' }}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-20 sm:py-24">
        <Reveal>
          <p className="eyebrow">The gap</p>
          <h2 className="serif mt-4 max-w-[24ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
            Nobody decides to abandon a plantation. It just stops being
            anyone&apos;s job.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-3">
          {years.map((item, index) => (
            <Reveal key={item.n} delay={index * 90}>
              <div
                className="border-t pt-5"
                style={{ borderColor: 'var(--rule-strong)' }}
              >
                <span
                  className="mono text-[12px]"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  {item.n}
                </span>
                <h3 className="serif mt-2.5 text-[19px] font-normal">
                  {item.t}
                </h3>
                <p
                  className="mt-2.5 text-[15px] leading-[1.6]"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {item.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={280}>
          <blockquote
            className="serif mt-16 max-w-[46ch] border-l-2 pl-6 text-[21px] font-normal leading-[1.5] sm:text-[23px]"
            style={{ borderColor: 'var(--ink)' }}
          >
            An audit system that can only report good news isn&apos;t evidence.
            A thermometer that only reads normal isn&apos;t reassuring; it is
            broken.
          </blockquote>
        </Reveal>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      t: 'Register the site',
      d: 'Capture location, species, planting date, and the number of plants that actually went in the ground.',
    },
    {
      t: 'Confirm the count once',
      d: 'The planted count becomes locked, the permanent Location ID is allocated, and the five-year schedule is generated.',
    },
    {
      t: 'Print the site board',
      d: 'The board carries a large Site ID and QR code, so anyone standing at the plantation can open the public record.',
    },
    {
      t: 'Run scheduled checks',
      d: 'Each quarter has a window. Inspectors record the alive count and the system keeps every window event append-only.',
    },
    {
      t: 'Let missed checks stay visible',
      d: 'When a scheduled visit passes without evidence, the miss remains part of the record. That is what makes clean years worth trusting.',
    },
  ]

  return (
    <section id="how" className="mx-auto max-w-[1080px] px-6 py-20 sm:py-28">
      <Reveal>
        <p className="eyebrow">How it works</p>
        <h2 className="serif mt-4 max-w-[22ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
          Five steps. The fifth is the one that matters.
        </h2>
      </Reveal>

      <ol className="mt-14">
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <Reveal key={step.t} delay={index * 70}>
              <li
                className="grid grid-cols-[auto_1fr] gap-x-6 border-t py-7 sm:grid-cols-[auto_18ch_1fr] sm:gap-x-10"
                style={{
                  borderColor: last ? 'var(--overdue)' : 'var(--rule)',
                }}
              >
                <span
                  className="mono pt-0.5 text-[13px]"
                  style={{ color: last ? 'var(--overdue)' : 'var(--ink-faint)' }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3
                  className="serif col-start-2 text-[19px] font-normal leading-snug"
                  style={{ color: last ? 'var(--overdue)' : 'var(--ink)' }}
                >
                  {step.t}
                </h3>
                <p
                  className="col-start-2 mt-2.5 max-w-[56ch] text-[15px] leading-[1.65] sm:col-start-3 sm:mt-0"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {step.d}
                </p>
              </li>
            </Reveal>
          )
        })}
      </ol>
    </section>
  )
}

function PlatformEntry() {
  const entries = [
    {
      label: 'Admin',
      title: 'Onboard plantation sites',
      copy: 'Create local member rows, register a site, capture planted count, location, species, and monitoring dates.',
      href: '/admin',
      action: 'Open admin',
    },
    {
      label: 'Board',
      title: 'Print the QR board',
      copy: 'Once counts are confirmed, the board page prints the large Location ID and QR for the public record.',
      href: '/admin',
      action: 'Open site list',
    },
    {
      label: 'Public',
      title: 'Show the live record',
      copy: 'A QR scan opens the public page for the Location ID, backed by the same production database.',
      href: '/p/KA-BNR-GUB-000002',
      action: 'View sample',
    },
  ]

  return (
    <section
      className="border-y"
      style={{ background: 'var(--paper-deep)', borderColor: 'var(--rule)' }}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-20 sm:py-24">
        <Reveal>
          <p className="eyebrow">Integrated platform</p>
          <h2 className="serif mt-4 max-w-[24ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
            The landing page now points into the working product.
          </h2>
          <p
            className="mt-5 max-w-[58ch] text-[16px] leading-[1.65]"
            style={{ color: 'var(--ink-soft)' }}
          >
            The public story, admin onboarding, printed board, and QR record are
            part of one flow. The marketing page is no longer detached from the
            live PlantSure application.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <Reveal key={entry.title} delay={index * 90}>
              <Link
                href={entry.href}
                className="flex h-full flex-col rounded-[10px] border p-6 no-underline transition-colors hover:border-[var(--rule-strong)]"
                style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
              >
                <span className="eyebrow">{entry.label}</span>
                <h3 className="serif mt-4 text-[21px] font-normal leading-snug">
                  {entry.title}
                </h3>
                <p
                  className="mt-3 grow text-[15px] leading-[1.6]"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {entry.copy}
                </p>
                <span
                  className="mt-7 inline-flex text-[14px] underline-offset-4"
                  style={{ color: 'var(--ink)' }}
                >
                  {entry.action}
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function TheRecord() {
  return (
    <section className="mx-auto grid max-w-[1080px] items-center gap-14 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_420px]">
      <Reveal>
        <div>
          <p className="eyebrow">What you get</p>
          <h2 className="serif mt-4 max-w-[20ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
            A record you did not have to be told about.
          </h2>
          <p
            className="mt-6 max-w-[52ch] text-[16px] leading-[1.65]"
            style={{ color: 'var(--ink-soft)' }}
          >
            At the end of five years you have a survival figure and, standing
            behind it, the twenty dates on which somebody went and looked. Or
            did not.
          </p>
          <p
            className="mt-4 max-w-[52ch] text-[16px] leading-[1.65]"
            style={{ color: 'var(--ink-soft)' }}
          >
            A missed check cannot be deleted by anyone. It stays in the register
            and in the public history. That permanence is uncomfortable by
            design; it is the only reason the clean years mean anything.
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div
          className="rounded-[10px] border p-7"
          style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
        >
          <p className="eyebrow">The record, when it goes well</p>
          <div className="mt-6">
            <VisitTimeline
              sequence={allCheckedSequence}
              showLegend={false}
              caption="Twenty of twenty. Generated by a system that was fully capable of showing the opposite, which is precisely what makes it worth something."
            />
          </div>
          <div
            className="mt-7 border-t pt-6"
            style={{ borderColor: 'var(--rule)' }}
          >
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Checks missed</span>
              <span
                className="mono text-[30px] font-medium leading-none"
                style={{ color: 'var(--alive)' }}
              >
                0
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Audiences() {
  const cards = [
    {
      who: 'If you fund plantations',
      d: 'See whether your money is still doing something in year four without taking a report on trust.',
      pts: [
        'One screen before the board meeting',
        'Compliance gaps visible in the annual record',
        'Every site publicly verifiable by QR',
      ],
    },
    {
      who: 'If you plant and maintain',
      d: 'Know which sites are slipping before a sponsor asks, and prove diligence when the next programme is awarded.',
      pts: [
        'Confirmed counts lock the baseline',
        'Scheduled windows remove calendar drift',
        'Public records separate proof from claims',
      ],
    },
    {
      who: 'If you run a public programme',
      d: 'District and state visibility across many sites, with the same instrument applied uniformly to every implementer.',
      pts: [
        'Master data can be onboarded locally',
        'Location IDs remain unique across programmes',
        'Citizens can check any site themselves',
      ],
    },
  ]

  return (
    <section
      className="border-y"
      style={{ background: 'var(--paper-deep)', borderColor: 'var(--rule)' }}
    >
      <div className="mx-auto max-w-[1080px] px-6 py-20 sm:py-28">
        <Reveal>
          <p className="eyebrow">Who it is for</p>
          <h2 className="serif mt-4 max-w-[26ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
            The same record, read three ways.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.who} delay={index * 90}>
              <div
                className="flex h-full flex-col rounded-[10px] border p-7"
                style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
              >
                <h3 className="serif text-[19px] font-normal leading-snug">
                  {card.who}
                </h3>
                <p
                  className="mt-3 text-[15px] leading-[1.6]"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {card.d}
                </p>
                <ul
                  className="mt-6 space-y-2.5 border-t pt-6 text-[14px]"
                  style={{
                    borderColor: 'var(--rule)',
                    color: 'var(--ink-soft)',
                  }}
                >
                  {card.pts.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span
                        className="mt-[7px] block h-1 w-1 shrink-0 rounded-full"
                        style={{ background: 'var(--rule-strong)' }}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Partners() {
  return (
    <section className="mx-auto max-w-[1080px] px-6 py-16">
      <Reveal>
        <div className="grid gap-10 sm:grid-cols-[1fr_1px_1fr] sm:gap-14">
          <div>
            <p className="eyebrow">Scientific method</p>
            <h3 className="serif mt-3 text-[19px] font-normal">IAFT</h3>
            <p
              className="mt-2.5 max-w-[44ch] text-[15px] leading-[1.6]"
              style={{ color: 'var(--ink-soft)' }}
            >
              Sampling standards, health classification, and species benchmarks
              can be versioned in the platform so survival figures remain
              defensible years later.
            </p>
          </div>

          <div className="hidden sm:block" style={{ background: 'var(--rule)' }} />

          <div>
            <p className="eyebrow">Underlying technology</p>
            <h3 className="serif mt-3 text-[19px] font-normal">FeedbackNFC</h3>
            <p
              className="mt-2.5 max-w-[44ch] text-[15px] leading-[1.6]"
              style={{ color: 'var(--ink-soft)' }}
            >
              PlantSure runs on the same verification approach used for field
              operations: durable identifiers, public records, and evidence
              linked to the place where work happened.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Enquiry() {
  return (
    <section
      id="enquire"
      className="border-y"
      style={{ background: 'var(--paper-deep)', borderColor: 'var(--rule)' }}
    >
      <div className="mx-auto grid max-w-[1080px] gap-12 px-6 py-20 sm:py-24 lg:grid-cols-[1fr_420px]">
        <Reveal>
          <div>
            <p className="eyebrow">Next step</p>
            <h2 className="serif mt-4 max-w-[18ch] text-[28px] font-normal leading-[1.25] sm:text-[34px]">
              Start with one real site.
            </h2>
            <p
              className="mt-6 max-w-[50ch] text-[16px] leading-[1.65]"
              style={{ color: 'var(--ink-soft)' }}
            >
              The product is already connected to production auth, Neon
              Postgres, board printing, and public QR pages. The best next move
              is to register representative sites and validate the field
              workflow with actual users.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin" className="command-button">
                Open admin
              </Link>
              <Link href="/plantsure/timeline" className="secondary-button">
                View timeline demo
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div
            className="rounded-[10px] border p-7"
            style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
          >
            <p className="eyebrow">Contact</p>
            <div
              className="mt-6 space-y-4 text-[15px]"
              style={{ color: 'var(--ink-soft)' }}
            >
              <p>
                <a
                  href="mailto:ml@feedbacknfc.com"
                  className="underline underline-offset-4"
                >
                  ml@feedbacknfc.com
                </a>
              </p>
              <p>
                <a
                  href="tel:+917899910288"
                  className="mono underline underline-offset-4"
                >
                  +91 78999 10288
                </a>
              </p>
              <p className="border-t pt-5 text-[14px]" style={{ borderColor: 'var(--rule)' }}>
                Grobet India Agrotech Pvt Ltd
                <br />
                Malleswaram, Bengaluru 560003
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px]" style={{ color: 'var(--ink-faint)' }}>
          PlantSure, a FeedbackNFC product by Grobet India Agrotech
        </p>
        <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          CIN U62090KA2023PTC170106 · DPIIT DIPP257128
        </p>
      </div>
    </footer>
  )
}
