import Link from 'next/link'
import type { ReactNode } from 'react'
import { Camera, ClipboardCheck, ExternalLink, Mail, PanelTop, ShieldCheck, UserPlus } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { requirePlantationMember } from '@/lib/auth-member'
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
  searchParams: Promise<{
    confirmed?: string
    submitted?: string
    notified?: string
    approved?: string
    stage?: string
    checked?: string
    auditor?: string
    assignment?: string
    invited?: string
    error?: string
    console?: string
  }>
}) {
  const [{ siteId }, { confirmed, submitted, notified, approved, stage, checked, auditor, assignment, invited, error, console }] = await Promise.all([
    params,
    searchParams,
  ])
  const member = await withDatabase((client) => requirePlantationMember(client))

  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const ownerReviewPending =
    site.stage === 'submitted_for_acceptance' &&
    !site.acceptance?.acceptedAt &&
    !site.acceptance?.rejectedAt

  if (ownerReviewPending && console !== '1') {
    redirect(`/sites/${site.id}/review`)
  }

  const isOwnerApprover =
    member.role === 'technician' &&
    Boolean(member.email) &&
    Boolean(site.ownerApproverEmail) &&
    member.email!.trim().toLowerCase() === site.ownerApproverEmail!.trim().toLowerCase()

  if (member.role === 'technician' && !isOwnerApprover) {
    notFound()
  }

  const isScientificInstitutionAdmin =
    member.role === 'manager' &&
    Boolean(member.email) &&
    Boolean(site.scientificAdvisorContactEmail) &&
    member.email!.trim().toLowerCase() === site.scientificAdvisorContactEmail!.trim().toLowerCase()

  if (member.role === 'manager' && !isScientificInstitutionAdmin) {
    notFound()
  }

  const locked = site.status === 'counts_confirmed'
  const canConfirmCounts = member.role === 'admin'
  const canManageAuditors = member.role === 'admin' || isScientificInstitutionAdmin
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
              <p className="body-copy mt-2">
                {site.programName} · {site.organizationName} · {site.scientificAdvisorName}
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
        {submitted && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Submitted</p>
            <p className="mt-2 font-medium">
              {notified === 'failed'
                ? 'The baseline was submitted, but the owner approval email could not be delivered.'
                : 'The baseline was submitted for sponsor acceptance.'}
            </p>
            {notified === 'sent' && (
              <p className="mt-2 text-[14px]">
                The owner approval email was sent to {site.ownerApproverEmail || 'the assigned approver account'} for {site.organizationName}.
              </p>
            )}
            {notified === 'failed' && (
              <p className="mt-2 text-[14px]">
                Check the Resend configuration or resend the approval request from the owner account flow.
              </p>
            )}
          </div>
        )}
        {approved && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Approved</p>
            <p className="mt-2 font-medium">The project owner approval was recorded from a separate account.</p>
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
        {auditor && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Auditor registered</p>
            <p className="mt-2 font-medium">
              The auditor email is attached to this planting site.
            </p>
            <p className="mt-2 text-[14px]">
              {invited === 'failed'
                ? 'The site gate is active, but the Clerk invitation could not be sent. Ask the auditor to sign up with the same registered email.'
                : 'If the auditor does not already have a Clerk account, an invitation was sent with the QR audit link.'}
            </p>
          </div>
        )}
        {assignment && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Audit assigned</p>
            <p className="mt-2 font-medium">
              The selected audit window is now a work order on the auditor dashboard.
            </p>
          </div>
        )}
        {error && (
          <div className="admin-notice mt-6" role="alert">
            <p className="eyebrow">Not saved</p>
            <p className="mt-2 font-medium">{siteActionErrorMessage(error)}</p>
          </div>
        )}
        {ownerReviewPending && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Owner approval link</p>
            <p className="mt-2 font-medium">
              Review photos and approve this baseline from the owner approval page.
            </p>
            <p className="mt-2 text-[14px]">
              If this browser is signed in as an admin, open the review page and sign out there. It will return to the approval screen so the owner can sign in with {site.ownerApproverEmail || 'the assigned owner account'}.
            </p>
            <Link href={`/sites/${site.id}/review`} className="command-button mt-4 inline-flex">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Open owner review</span>
            </Link>
          </div>
        )}

        <LifecycleEvidencePanel site={site} isOwnerApprover={isOwnerApprover} />

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
              ) : !stageReached(site.stage, 'accepted') ? (
                <div className="grid gap-3">
                  <p className="body-copy">
                    Submit and accept the baseline before the monitoring schedule can be created.
                  </p>
                  <p className="body-copy text-[14px]">
                    Current lifecycle stage: {stageLabel(site.stage)}.
                  </p>
                </div>
              ) : !canConfirmCounts ? (
                <div className="grid gap-3">
                  <p className="body-copy">
                    Planting details are ready for final confirmation, but this step must be completed from an admin account.
                  </p>
                  <p className="body-copy text-[14px]">
                    Sign out of the owner account, sign in as a PlantSure admin, then open this site again to create the monitoring schedule.
                  </p>
                </div>
              ) : (
                <form action={`/sites/${site.id}/confirm`} method="post" className="grid gap-5">
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

        <QrAuditPanel site={site} />
        <SiteAuditorsPanel site={site} canManage={canManageAuditors} />
        <AuditAssignmentsPanel site={site} canManage={canManageAuditors} />
      </div>
    </InternalShell>
  )
}

