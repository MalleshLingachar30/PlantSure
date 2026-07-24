import Link from 'next/link'
import { ClipboardCheck, ExternalLink, MapPinned, QrCode } from 'lucide-react'
import { AuditorPwaPanel } from '@/components/auditor-pwa-panel'
import { InternalShell } from '@/components/internal-shell'
import { listAuditorAssignments, type AuditorAssignment } from '@/lib/audit-assignments'
import { requirePlantationMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import { displayDate } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function AuditorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ accepted?: string; error?: string }>
}) {
  const [{ accepted, error }, { member, assignments }] = await Promise.all([
    searchParams,
    withDatabase(async (client) => {
      const currentMember = await requirePlantationMember(client)
      const email = currentMember.email?.trim().toLowerCase()

      return {
        member: currentMember,
        assignments:
          currentMember.role === 'auditor' && email
            ? await listAuditorAssignments(client, email)
            : [],
      }
    }),
  ])
  const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted')
  const assignedAssignments = assignments.filter((assignment) => assignment.status === 'assigned')
  const submittedAssignments = assignments.filter((assignment) => assignment.status === 'submitted')

  return (
    <InternalShell active="auditor" member={member}>
      <div className="mx-auto max-w-[960px]">
        <header className="border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
          <p className="eyebrow">Field PWA</p>
          <h1 className="page-title mt-3">My audit assignments</h1>
          <p className="body-copy mt-3">
            Accept an audit order before travelling. At the plantation, scan the
            site board QR to unlock the audit form for that accepted order.
          </p>
        </header>

        <AuditorPwaPanel />

        {accepted && (
          <div className="admin-notice mt-6" role="status">
            <p className="eyebrow">Audit accepted</p>
            <p className="mt-2 font-medium">
              The order is ready for field visit and QR scan.
            </p>
          </div>
        )}

        {error && (
          <div className="admin-notice mt-6" role="alert">
            <p className="eyebrow">Action not saved</p>
            <p className="mt-2 font-medium">
              This assignment may already be accepted, submitted, or attached to another auditor email.
            </p>
          </div>
        )}

        {member.role !== 'auditor' ? (
          <section className="admin-panel mt-7" aria-labelledby="auditor-role-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Auditor access</p>
                <h2 id="auditor-role-heading" className="section-title mt-1">
                  Sign in as a registered auditor
                </h2>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:p-6">
              <p className="body-copy">
                This dashboard is for auditor work orders. Admins allocate audit
                orders from the site record in the PlantSure portal.
              </p>
              <Link className="secondary-button justify-self-start" href="/admin">
                <ClipboardCheck size={16} aria-hidden="true" />
                <span>Open admin portal</span>
              </Link>
            </div>
          </section>
        ) : assignments.length === 0 ? (
          <section className="admin-panel mt-7" aria-labelledby="empty-audits-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">No work orders</p>
                <h2 id="empty-audits-heading" className="section-title mt-1">
                  Nothing assigned right now
                </h2>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p className="body-copy">
                When a PlantSure admin allocates a scheduled audit window to
                your email, it will appear here.
              </p>
            </div>
          </section>
        ) : (
          <div className="mt-7 grid gap-7">
            {acceptedAssignments.length > 0 && (
              <AssignmentGroup
                title="Ready for site visit"
                eyebrow="Accepted"
                assignments={acceptedAssignments}
              />
            )}
            {assignedAssignments.length > 0 && (
              <AssignmentGroup
                title="Needs acceptance"
                eyebrow="Assigned"
                assignments={assignedAssignments}
              />
            )}
            {submittedAssignments.length > 0 && (
              <AssignmentGroup
                title="Submitted history"
                eyebrow="Completed"
                assignments={submittedAssignments}
              />
            )}
          </div>
        )}
      </div>
    </InternalShell>
  )
}

function AssignmentGroup({
  title,
  eyebrow,
  assignments,
}: {
  title: string
  eyebrow: string
  assignments: AuditorAssignment[]
}) {
  return (
    <section className="admin-panel" aria-labelledby={`${eyebrow}-assignments-heading`}>
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${eyebrow}-assignments-heading`} className="section-title mt-1">
            {title}
          </h2>
        </div>
        <span className="public-status-pill">{assignments.length} orders</span>
      </div>
      <div className="grid gap-4 p-5 sm:p-6">
        {assignments.map((assignment) => (
          <AuditAssignmentCard key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </section>
  )
}

function AuditAssignmentCard({ assignment }: { assignment: AuditorAssignment }) {
  const accepted = assignment.status === 'accepted'
  const submitted = assignment.status === 'submitted'

  return (
    <article className="repeat-row items-start">
      <div className="grid gap-3">
        <div>
          <p className="site-id text-[16px]">{assignment.locationId}</p>
          <h3 className="section-title mt-1">{assignment.siteName}</h3>
          <p className="body-copy mt-1">
            {assignment.village}, {assignment.district}
          </p>
        </div>
        <dl className="public-evidence-facts">
          <div>
            <dt>Window</dt>
            <dd>{assignment.cycleLabel}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{displayDate(assignment.dueDate)}</dd>
          </div>
          <div>
            <dt>Grace</dt>
            <dd>{displayDate(assignment.graceUntil)}</dd>
          </div>
          <div>
            <dt>Plants</dt>
            <dd>{assignment.plantedCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Last survival</dt>
            <dd>{assignment.latestSurvivalRate ? `${assignment.latestSurvivalRate}%` : 'No audit yet'}</dd>
          </div>
          {submitted && assignment.submittedAt && (
            <div>
              <dt>Submitted</dt>
              <dd>{displayDate(assignment.submittedAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="grid min-w-[190px] gap-3 justify-items-start sm:justify-items-end">
        <span className="public-status-pill">
          {submitted ? 'Submitted' : accepted ? 'Accepted' : 'Assigned'}
        </span>
        {submitted ? (
          <Link className="secondary-button" href={`/p/${assignment.locationId}`}>
            <ExternalLink size={16} aria-hidden="true" />
            <span>View public record</span>
          </Link>
        ) : accepted ? (
          <>
            <Link className="command-button" href={`/p/${assignment.locationId}/check`}>
              <QrCode size={16} aria-hidden="true" />
              <span>Scan board QR</span>
            </Link>
            <Link
              className="secondary-button"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${assignment.latitude},${assignment.longitude}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPinned size={16} aria-hidden="true" />
              <span>Open map</span>
            </Link>
          </>
        ) : (
          <form action={`/auditor/assignments/${assignment.id}/accept`} method="post">
            <button className="command-button" type="submit">
              <ClipboardCheck size={16} aria-hidden="true" />
              Accept order
            </button>
          </form>
        )}
      </div>
    </article>
  )
}
