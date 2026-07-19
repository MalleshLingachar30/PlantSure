import { notFound } from 'next/navigation'
import type { PublicAuditVisit, PublicPlantingEvidence } from '@/lib/admin-data'
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

  const plantingEvidenceUrls = [
    ...site.plantingPhotoUrls,
    ...site.stageEvidence.map((evidence) => evidence.url),
  ]

  return (
    <main className="min-h-screen px-5 py-6 sm:px-6 lg:py-10">
      <article className="public-record mx-auto" aria-labelledby="public-site-heading">
        <section className="public-card">
          <p className="eyebrow">PlantSure</p>

          <header className="mt-8 border-b pb-6" style={{ borderColor: 'var(--rule)' }}>
            <h1 id="public-site-heading" className="page-title">
              {site.name}
            </h1>
            <p className="body-copy mt-2">
              {site.village}, {site.taluk}, {site.district}
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
        </section>

        <section className="public-card" aria-labelledby="planting-evidence-heading">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">Planting evidence</p>
              <h2 id="planting-evidence-heading" className="section-title mt-1">
                Baseline record
              </h2>
            </div>
            <span className="public-status-pill">
              {plantingEvidenceUrls.length} photos
            </span>
          </div>

          <dl className="public-evidence-facts">
            <div>
              <dt>GPS</dt>
              <dd className="mono">{site.latitude}, {site.longitude}</dd>
            </div>
            <div>
              <dt>Planting date</dt>
              <dd>{displayDate(site.plantingDate)}</dd>
            </div>
            <div>
              <dt>Baseline count</dt>
              <dd>{site.plantedCount.toLocaleString()} plants</dd>
            </div>
          </dl>

          <StageEvidenceSummary evidence={site.stageEvidence} />

          <EvidencePhotos
            urls={plantingEvidenceUrls}
            emptyText="No planting photos have been attached to this record yet."
          />
        </section>

        <section className="public-card" aria-labelledby="audit-evidence-heading">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">Audit evidence</p>
              <h2 id="audit-evidence-heading" className="section-title mt-1">
                Monitoring visits
              </h2>
            </div>
            <span className="public-status-pill">
              {site.auditVisits.length} visits
            </span>
          </div>

          {site.auditVisits.length > 0 ? (
            <ol className="public-visit-list">
              {site.auditVisits.map((visit) => (
                <AuditVisitCard
                  key={visit.sequenceNumber}
                  visit={visit}
                  plantedCount={site.plantedCount}
                />
              ))}
            </ol>
          ) : (
            <p className="body-copy mt-4">
              The audit schedule is created after planting details are confirmed.
            </p>
          )}
        </section>
      </article>
    </main>
  )
}

function StageEvidenceSummary({ evidence }: { evidence: PublicPlantingEvidence[] }) {
  if (evidence.length === 0) {
    return null
  }

  return (
    <ol className="public-stage-list" aria-label="Planting stage evidence">
      {evidence.map((item) => (
        <li key={item.id}>
          <span className="eyebrow">{stageText(item.stage)}</span>
          <strong>{displayDate(item.capturedAt)}</strong>
          {item.caption && <span>{item.caption}</span>}
        </li>
      ))}
    </ol>
  )
}

function AuditVisitCard({
  visit,
  plantedCount,
}: {
  visit: PublicAuditVisit
  plantedCount: number
}) {
  return (
    <li className="public-visit-card" data-status={visit.status}>
      <div className="public-visit-head">
        <div>
          <p className="mono text-[13px]">{visit.cycleLabel}</p>
          <h3>{visitTitle(visit)}</h3>
        </div>
        <span>{statusText(visit.status)}</span>
      </div>

      <dl className="public-evidence-facts">
        <div>
          <dt>Due</dt>
          <dd>{displayDate(visit.dueDate)}</dd>
        </div>
        <div>
          <dt>Grace until</dt>
          <dd>{displayDate(visit.graceUntil)}</dd>
        </div>
        {visit.auditedAt && (
          <div>
            <dt>Visited</dt>
            <dd>{displayDate(visit.auditedAt)}</dd>
          </div>
        )}
        {visit.survivingCount !== null && (
          <div>
            <dt>Surviving</dt>
            <dd>
              {visit.survivingCount.toLocaleString()} of{' '}
              {plantedCount.toLocaleString()}
            </dd>
          </div>
        )}
        {visit.survivalRate && (
          <div>
            <dt>Survival</dt>
            <dd>{visit.survivalRate}%</dd>
          </div>
        )}
        {visit.latitude && visit.longitude && (
          <div>
            <dt>GPS</dt>
            <dd className="mono">
              {visit.latitude}, {visit.longitude}
              {visit.gpsAccuracyM ? ` · ${visit.gpsAccuracyM}m` : ''}
            </dd>
          </div>
        )}
        {visit.gpsStatus && (
          <div>
            <dt>GPS status</dt>
            <dd>{gpsStatusText(visit.gpsStatus)}</dd>
          </div>
        )}
      </dl>

      {visit.remarks && <p className="body-copy mt-3">{visit.remarks}</p>}

      <EvidencePhotos
        urls={visit.photoUrls}
        emptyText={
          visit.status === 'completed'
            ? 'This visit has no photos attached.'
            : 'No visit evidence has been recorded for this window.'
        }
      />
    </li>
  )
}

function stageText(stage: string): string {
  if (stage === 'pits_dug') {
    return 'Pits dug'
  }

  if (stage === 'planted') {
    return 'Planted'
  }

  return stage
}

function EvidencePhotos({
  urls,
  emptyText,
}: {
  urls: string[]
  emptyText: string
}) {
  if (urls.length === 0) {
    return <p className="public-empty-evidence">{emptyText}</p>
  }

  return (
    <div className="public-photo-grid">
      {urls.map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Evidence photo ${index + 1}`} />
        </a>
      ))}
    </div>
  )
}

function visitTitle(visit: PublicAuditVisit): string {
  if (visit.auditedAt) {
    return `Checked on ${displayDate(visit.auditedAt)}`
  }

  if (visit.status === 'missed') {
    return 'Visit missed'
  }

  return 'Scheduled visit'
}

function statusText(status: string): string {
  if (status === 'completed') {
    return 'Checked'
  }

  if (status === 'missed') {
    return 'Missed'
  }

  if (status === 'waived') {
    return 'Waived'
  }

  return 'Scheduled'
}

function gpsStatusText(status: string): string {
  return status.replaceAll('_', ' ')
}
