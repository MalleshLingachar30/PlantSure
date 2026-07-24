import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ClipboardCheck, QrCode } from 'lucide-react'
import { notFound } from 'next/navigation'
import { AuditCheckForm } from '@/components/audit-check-form'
import { SignOutControl } from '@/components/sign-out-control'
import { hasAcceptedAuditAssignment } from '@/lib/audit-assignments'
import { getSiteAuditorAccess } from '@/lib/auth-member'
import type { AdminAuditWindow } from '@/lib/admin-data'
import { getPublicSiteByLocationId } from '@/lib/admin-data'
import { withDatabase } from '@/lib/db'
import { displayDate } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function PublicAuditCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>
  searchParams: Promise<{ error?: string; invited?: string }>
}) {
  const [{ locationId }, { error, invited }] = await Promise.all([params, searchParams])
  const site = await getPublicSiteByLocationId(decodeURIComponent(locationId))

  if (!site) {
    notFound()
  }

  const access = await withDatabase((client) =>
    getSiteAuditorAccess(client, site.id, { allowAdmin: false }),
  )
  const member = access.member
  const invitedEmail = invited?.trim().toLowerCase() || null
  const signedInEmail = member.email?.trim().toLowerCase() ?? null
  const invitationEmailMismatch = Boolean(invitedEmail && signedInEmail !== invitedEmail)
  const checkPath = invitedEmail
    ? `/p/${site.locationId}/check?invited=${encodeURIComponent(invitedEmail)}`
    : `/p/${site.locationId}/check`
  const today = new Date().toISOString().slice(0, 10)
  const window = site.auditVisits.find((item) => isWindowOpenForCheck(item, today)) ?? null
  const assignmentAccepted =
    access.allowed && window && signedInEmail
      ? await withDatabase((client) =>
          hasAcceptedAuditAssignment(client, {
            siteId: site.id,
            windowId: window.id,
            email: signedInEmail,
          }),
        )
      : false
  const missingAcceptedAssignment = Boolean(access.allowed && window && !assignmentAccepted)

  if (!access.allowed || invitationEmailMismatch || missingAcceptedAssignment) {
    return (
      <main className="min-h-screen px-5 py-6 sm:px-6 lg:py-10">
        <article className="public-record mx-auto" aria-labelledby="qr-check-heading">
          <section className="public-card">
            <div className="public-section-header">
              <div>
                <p className="eyebrow">QR audit visit</p>
                <h1 id="qr-check-heading" className="page-title mt-1">
                  {site.locationId}
                </h1>
                <p className="body-copy mt-2">
                  {site.name} · {site.village}, {site.district}
                </p>
              </div>
              <AlertTriangle size={28} aria-hidden="true" />
            </div>

            <div className="admin-notice mt-5" role="alert">
              <p className="eyebrow">
                {invitationEmailMismatch
                  ? 'Use invited auditor email'
                  : missingAcceptedAssignment
                    ? 'Accept audit order first'
                    : 'Registered auditor required'}
              </p>
              <p className="mt-2 font-medium">
                {invitationEmailMismatch
                  ? `This invitation is for ${invitedEmail}. Sign out, then accept the invitation or sign in with that email.`
                  : missingAcceptedAssignment
                    ? 'Open My audits, accept this audit order, then scan the site board QR at the plantation.'
                    : 'This QR audit can only be recorded by an active auditor email attached to this planting site.'}
              </p>
              <p className="mt-2 text-[14px]">
                You are signed in as {member.email || 'an account without an email'}.
                {invitationEmailMismatch
                  ? ' The current browser session belongs to a different account.'
                  : missingAcceptedAssignment
                    ? ' Assignment acceptance is required before field capture starts.'
                    : ' Ask the PlantSure admin to register this exact email on the site, or sign out and continue with the registered auditor email.'}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5" style={{ borderColor: 'var(--rule)' }}>
              <div className="internal-user border-0 p-0">
                <p>{member.displayName || member.email || 'Signed in'}</p>
                {member.email && <span>{member.email}</span>}
                <span className="internal-user-role">{member.role}</span>
              </div>
              <SignOutControl redirectUrl={checkPath} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {missingAcceptedAssignment && (
                <Link className="command-button" href="/auditor">
                  <ClipboardCheck size={16} aria-hidden="true" />
                  <span>Open My audits</span>
                </Link>
              )}
              <Link className="secondary-button" href={`/p/${site.locationId}`}>
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back to public record</span>
              </Link>
            </div>
          </section>
        </article>
      </main>
    )
  }

  const nextScheduledWindow = site.auditVisits.find(
    (item) => item.status === 'scheduled' && item.dueDate > today,
  )
  const completedVisits = site.auditVisits.filter((visit) => visit.status === 'completed')

  return (
    <main className="min-h-screen px-5 py-6 sm:px-6 lg:py-10">
      <article className="public-record mx-auto" aria-labelledby="qr-check-heading">
        <section className="public-card">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">QR audit visit</p>
              <h1 id="qr-check-heading" className="page-title mt-1">
                {site.locationId}
              </h1>
              <p className="body-copy mt-2">
                {site.name} · {site.village}, {site.district}
              </p>
            </div>
            <QrCode size={28} aria-hidden="true" />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5" style={{ borderColor: 'var(--rule)' }}>
            <div className="internal-user border-0 p-0">
              <p>{member.displayName || member.email || 'Signed in'}</p>
              {member.email && <span>{member.email}</span>}
              <span className="internal-user-role">{member.role}</span>
            </div>
            <SignOutControl redirectUrl={checkPath} />
          </div>

          {error && (
            <div className="admin-notice mt-5" role="alert">
              <p className="eyebrow">Check not recorded</p>
              <p className="mt-2 font-medium">
                {error === 'auditor_access'
                  ? 'This signed-in account is not registered as an active auditor for the scanned site.'
                  : 'Confirm the alive counts, photo URLs, GPS fields, and audit date are valid for the open window.'}
              </p>
            </div>
          )}
        </section>

        <section className="public-card" aria-labelledby="qr-plantation-context-heading">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">Plantation data</p>
              <h2 id="qr-plantation-context-heading" className="section-title mt-1">
                Baseline for scanned site
              </h2>
            </div>
            <span className="public-status-pill">{site.stage.replaceAll('_', ' ')}</span>
          </div>

          <dl className="public-facts mt-5">
            <div>
              <dt>Plants</dt>
              <dd className="big-number">{site.plantedCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Planted</dt>
              <dd>{displayDate(site.plantingDate)}</dd>
            </div>
            <div>
              <dt>Programme</dt>
              <dd>{site.programName}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{site.organizationName}</dd>
            </div>
            <div>
              <dt>GPS</dt>
              <dd className="mono">{site.latitude}, {site.longitude}</dd>
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

          <div className="mt-6 grid gap-3">
            {site.species.map((species) => (
              <div key={species.speciesName} className="repeat-row">
                <div>
                  <p className="font-medium">{species.speciesName}</p>
                  <p className="body-copy text-[13px]">
                    Baseline {species.plantedCount.toLocaleString()} plants
                  </p>
                </div>
                {species.placement && (
                  <span className="public-status-pill">{species.placement}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="public-card" aria-labelledby="qr-survival-context-heading">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">Survival record</p>
              <h2 id="qr-survival-context-heading" className="section-title mt-1">
                Previous audit data
              </h2>
            </div>
            <span className="public-status-pill">
              {completedVisits.length} checked
            </span>
          </div>

          {site.latestAudit ? (
            <div className="mt-5 grid gap-2">
              <p className="section-title">{displayDate(site.latestAudit.auditedAt)}</p>
              <p className="body-copy">
                {site.latestAudit.survivingCount.toLocaleString()} of{' '}
                {site.plantedCount.toLocaleString()} alive
              </p>
              <p className="mono text-[14px]">
                {site.latestAudit.survivalRate}% survival · {site.latestAudit.photoCount} photos
              </p>
            </div>
          ) : (
            <p className="body-copy mt-5">
              No previous survival audit has been recorded for this plantation.
            </p>
          )}

          <ol className="public-visit-list mt-5">
            {site.auditVisits.slice(0, 6).map((visit) => (
              <li key={visit.id} className="public-visit-card" data-status={visit.status}>
                <div className="public-visit-head">
                  <div>
                    <p className="mono text-[13px]">{visit.cycleLabel}</p>
                    <h3>{visit.auditedAt ? `Checked on ${displayDate(visit.auditedAt)}` : 'Scheduled visit'}</h3>
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
                  {visit.survivingCount !== null && (
                    <div>
                      <dt>Surviving</dt>
                      <dd>{visit.survivingCount.toLocaleString()}</dd>
                    </div>
                  )}
                  {visit.survivalRate && (
                    <div>
                      <dt>Survival</dt>
                      <dd>{visit.survivalRate}%</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section className="public-card" aria-labelledby="qr-check-form-heading">
          <div className="public-section-header">
            <div>
              <p className="eyebrow">Field capture</p>
              <h2 id="qr-check-form-heading" className="section-title mt-1">
                Record scanned-site check
              </h2>
            </div>
          </div>

          <div className="mt-5">
            {!window ? (
              <div className="grid gap-3">
                <p className="body-copy">No check window is open today.</p>
                {nextScheduledWindow && (
                  <p className="body-copy text-[14px]">
                    Next check: {nextScheduledWindow.cycleLabel}, due{' '}
                    {displayDate(nextScheduledWindow.dueDate)}.
                  </p>
                )}
                <Link className="secondary-button justify-self-start" href={`/p/${site.locationId}`}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>Back to public record</span>
                </Link>
              </div>
            ) : (
              <AuditCheckForm
                siteId={site.id}
                locationId={site.locationId}
                species={site.species}
                window={window}
                returnTo="public"
              />
            )}
          </div>
        </section>
      </article>
    </main>
  )
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

function isWindowOpenForCheck(window: AdminAuditWindow, today: string): boolean {
  return (
    window.status === 'scheduled' &&
    window.dueDate <= today &&
    window.graceUntil >= today
  )
}
