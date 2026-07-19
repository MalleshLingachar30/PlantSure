import Link from 'next/link'
import { Camera, ExternalLink, PanelTop } from 'lucide-react'
import { notFound } from 'next/navigation'
import {
  captureStageEvidence,
  confirmSiteCounts,
  recordAuditWindowCheck,
} from '@/app/admin/actions'
import { requireAdminMember } from '@/lib/auth-member'
import {
  type AdminSiteDetail,
  type AdminAuditWindow,
  getAdminSiteDetail,
} from '@/lib/admin-data'
import { withDatabase } from '@/lib/db'
import {
  type VisitTimelineEntry,
  VisitTimeline,
} from '@/components/visit-timeline'
import { InternalShell } from '@/components/internal-shell'

export const dynamic = 'force-dynamic'

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ confirmed?: string; stage?: string; checked?: string; error?: string }>
}) {
  const [{ siteId }, { confirmed, stage, checked, error }] = await Promise.all([params, searchParams])
  const member = await withDatabase(requireAdminMember)

  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const locked = site.status === 'counts_confirmed'
  const monitoringEndPreview = site.monitoringEnd ?? addYears(site.plantingDate, 5)
  const timeline = timelineFromWindows(site.windows)

  return (
    <InternalShell
      active="sites"
      member={member}
      siteMenu={{
        siteId: site.id,
        locationId: site.locationId,
        locationCode: site.locationId,
        siteName: site.name,
        stage: site.stage,
        status: site.status,
        windowsCount: site.windowsCount,
        active: 'detail',
      }}
    >
      <div className="mx-auto max-w-[1080px]">
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
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/sites/${site.id}/board`} className="command-button">
              <PanelTop size={16} aria-hidden="true" />
              <span>Open board</span>
            </Link>
            <Link
              href={`/p/${site.locationId}`}
              className="secondary-button"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open public page</span>
            </Link>
          </div>
        </header>

        {confirmed && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Counts locked</p>
            <p className="mt-2 font-medium">Twenty checks were written to the register.</p>
          </div>
        )}
        {stage && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Evidence saved</p>
            <p className="mt-2 font-medium">{stageLabel(stage)} evidence was recorded.</p>
          </div>
        )}
        {checked && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Check recorded</p>
            <p className="mt-2 font-medium">The audit window was marked checked.</p>
          </div>
        )}
        {error && (
          <div className="admin-notice mt-6" role="alert">
            <p className="eyebrow">Not saved</p>
            <p className="mt-2 font-medium">Check the evidence fields and try again.</p>
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

        <CheckCapturePanel site={site} />
        <StageCapturePanel site={site} />
      </div>
    </InternalShell>
  )
}

function CheckCapturePanel({ site }: { site: AdminSiteDetail }) {
  const window = site.windows.find((item) => item.status === 'missed') ??
    site.windows.find((item) => item.status === 'scheduled') ??
    null

  return (
    <section className="admin-panel mt-7" aria-labelledby="check-capture-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Audit visit</p>
          <h2 id="check-capture-heading" className="section-title mt-1">
            Record a check
          </h2>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        {!window ? (
          <p className="body-copy">No open check windows are available.</p>
        ) : (
          <form action={recordAuditWindowCheck} className="grid gap-5">
            <input type="hidden" name="siteId" value={site.id} />
            <input type="hidden" name="windowId" value={window.id} />

            <div className="form-section-line">
              <div>
                <p className="eyebrow">Open window</p>
                <h3 className="section-title mt-1">
                  {window.cycleLabel}: due {window.dueDate}
                </h3>
              </div>
              <span className="public-status-pill">{statusText(window.status)}</span>
            </div>

            <div className="repeat-list">
              {site.species.map((species) => (
                <div key={species.speciesName} className="repeat-row audit-species-row">
                  <input type="hidden" name="auditSpeciesName" value={species.speciesName} />
                  <div>
                    <p className="font-medium">{species.speciesName}</p>
                    <p className="body-copy text-[13px]">
                      Baseline {species.plantedCount.toLocaleString()}
                    </p>
                  </div>
                  <label className="field">
                    <span>Alive now</span>
                    <input
                      className="input"
                      name="auditSurvivingCount"
                      type="number"
                      min={0}
                      max={species.plantedCount}
                      required
                    />
                  </label>
                </div>
              ))}
            </div>

            <label className="field">
              <span>Photo URLs</span>
              <textarea
                name="auditPhotoUrls"
                rows={3}
                className="input resize-none"
                placeholder="One photo URL per line"
                required
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Checked at</span>
                <input
                  className="input"
                  name="auditedAt"
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  required
                />
              </label>
              <label className="field">
                <span>GPS status</span>
                <select className="input" name="gpsStatus" defaultValue="confirmed" required>
                  <option value="confirmed">Confirmed</option>
                  <option value="plausible">Plausible</option>
                  <option value="questionable">Questionable</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
              <label className="field">
                <span>Latitude</span>
                <input className="input" name="auditLatitude" inputMode="decimal" />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input className="input" name="auditLongitude" inputMode="decimal" />
              </label>
              <label className="field">
                <span>GPS accuracy</span>
                <input className="input" name="auditGpsAccuracy" inputMode="decimal" />
              </label>
            </div>

            <label className="field">
              <span>Remarks</span>
              <textarea name="remarks" rows={3} className="input resize-none" />
            </label>

            <button className="command-button justify-self-start" type="submit">
              Record check
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function StageCapturePanel({ site }: { site: AdminSiteDetail }) {
  const nextStage = nextEvidenceStage(site.stage)
  const pitsPhotos = site.stageEvidence.filter((evidence) => evidence.stage === 'pits_dug')
  const plantedPhotos = site.stageEvidence.filter((evidence) => evidence.stage === 'planted')

  return (
    <section className="admin-panel mt-7" aria-labelledby="stage-evidence-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Field evidence</p>
          <h2 id="stage-evidence-heading" className="section-title mt-1">
            Planting stages
          </h2>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Current stage</dt>
            <dd className="mt-1 font-medium">{stageLabel(site.stage)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Pits photos</dt>
            <dd className="mt-1 font-medium">{pitsPhotos.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Planting photos</dt>
            <dd className="mt-1 font-medium">{plantedPhotos.length}</dd>
          </div>
        </dl>

        {nextStage ? (
          <StageEvidenceForm siteId={site.id} stage={nextStage} />
        ) : (
          <p className="body-copy">
            Stage evidence is complete for the current registration flow.
          </p>
        )}

        {site.stageEvidence.length > 0 && (
          <div className="stage-evidence-list">
            {site.stageEvidence.map((evidence) => (
              <a
                key={evidence.id}
                className="stage-evidence-item"
                href={evidence.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <span className="eyebrow">{stageLabel(evidence.stage)}</span>
                  <strong>{evidence.capturedAt}</strong>
                  {evidence.caption && <span>{evidence.caption}</span>}
                </span>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function StageEvidenceForm({
  siteId,
  stage,
}: {
  siteId: string
  stage: 'pits_dug' | 'planted'
}) {
  return (
    <form action={captureStageEvidence} className="grid gap-4">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="stage" value={stage} />

      <div className="form-section-line">
        <div>
          <p className="eyebrow">Next action</p>
          <h3 className="section-title mt-1">{stageLabel(stage)}</h3>
        </div>
        <Camera size={22} aria-hidden="true" style={{ color: 'var(--alive)' }} />
      </div>

      <label className="field">
        <span>Photo URLs</span>
        <textarea
          name="evidencePhotoUrls"
          rows={3}
          className="input resize-none"
          placeholder="One photo URL per line"
          required
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Captured at</span>
          <input
            className="input"
            name="capturedAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            required
          />
        </label>
        <label className="field">
          <span>GPS accuracy</span>
          <input className="input" name="gpsAccuracy" inputMode="decimal" />
        </label>
        <label className="field">
          <span>Latitude</span>
          <input className="input" name="evidenceLatitude" inputMode="decimal" />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input className="input" name="evidenceLongitude" inputMode="decimal" />
        </label>
      </div>

      <label className="field">
        <span>Caption</span>
        <input className="input" name="caption" />
      </label>

      <button className="command-button justify-self-start" type="submit">
        <Camera size={16} aria-hidden="true" />
        Record {stageLabel(stage).toLowerCase()}
      </button>
    </form>
  )
}

function nextEvidenceStage(stage: string): 'pits_dug' | 'planted' | null {
  if (stage === 'material_arranged') {
    return 'pits_dug'
  }

  if (stage === 'pits_dug') {
    return 'planted'
  }

  return null
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    land_identified: 'Land identified',
    land_verified: 'Land verified',
    species_configured: 'Species configured',
    material_arranged: 'Material arranged',
    pits_dug: 'Pits dug',
    planted: 'Planted',
    submitted_for_acceptance: 'Submitted for acceptance',
    accepted: 'Accepted',
    monitoring: 'Monitoring',
    archived: 'Archived',
  }

  return labels[stage] ?? stage
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
