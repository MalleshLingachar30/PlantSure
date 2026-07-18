import Link from 'next/link'
import { notFound } from 'next/navigation'
import { confirmSiteCounts } from '../../actions'
import {
  type AdminAuditWindow,
  getAdminSiteDetail,
} from '@/lib/admin-data'
import {
  type VisitTimelineEntry,
  VisitTimeline,
} from '@/components/visit-timeline'

export const dynamic = 'force-dynamic'

export default async function AdminSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ confirmed?: string }>
}) {
  const [{ siteId }, { confirmed }] = await Promise.all([params, searchParams])
  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const locked = site.status === 'counts_confirmed'
  const monitoringEndPreview = site.monitoringEnd ?? addYears(site.plantingDate, 5)
  const timeline = timelineFromWindows(site.windows)

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1080px] px-5 py-6 sm:px-6 lg:py-8">
        <header className="border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
          <Link href="/admin" className="eyebrow hover:underline">
            Site registration
          </Link>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="site-id">{site.locationId}</p>
              <h1 className="page-title mt-2">{site.name}</h1>
              <p className="body-copy mt-2">
                {site.village}, {site.taluk}, {site.district}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <Metric label="Planted" value={site.plantedCount.toLocaleString()} />
              <Metric label="Date" value={site.plantingDate} />
              <Metric label="Checks" value={site.windowsCount.toString()} />
              <Metric label="Records" value={site.generatedEventsCount.toString()} />
            </dl>
          </div>
        </header>

        {confirmed && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Counts locked</p>
            <p className="mt-2 font-medium">Twenty checks were written to the register.</p>
          </div>
        )}

        <div className="mt-7 grid gap-7 lg:grid-cols-[380px_1fr]">
          <section className="admin-panel" aria-labelledby="gate-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Gate</p>
                <h2 id="gate-heading" className="section-title mt-1">
                  Confirm planting details
                </h2>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-6">
              <dl className="grid grid-cols-2 gap-4 border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
                <div>
                  <dt className="eyebrow">Status</dt>
                  <dd className="mt-1 font-medium">
                    {locked ? 'Counts confirmed' : 'Counts open'}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Monitoring</dt>
                  <dd className="mt-1 font-medium">
                    {site.monitoringEnd ? `To ${site.monitoringEnd}` : 'Not started'}
                  </dd>
                </div>
              </dl>

              {locked ? (
                <div>
                  <p className="body-copy">
                    These planting details are confirmed. The planted count is locked
                    and future checks compare against it.
                  </p>
                </div>
              ) : (
                <form action={confirmSiteCounts} className="grid gap-5">
                  <p className="body-copy">
                    Once you confirm, these numbers go on the site board and cannot be
                    edited afterwards. Every future check compares against them.
                  </p>
                  <ul className="fact-list">
                    <li>
                      Print {site.plantedCount.toLocaleString()} plants on the site
                      board, permanently
                    </li>
                    <li>
                      Schedule 20 checks from {site.plantingDate} to{' '}
                      {monitoringEndPreview}
                    </li>
                    <li>Start the five-year monitoring period</li>
                  </ul>
                  <input type="hidden" name="siteId" value={site.id} />
                  <label className="field">
                    <span>Monitoring start</span>
                    <input
                      className="input"
                      name="monitoringStart"
                      type="date"
                      defaultValue={site.plantingDate}
                      required
                    />
                  </label>
                  <button className="command-button" type="submit">
                    Confirm planting details
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="admin-panel" aria-labelledby="timeline-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Five years</p>
                <h2 id="timeline-heading" className="section-title mt-1">
                  Check schedule
                </h2>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <VisitTimeline
                sequence={timeline}
                labelledBy="timeline-heading"
                caption={
                  locked
                    ? `${site.windowsCount} scheduled checks exist in Postgres.`
                    : 'Checks are created only after counts are confirmed.'
                }
              />
            </div>
          </section>
        </div>

        {site.windows.length > 0 && (
          <section className="admin-panel mt-7" aria-labelledby="windows-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Register</p>
                <h2 id="windows-heading" className="section-title mt-1">
                  Scheduled checks
                </h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Due</th>
                    <th>Grace</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {site.windows.map((window) => (
                    <tr key={window.sequenceNumber}>
                      <td className="mono">{window.cycleLabel}</td>
                      <td>{window.dueDate}</td>
                      <td>{window.graceUntil}</td>
                      <td>{statusText(window.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-line">
      <dt className="eyebrow">{label}</dt>
      <dd className="mono mt-1 text-[14px]">{value}</dd>
    </div>
  )
}

function timelineFromWindows(windows: AdminAuditWindow[]): VisitTimelineEntry[] {
  if (windows.length === 0) {
    return []
  }

  return windows.map((window) => ({
    state: window.status === 'completed' ? 'done' : window.status === 'missed' ? 'overdue' : 'scheduled',
    label: `${window.cycleLabel}: ${statusText(window.status)}`,
  }))
}

function statusText(status: string): string {
  if (status === 'scheduled') {
    return 'Scheduled'
  }

  if (status === 'completed') {
    return 'Checked'
  }

  if (status === 'missed') {
    return 'No one visited'
  }

  if (status === 'waived') {
    return 'Not required'
  }

  return status
}

function addYears(dateString: string, years: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const target = new Date(Date.UTC(year + years, month - 1, day))

  return target.toISOString().slice(0, 10)
}
