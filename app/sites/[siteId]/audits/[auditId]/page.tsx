import Link from 'next/link'
import { ArrowLeft, Camera, ExternalLink, MapPinned } from 'lucide-react'
import { notFound } from 'next/navigation'
import { InternalShell } from '@/components/internal-shell'
import { requireSiteAuditManager } from '@/lib/auth-member'
import { getAdminAuditReview } from '@/lib/admin-data'
import { withDatabase } from '@/lib/db'
import { displayDate } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function AdminAuditReviewPage({
  params,
}: {
  params: Promise<{ siteId: string; auditId: string }>
}) {
  const { siteId, auditId } = await params
  const member = await withDatabase((client) => requireSiteAuditManager(client, siteId))
  const audit = await getAdminAuditReview(siteId, auditId)

  if (!audit) {
    notFound()
  }

  const auditorLabel = audit.auditorName || audit.auditorEmail || 'Auditor'
  const gpsLabel =
    audit.latitude && audit.longitude
      ? `${audit.latitude}, ${audit.longitude}${audit.gpsAccuracyM ? ` · ${audit.gpsAccuracyM}m` : ''}`
      : 'Not captured'

  return (
    <InternalShell active="advisor" member={member}>
      <div className="mx-auto max-w-[1080px]">
        <header className="border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
          <Link href={`/sites/${audit.siteId}?console=1`} className="eyebrow hover:underline">
            Audit evidence
          </Link>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="site-id">{audit.locationId}</p>
              <h1 className="page-title mt-2">{audit.cycleLabel} review</h1>
              <p className="body-copy mt-2">
                {audit.siteName} · {audit.village}, {audit.taluk}, {audit.district}
              </p>
              <p className="body-copy mt-2">
                {audit.programName} · recorded by {auditorLabel}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
              <Metric label="Baseline" value={audit.plantedCount.toLocaleString()} />
              <Metric label="Alive" value={audit.survivingCount.toLocaleString()} />
              <Metric label="Missing" value={audit.missingCount.toLocaleString()} />
              <Metric label="Survival" value={`${audit.survivalRate}%`} />
            </dl>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/sites/${audit.siteId}?console=1`} className="secondary-button">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to site detail</span>
            </Link>
            <Link href={`/p/${audit.locationId}`} className="command-button">
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open public record</span>
            </Link>
          </div>
        </header>

        <section className="admin-panel mt-7" aria-labelledby="audit-summary-heading">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Completed visit</p>
              <h2 id="audit-summary-heading" className="section-title mt-1">
                Saved QR audit record
              </h2>
            </div>
            <span className="public-status-pill">{bandText(audit.band)}</span>
          </div>

          <div className="grid gap-5 p-5 sm:p-6">
            <dl className="public-evidence-facts">
              <div>
                <dt>Audit date</dt>
                <dd>{displayDate(audit.auditedAt)}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{displayDate(audit.receivedAt)}</dd>
              </div>
              <div>
                <dt>Window due</dt>
                <dd>{displayDate(audit.dueDate)}</dd>
              </div>
              <div>
                <dt>Grace until</dt>
                <dd>{displayDate(audit.graceUntil)}</dd>
              </div>
              <div>
                <dt>Capture method</dt>
                <dd>{audit.accessMethod.toUpperCase()}</dd>
              </div>
              <div>
                <dt>GPS status</dt>
                <dd>{gpsStatusText(audit.gpsStatus)}</dd>
              </div>
              <div>
                <dt>Audit GPS</dt>
                <dd className="mono">{gpsLabel}</dd>
              </div>
              <div>
                <dt>Site GPS</dt>
                <dd className="mono">
                  {audit.siteLatitude}, {audit.siteLongitude}
                </dd>
              </div>
              {audit.distanceFromSiteM && (
                <div>
                  <dt>Distance from site</dt>
                  <dd>{audit.distanceFromSiteM}m</dd>
                </div>
              )}
            </dl>

            {audit.latitude && audit.longitude && (
              <Link
                className="secondary-button justify-self-start"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${audit.latitude},${audit.longitude}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={16} aria-hidden="true" />
                <span>Open captured location</span>
              </Link>
            )}

            {audit.remarks && <p className="body-copy">{audit.remarks}</p>}
          </div>
        </section>

        <section className="admin-panel mt-7" aria-labelledby="audit-species-heading">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Species survival</p>
              <h2 id="audit-species-heading" className="section-title mt-1">
                Counts recorded by auditor
              </h2>
            </div>
            <span className="public-status-pill">
              {audit.speciesResults.length} species
            </span>
          </div>

          <div className="overflow-x-auto p-5 sm:p-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Species</th>
                  <th>Baseline</th>
                  <th>Alive</th>
                  <th>Missing</th>
                  <th>Survival</th>
                </tr>
              </thead>
              <tbody>
                {audit.speciesResults.map((species) => (
                  <tr key={species.speciesName}>
                    <td>{species.speciesName}</td>
                    <td>{species.plantedCount.toLocaleString()}</td>
                    <td>{species.survivingCount.toLocaleString()}</td>
                    <td>{Math.max(species.plantedCount - species.survivingCount, 0).toLocaleString()}</td>
                    <td>{species.survivalRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel mt-7" aria-labelledby="audit-photos-heading">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Field evidence</p>
              <h2 id="audit-photos-heading" className="section-title mt-1">
                Live photos captured on mobile
              </h2>
            </div>
            <span className="public-status-pill">{audit.photoUrls.length} photos</span>
          </div>

          <div className="p-5 sm:p-6">
            {audit.photoUrls.length > 0 ? (
              <div className="public-photo-grid">
                {audit.photoUrls.map((url, index) => (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Audit evidence ${index + 1}`} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="admin-notice" role="status">
                <div className="flex items-start gap-3">
                  <Camera size={18} aria-hidden="true" />
                  <div>
                    <p className="eyebrow">No photos</p>
                    <p className="mt-2 font-medium">
                      This audit was submitted without stored photo evidence.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="admin-panel mt-7" aria-labelledby="audit-assignment-heading">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Work order trail</p>
              <h2 id="audit-assignment-heading" className="section-title mt-1">
                Allocation and acceptance
              </h2>
            </div>
            <span className="public-status-pill">
              {audit.assignment ? audit.assignment.status : 'Direct QR'}
            </span>
          </div>

          <div className="grid gap-5 p-5 sm:p-6">
            {audit.assignment ? (
              <dl className="public-evidence-facts">
                <div>
                  <dt>Assigned auditor</dt>
                  <dd>{audit.assignment.auditorName || audit.assignment.auditorEmail}</dd>
                </div>
                <div>
                  <dt>Assigned email</dt>
                  <dd>{audit.assignment.auditorEmail}</dd>
                </div>
                <div>
                  <dt>Assigned by</dt>
                  <dd>{audit.assignment.assignedByName || 'PlantSure admin'}</dd>
                </div>
                <div>
                  <dt>Assigned at</dt>
                  <dd>{displayDate(audit.assignment.assignedAt)}</dd>
                </div>
                {audit.assignment.acceptedAt && (
                  <div>
                    <dt>Accepted at</dt>
                    <dd>{displayDate(audit.assignment.acceptedAt)}</dd>
                  </div>
                )}
                {audit.assignment.submittedAt && (
                  <div>
                    <dt>Submitted at</dt>
                    <dd>{displayDate(audit.assignment.submittedAt)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="body-copy">
                No matching work order was found for this completed audit.
              </p>
            )}
          </div>
        </section>
      </div>
    </InternalShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function bandText(value: string): string {
  if (value === 'healthy') {
    return 'Healthy'
  }

  if (value === 'watch') {
    return 'Watch'
  }

  if (value === 'poor') {
    return 'Poor'
  }

  if (value === 'critical') {
    return 'Critical'
  }

  return value
}

function gpsStatusText(value: string): string {
  if (value === 'confirmed') {
    return 'Confirmed'
  }

  if (value === 'plausible') {
    return 'Plausible'
  }

  if (value === 'questionable') {
    return 'Questionable'
  }

  return 'Unavailable'
}