type LifecycleEntry = {
  label: string
  value: string
}

type LifecycleEvidenceLink = {
  id: string
  label: string
  detail: string
  url: string
  caption?: string | null
}

function LifecycleEvidencePanel({
  site,
  isOwnerApprover,
}: {
  site: AdminSiteDetail
  isOwnerApprover: boolean
}) {
  const nextStage = nextEvidenceStage(site.stage)
  const pitsEvidence = site.stageEvidence.filter((evidence) => evidence.stage === 'pits_dug')
  const plantedEvidence = site.stageEvidence.filter((evidence) => evidence.stage === 'planted')
  const plantingPhotos = site.plantingPhotoUrls.map((url, index) => ({
    id: `planting-photo-${index}`,
    label: 'Registration photo',
    detail: 'Baseline planting photo',
    url,
  }))
  const openWindow = site.windows.find((window) => window.status === 'scheduled')
  const completedWindows = site.windows.filter((window) => window.status === 'completed').length
  const missedWindows = site.windows.filter((window) => window.status === 'missed').length

  return (
    <section className="admin-panel mt-7" aria-labelledby="lifecycle-evidence-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Lifecycle evidence</p>
          <h2 id="lifecycle-evidence-heading" className="section-title mt-1">
            Site record, stage by stage
          </h2>
        </div>
      </div>

      <div className="lifecycle-detail-list">
        <LifecycleDetailStep
          stage="land_identified"
          siteStage={site.stage}
          title="Land identified"
          summary="The place is named, coded, and bounded by walked points."
          entries={[
            { label: 'Location ID', value: site.locationId },
            { label: 'Place', value: `${site.village}, ${site.taluk}, ${site.district}` },
            { label: 'Centre point', value: `${site.latitude}, ${site.longitude}` },
            {
              label: 'Boundary points',
              value:
                site.boundaryPoints.length > 0
                  ? `${site.boundaryPoints.length} corners recorded`
                  : 'No boundary corners recorded',
            },
          ]}
          evidence={[]}
          emptyEvidence="No land-identification field photo recorded yet."
        >
          {site.boundaryPoints.length > 0 && (
            <div className="lifecycle-boundary-grid">
              {site.boundaryPoints.map((point, index) => (
                <div key={`${point.lat}-${point.lng}-${index}`} className="lifecycle-boundary-point">
                  <span className="eyebrow">Corner {index + 1}</span>
                  <strong>
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="land_verified"
          siteStage={site.stage}
          title="Land verified"
          summary="Custody and permission details are captured before planting work proceeds."
          entries={[
            { label: 'Ownership', value: displayEnum(site.landOwnership) },
            {
              label: 'Owner organization',
              value: `${site.organizationName} (${displayEnum(site.organizationType)})`,
            },
            {
              label: 'Scientific advisor',
              value: site.scientificAdvisorName,
            },
            { label: 'Custodian', value: site.landCustodian || 'Not recorded' },
            { label: 'Approval reference', value: site.approvalReference || 'Not recorded' },
            { label: 'Shared parcel', value: yesNo(site.isSharedParcel) },
            { label: 'Watch and ward', value: yesNo(site.watchAndWard) },
          ]}
          evidence={[]}
          emptyEvidence="No land-verification field photo recorded yet."
        />

        <LifecycleDetailStep
          stage="species_configured"
          siteStage={site.stage}
          title="Species entered"
          summary="The baseline is stored as per-species rows; the total is derived from them."
          entries={[
            { label: 'Species rows', value: site.species.length.toString() },
            { label: 'Derived total', value: site.plantedCount.toLocaleString() },
            { label: 'Notes', value: site.speciesNotes || 'No notes recorded' },
          ]}
          evidence={[]}
          emptyEvidence="Species rows do not require a field photo."
        >
          {site.species.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table lifecycle-species-table">
                <thead>
                  <tr>
                    <th>Species</th>
                    <th>Plants</th>
                    <th>Placement</th>
                    <th>Spacing</th>
                  </tr>
                </thead>
                <tbody>
                  {site.species.map((species) => (
                    <tr key={species.speciesName}>
                      <td>{species.speciesName}</td>
                      <td>{species.plantedCount.toLocaleString()}</td>
                      <td>{species.placement || 'Not recorded'}</td>
                      <td>{species.spacingNotes || 'Not recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="material_arranged"
          siteStage={site.stage}
          title="Materials ready"
          summary="Intake facts needed before field execution are on the record."
          entries={[
            { label: 'Plantation type', value: displayEnum(site.plantationType) },
            { label: 'Planting date', value: site.plantingDate },
            { label: 'Plants planned', value: site.plantedCount.toLocaleString() },
          ]}
          evidence={plantingPhotos}
          emptyEvidence="No registration photo URLs recorded."
        />

        <LifecycleDetailStep
          stage="pits_dug"
          siteStage={site.stage}
          title="Pits dug"
          summary="Field photo evidence is required before the planting stage can be recorded."
          entries={[
            { label: 'Photos', value: pitsEvidence.length.toString() },
            {
              label: 'Status',
              value: stageReached(site.stage, 'pits_dug') ? 'Recorded' : 'Waiting for evidence',
            },
          ]}
          evidence={evidenceLinks(pitsEvidence)}
          emptyEvidence="No pits-dug photos recorded yet."
        >
          {nextStage === 'pits_dug' && <StageEvidenceForm siteId={site.id} stage="pits_dug" />}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="planted"
          siteStage={site.stage}
          title="Planted"
          summary="Planting photo evidence completes the field registration flow."
          entries={[
            { label: 'Photos', value: plantedEvidence.length.toString() },
            {
              label: 'Status',
              value: stageReached(site.stage, 'planted') ? 'Recorded' : 'Waiting for evidence',
            },
          ]}
          evidence={evidenceLinks(plantedEvidence)}
          emptyEvidence="No planted photos recorded yet."
        >
          {nextStage === 'planted' && <StageEvidenceForm siteId={site.id} stage="planted" />}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="submitted_for_acceptance"
          siteStage={site.stage}
          title="Submitted"
          summary="The registrar submits the baseline; the project owner must approve from a different account."
          entries={[
            {
              label: 'Submission',
              value: stageReached(site.stage, 'submitted_for_acceptance')
                ? 'Submitted for acceptance'
                : 'Not submitted',
            },
            {
              label: 'Submitted on',
              value: site.acceptance?.submittedAt ?? 'Not recorded',
            },
            {
              label: 'Owner approver',
              value:
                site.ownerApproverName && site.ownerApproverEmail
                  ? `${site.ownerApproverName} · ${site.ownerApproverEmail}`
                  : site.ownerApproverEmail ?? 'Not configured',
            },
          ]}
          evidence={[]}
          emptyEvidence="No in-system acceptance packet recorded yet."
        >
          {site.stage === 'planted' && (
            <AcceptanceActionForm
              siteId={site.id}
              action="submit"
              title="Submit baseline"
              description="Record the registrar submission and move the site into sponsor review."
              buttonLabel="Submit for acceptance"
            />
          )}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="accepted"
          siteStage={site.stage}
          title="Approved"
          summary="Approval must come from the assigned project owner account after the submission is reviewed."
          entries={[
            {
              label: 'Acceptance',
              value: stageReached(site.stage, 'accepted') ? 'Approved' : 'Not approved in system',
            },
            {
              label: 'Approved on',
              value: site.acceptance?.acceptedAt ?? 'Not recorded',
            },
            {
              label: 'Decision',
              value: site.acceptance?.acceptedAt
                ? site.acceptance.acceptedAsAdmin
                  ? 'Admin break-glass'
                  : 'Project owner'
                : site.acceptance?.rejectedAt
                  ? 'Rejected'
                  : 'Pending',
            },
            {
              label: 'Approved by',
              value: site.acceptance?.acceptedByName ?? 'Not recorded',
            },
            {
              label: 'Owner organization',
              value: site.organizationName,
            },
          ]}
          evidence={[]}
          emptyEvidence="No in-system acceptance evidence recorded yet."
        >
          {site.stage === 'submitted_for_acceptance' && !site.acceptance?.acceptedAt && isOwnerApprover && (
            <AcceptanceActionForm
              siteId={site.id}
              action="accept"
              title="Approve baseline"
              description="Use this only after the project owner has reviewed the baseline and is ready to sign it off."
              buttonLabel="Approve baseline"
            />
          )}
          {site.stage === 'submitted_for_acceptance' && !site.acceptance?.acceptedAt && !isOwnerApprover && (
            <p className="body-copy text-[14px]">
              Waiting for approval from {site.ownerApproverEmail || 'the assigned project owner account'} at {site.organizationName}.
            </p>
          )}
          {site.acceptance?.rejectedAt && (
            <p className="body-copy text-[14px]">
              Rejected on {site.acceptance.rejectedAt}: {site.acceptance.rejectionReason || 'No reason recorded'}.
            </p>
          )}
        </LifecycleDetailStep>

        <LifecycleDetailStep
          stage="monitoring"
          siteStage={site.stage}
          title="Monitoring"
          summary="Confirmed sites get twenty windows; missed checks are recorded by the scheduler."
          entries={[
            { label: 'Gate', value: site.status === 'counts_confirmed' ? 'Counts confirmed' : 'Counts open' },
            { label: 'Windows', value: site.windowsCount.toString() },
            { label: 'Checked', value: completedWindows.toString() },
            { label: 'Missed', value: missedWindows.toString() },
            { label: 'Next scheduled', value: openWindow ? `${openWindow.cycleLabel}, due ${openWindow.dueDate}` : 'None' },
          ]}
          evidence={[]}
          emptyEvidence="Audit visit photos appear after a check is recorded."
        />
      </div>
    </section>
  )
}

function LifecycleDetailStep({
  stage,
  siteStage,
  title,
  summary,
  entries,
  evidence,
  emptyEvidence,
  children,
}: {
  stage: string
  siteStage: string
  title: string
  summary: string
  entries: LifecycleEntry[]
  evidence: LifecycleEvidenceLink[]
  emptyEvidence: string
  children?: ReactNode
}) {
  const complete = stageReached(siteStage, stage)
  const active = siteStage === stage

  return (
    <article className={`lifecycle-detail-step${active ? ' is-active' : ''}`}>
      <div className="lifecycle-detail-marker" aria-hidden="true">
        {complete ? '✓' : active ? '•' : ''}
      </div>
      <div className="lifecycle-detail-body">
        <div className="lifecycle-detail-heading">
          <div>
            <p className="eyebrow">{complete ? 'Recorded' : active ? 'Current' : 'Waiting'}</p>
            <h3>{title}</h3>
          </div>
          <span>{summary}</span>
        </div>

        <dl className="lifecycle-entry-grid">
          {entries.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>

        {children}

        <div className="lifecycle-evidence-links">
          {evidence.length > 0 ? (
            evidence.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
                <span>
                  <span className="eyebrow">{item.label}</span>
                  <strong>{item.detail}</strong>
                  {item.caption && <span>{item.caption}</span>}
                </span>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))
          ) : (
            <p>{emptyEvidence}</p>
          )}
        </div>
      </div>
    </article>
  )
}

function QrAuditPanel({ site }: { site: AdminSiteDetail }) {
  const today = new Date().toISOString().slice(0, 10)
  const window = site.windows.find((item) => isWindowOpenForCheck(item, today)) ?? null
  const nextScheduledWindow = site.windows.find(
    (item) => item.status === 'scheduled' && item.dueDate > today,
  )

  return (
    <section className="admin-panel mt-7" aria-labelledby="check-capture-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">QR audit visit</p>
          <h2 id="check-capture-heading" className="section-title mt-1">
            Scan the site board to record
          </h2>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        {!window ? (
          <div className="grid gap-2">
            <p className="body-copy">
              No QR check window is open today. Audit entry happens from the
              board QR scan, not from a back-office form.
            </p>
            {nextScheduledWindow && (
              <p className="body-copy text-[14px]">
                Next check: {nextScheduledWindow.cycleLabel}, due{' '}
                {nextScheduledWindow.dueDate}.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="form-section-line">
              <div>
                <p className="eyebrow">Open window</p>
                <h3 className="section-title mt-1">
                  {window.cycleLabel}: due {window.dueDate}
                </h3>
              </div>
              <span className="public-status-pill">{statusText(window.status)}</span>
            </div>

            <p className="body-copy">
              Field staff should scan the printed board QR at the plantation and
              record this visit from the QR audit page.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link className="command-button" href={`/p/${site.locationId}/check`}>
                <Camera size={16} aria-hidden="true" />
                <span>Open QR audit page</span>
              </Link>
              <Link className="secondary-button" href={`/sites/${site.id}/board`}>
                <PanelTop size={16} aria-hidden="true" />
                <span>Print board QR</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SiteAuditorsPanel({
  site,
  canManage,
}: {
  site: AdminSiteDetail
  canManage: boolean
}) {
  return (
    <section className="admin-panel mt-7" aria-labelledby="site-auditors-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Registered auditors</p>
          <h2 id="site-auditors-heading" className="section-title mt-1">
            QR scan access
          </h2>
        </div>
        <span className="public-status-pill">
          {site.auditors.filter((auditor) => auditor.active).length} active
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        <p className="body-copy">
          Only PlantSure admins and active auditors attached here can open the
          scanned-site audit template after Clerk sign-in.
        </p>

        {site.auditors.length > 0 ? (
          <div className="repeat-list">
            {site.auditors.map((auditor) => (
              <div key={auditor.id} className="repeat-row">
                <div>
                  <p className="font-medium">{auditor.displayName || auditor.email}</p>
                  <p className="body-copy text-[13px]">{auditor.email}</p>
                </div>
                <span className="public-status-pill">
                  {auditor.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-notice" role="status">
            <div className="flex items-start gap-3">
              <Mail size={18} aria-hidden="true" />
              <div>
                <p className="eyebrow">No assigned auditors</p>
                <p className="mt-2 font-medium">
                  No field auditor email is registered for this site yet.
                  Register an auditor before allocating work orders.
                </p>
              </div>
            </div>
          </div>
        )}

        {canManage ? (
          <form action={`/sites/${site.id}/auditors`} method="post" className="grid gap-4">
            <div className="form-section-line">
              <div>
                <p className="eyebrow">Attach auditor</p>
                <h3 className="section-title mt-1">Register email for QR checks</h3>
              </div>
              <UserPlus size={22} aria-hidden="true" style={{ color: 'var(--alive)' }} />
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Auditor email</span>
                <input
                  className="input"
                  name="email"
                  type="email"
                  placeholder="auditor@example.com"
                  required
                />
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  name="displayName"
                  placeholder="Field auditor"
                />
              </label>
            </div>
            <button className="command-button justify-self-start" type="submit">
              <UserPlus size={16} aria-hidden="true" />
              Register auditor
            </button>
          </form>
        ) : (
          <p className="body-copy text-[14px]">
            Auditor assignment is managed from a PlantSure admin account.
          </p>
        )}
      </div>
    </section>
  )
}

function AuditAssignmentsPanel({
  site,
  canManage,
}: {
  site: AdminSiteDetail
  canManage: boolean
}) {
  const activeAuditors = site.auditors.filter((auditor) => auditor.active)
  const activeAssignmentWindowIds = new Set(
    site.auditAssignments
      .filter((assignment) => ['assigned', 'accepted'].includes(assignment.status))
      .map((assignment) => assignment.windowId),
  )
  const availableWindows = site.windows.filter(
    (window) => window.status === 'scheduled' && !activeAssignmentWindowIds.has(window.id),
  )
  const assignmentByWindow = new Map(
    site.auditAssignments.map((assignment) => [assignment.windowId, assignment]),
  )

  return (
    <section className="admin-panel mt-7" aria-labelledby="audit-assignments-heading">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Audit work orders</p>
          <h2 id="audit-assignments-heading" className="section-title mt-1">
            Allocate available checks
          </h2>
        </div>
        <span className="public-status-pill">
          {site.auditAssignments.filter((assignment) => assignment.status !== 'submitted').length} open
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        <p className="body-copy">
          Assign scheduled audit windows to registered auditors. The auditor
          accepts the order on their dashboard before going to the site and
          scanning the board QR.
        </p>

        {site.windows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Due</th>
                  <th>Assignment</th>
                  <th>Auditor</th>
                </tr>
              </thead>
              <tbody>
                {site.windows.map((window) => {
                  const assignment = assignmentByWindow.get(window.id)

                  return (
                    <tr key={window.id}>
                      <td className="mono">{window.cycleLabel}</td>
                      <td>{window.dueDate}</td>
                      <td>{assignment ? assignmentStatusText(assignment.status) : statusText(window.status)}</td>
                      <td>
                        {assignment
                          ? assignment.auditorName || assignment.auditorEmail
                          : window.status === 'scheduled'
                            ? 'Available'
                            : 'Not available'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <form action={`/sites/${site.id}/audit-assignments`} method="post" className="grid gap-4">
            <div className="form-section-line">
              <div>
                <p className="eyebrow">Assign order</p>
                <h3 className="section-title mt-1">Choose window and auditor</h3>
              </div>
              <ClipboardCheck size={22} aria-hidden="true" style={{ color: 'var(--alive)' }} />
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Available audit window</span>
                <select className="input" name="windowId" required disabled={availableWindows.length === 0}>
                  <option value="">Select a scheduled check</option>
                  {availableWindows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.cycleLabel} · due {window.dueDate}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Registered auditor</span>
                <select className="input" name="siteAuditorId" required disabled={activeAuditors.length === 0}>
                  <option value="">Select an auditor</option>
                  {activeAuditors.map((auditor) => (
                    <option key={auditor.id} value={auditor.id}>
                      {auditor.displayName || auditor.email} · {auditor.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="command-button justify-self-start"
              type="submit"
              disabled={availableWindows.length === 0 || activeAuditors.length === 0}
            >
              <ClipboardCheck size={16} aria-hidden="true" />
              Allocate audit order
            </button>
          </form>
        ) : (
          <p className="body-copy text-[14px]">
            Audit allocation is managed from a PlantSure admin account.
          </p>
        )}
      </div>
    </section>
  )
}

function isWindowOpenForCheck(window: AdminAuditWindow, today: string): boolean {
  return (
    window.status === 'scheduled' &&
    window.dueDate <= today &&
    window.graceUntil >= today
  )
}

function AcceptanceActionForm({
  siteId,
  action,
  title,
  description,
  buttonLabel,
}: {
  siteId: string
  action: 'submit' | 'accept'
  title: string
  description: string
  buttonLabel: string
}) {
  return (
    <form action={`/sites/${siteId}/acceptance`} method="post" className="grid gap-4">
      <input type="hidden" name="action" value={action} />
      <div className="form-section-line">
        <div>
          <p className="eyebrow">Next action</p>
          <h3 className="section-title mt-1">{title}</h3>
        </div>
      </div>
      <p className="body-copy">{description}</p>
      <button className="command-button justify-self-start" type="submit">
        {buttonLabel}
      </button>
    </form>
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
    <form action={`/sites/${siteId}/stage-evidence`} method="post" className="grid gap-4">
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
          <span>GPS accuracy (m)</span>
          <input
            className="input"
            name="gpsAccuracy"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="5.5"
          />
        </label>
        <label className="field">
          <span>Latitude</span>
          <input
            className="input"
            name="evidenceLatitude"
            type="number"
            min="-90"
            max="90"
            step="0.000001"
            inputMode="decimal"
            placeholder="13.312000"
          />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input
            className="input"
            name="evidenceLongitude"
            type="number"
            min="-180"
            max="180"
            step="0.000001"
            inputMode="decimal"
            placeholder="76.941000"
          />
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

function siteActionErrorMessage(error: string): string {
  if (error === 'confirm') {
    return 'Planting details can only be confirmed from a PlantSure admin account after owner approval.'
  }

  if (error === 'stage_photos') {
    return 'Add at least one valid photo URL and try again.'
  }

  if (error === 'stage_coordinates') {
    return 'Latitude and longitude must be decimal numbers.'
  }

  if (error === 'stage_gps') {
    return 'GPS accuracy must be a number in metres. Leave it blank if unavailable.'
  }

  if (error === 'auditor') {
    return 'Enter a valid auditor email from an admin account and try again.'
  }

  if (error === 'auditor_access') {
    return 'Only a PlantSure admin or an active registered auditor for this site can record the QR audit.'
  }

  if (error === 'assignment') {
    return 'Choose an available scheduled window and an active registered auditor. The window may already be assigned.'
  }

  return 'Check the evidence fields and try again.'
}

const lifecycleStageOrder = [
  'land_identified',
  'land_verified',
  'species_configured',
  'material_arranged',
  'pits_dug',
  'planted',
  'submitted_for_acceptance',
  'accepted',
  'monitoring',
  'archived',
]

function stageReached(currentStage: string, targetStage: string): boolean {
  const currentIndex = lifecycleStageOrder.indexOf(currentStage)
  const targetIndex = lifecycleStageOrder.indexOf(targetStage)

  if (currentIndex === -1 || targetIndex === -1) {
    return currentStage === targetStage
  }

  return currentIndex >= targetIndex
}

function evidenceLinks(evidence: AdminSiteDetail['stageEvidence']): LifecycleEvidenceLink[] {
  return evidence.map((item) => ({
    id: item.id,
    label: stageLabel(item.stage),
    detail: item.capturedAt,
    url: item.url,
    caption: item.caption,
  }))
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No'
}

function displayEnum(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

function assignmentStatusText(status: string): string {
  if (status === 'assigned') {
    return 'Assigned'
  }

  if (status === 'accepted') {
    return 'Accepted'
  }

  if (status === 'submitted') {
    return 'Submitted'
  }

  if (status === 'cancelled') {
    return 'Cancelled'
  }

  return status
}

function addYears(dateString: string, years: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const target = new Date(Date.UTC(year + years, month - 1, day))

  return target.toISOString().slice(0, 10)
}
