import { notFound } from 'next/navigation'
import { getPublicSiteByLocationId } from '@/lib/admin-data'
import { displayDate } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const site = await getPublicSiteByLocationId(decodeURIComponent(locationId))

  if (!site) {
    notFound()
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-6 lg:py-10">
      <article className="public-card mx-auto" aria-labelledby="public-site-heading">
        <p className="eyebrow">PlantSure</p>

        <header className="mt-8 border-b pb-6" style={{ borderColor: 'var(--rule)' }}>
          <h1 id="public-site-heading" className="page-title">
            {site.name}
          </h1>
          <p className="body-copy mt-2">
            {site.village}, {site.district}
          </p>
          <p className="site-id mt-4">{site.locationId}</p>
        </header>

        <dl className="public-facts">
          <div>
            <dt>Plants</dt>
            <dd className="big-number">{site.plantedCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Planted</dt>
            <dd>{displayDate(site.plantingDate)}</dd>
          </div>
          {site.speciesNotes && (
            <div>
              <dt>Species</dt>
              <dd>{site.speciesNotes}</dd>
            </div>
          )}
          <div>
            <dt>Programme</dt>
            <dd>{site.programName}</dd>
          </div>
          <div>
            <dt>Monitoring</dt>
            <dd>
              {site.monitoringEnd
                ? `To ${displayDate(site.monitoringEnd)}`
                : 'Not started'}
            </dd>
          </div>
        </dl>

        <section className="border-t pt-6" style={{ borderColor: 'var(--rule)' }}>
          <p className="eyebrow">Last checked</p>
          {site.latestAudit ? (
            <div className="mt-3 grid gap-2">
              <p className="section-title">{displayDate(site.latestAudit.auditedAt)}</p>
              <p className="body-copy">
                {site.latestAudit.survivingCount.toLocaleString()} of{' '}
                {site.plantedCount.toLocaleString()} alive
              </p>
              <p className="mono text-[14px]">
                {site.latestAudit.survivalRate}% survival ·{' '}
                {site.latestAudit.photoCount} photos
              </p>
            </div>
          ) : (
            <p className="body-copy mt-3">
              No checks recorded yet. The first check is scheduled from the confirmed
              planting date.
            </p>
          )}
        </section>
      </article>
    </main>
  )
}
