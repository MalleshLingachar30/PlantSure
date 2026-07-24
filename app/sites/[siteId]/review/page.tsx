import Link from 'next/link'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, Sprout } from 'lucide-react'
import { notFound } from 'next/navigation'
import { SignOutControl } from '@/components/sign-out-control'
import { requirePlantationMember } from '@/lib/auth-member'
import { getAdminSiteDetail } from '@/lib/admin-data'
import { withDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function OwnerReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ approved?: string; error?: string }>
}) {
  const [{ siteId }, { approved, error }] = await Promise.all([params, searchParams])
  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const reviewPath = `/sites/${site.id}/review`
  const session = await auth()

  if (!session.userId) {
    if (await ownerAccountExists(site.ownerApproverEmail)) {
      session.redirectToSignIn({ returnBackUrl: reviewPath })
    }

    session.redirectToSignUp({ returnBackUrl: reviewPath })
  }

  const member = await withDatabase((client) => requirePlantationMember(client))
  const signedInEmail = member.email?.trim().toLowerCase() ?? null
  const ownerEmail = site.ownerApproverEmail?.trim().toLowerCase() ?? null
  const isOwnerApprover = Boolean(signedInEmail && ownerEmail && signedInEmail === ownerEmail)
  const canApprove =
    isOwnerApprover &&
    site.stage === 'submitted_for_acceptance' &&
    !site.acceptance?.acceptedAt &&
    !site.acceptance?.rejectedAt
  const alreadyApproved = Boolean(site.acceptance?.acceptedAt || approved)
  const pitsEvidence = site.stageEvidence
    .filter((evidence) => evidence.stage === 'pits_dug')
    .map((evidence) => ({
      id: evidence.id,
      label: 'Pits dug photo',
      detail: evidence.capturedAt,
      url: evidence.url,
      caption: evidence.caption,
    }))
  const plantedEvidence = site.stageEvidence
    .filter((evidence) => evidence.stage === 'planted')
    .map((evidence) => ({
      id: evidence.id,
      label: 'Planted photo',
      detail: evidence.capturedAt,
      url: evidence.url,
      caption: evidence.caption,
    }))
  const baselineEvidence = site.plantingPhotoUrls.map((url, index) => ({
    id: `baseline-${index}`,
    label: 'Registration photo',
    detail: site.plantingDate,
    url,
    caption: null,
  }))

  return (
    <main className="min-h-screen bg-[var(--page)] px-5 py-6 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1040px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
          <Link href="/" className="internal-topbar-brand" aria-label="PlantSure home">
            <Sprout size={17} aria-hidden="true" />
            <span>PlantSure</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="internal-user">
              <p>{member.displayName || member.email || 'Signed in'}</p>
              {member.email && <span>{member.email}</span>}
              <span className="internal-user-role">{member.role}</span>
            </div>
            <SignOutControl redirectUrl={reviewPath} />
          </div>
        </header>

        <section className="mt-7 border-b pb-6" style={{ borderColor: 'var(--rule)' }}>
          <p className="eyebrow">Owner approval review</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="site-id">{site.locationId}</p>
              <h1 className="page-title mt-2">{site.name}</h1>
              <p className="body-copy mt-2">
                {site.village}, {site.taluk}, {site.district}
              </p>
              <p className="body-copy mt-2">
                {site.programName} · {site.organizationName}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <Metric label="Saplings" value={site.plantedCount.toLocaleString()} />
              <Metric label="Date" value={site.plantingDate} />
              <Metric label="Pits photos" value={pitsEvidence.length.toString()} />
              <Metric label="Plant photos" value={plantedEvidence.length.toString()} />
            </dl>
          </div>
        </section>

        {approved && (
          <Notice
            tone="success"
            title="Approved"
            message="The owner approval has been recorded for this plantation baseline."
          />
        )}

        {error && (
          <Notice
            tone="warning"
            title="Approval not recorded"
            message="The approval could not be recorded. Confirm this baseline is pending and that you are signed in as the assigned owner approver."
          />
        )}

        {!isOwnerApprover && (
          <Notice
            tone="warning"
            title="Wrong signed-in account"
            message={`This approval must be completed from ${site.ownerApproverEmail || 'the assigned owner approver email'}. Use Sign out on this page, then sign in with that owner account.`}
          />
        )}

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="admin-panel" aria-labelledby="review-evidence-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Evidence packet</p>
                <h2 id="review-evidence-heading" className="section-title mt-1">
                  Review photos before approval
                </h2>
              </div>
            </div>
            <div className="grid gap-6 p-5 sm:p-6">
              <EvidenceGroup
                title="Registration photos"
                emptyText="No registration photo URLs were recorded."
                evidence={baselineEvidence}
              />
              <EvidenceGroup
                title="Pits dug"
                emptyText="No pits-dug photo URLs were recorded."
                evidence={pitsEvidence}
              />
              <EvidenceGroup
                title="Planted"
                emptyText="No planted photo URLs were recorded."
                evidence={plantedEvidence}
              />
            </div>
          </section>

          <aside className="admin-panel self-start" aria-labelledby="approval-panel-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Decision</p>
                <h2 id="approval-panel-heading" className="section-title mt-1">
                  Owner approval
                </h2>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:p-6">
              <dl className="grid gap-4">
                <Detail label="Owner approver" value={site.ownerApproverEmail ?? 'Not configured'} />
                <Detail label="Current stage" value={stageLabel(site.stage)} />
                <Detail label="Submitted on" value={site.acceptance?.submittedAt ?? 'Not submitted'} />
                <Detail label="Approved on" value={site.acceptance?.acceptedAt ?? 'Not approved'} />
              </dl>

              {canApprove && (
                <form action={`/sites/${site.id}/acceptance`} method="post" className="grid gap-3">
                  <input type="hidden" name="action" value="accept" />
                  <input type="hidden" name="returnTo" value="review" />
                  <button className="command-button justify-center" type="submit">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Approve baseline
                  </button>
                </form>
              )}

              {!canApprove && alreadyApproved && (
                <p className="body-copy text-[14px]">
                  This baseline has already been approved. No further owner action is required.
                </p>
              )}

              {!canApprove && !alreadyApproved && isOwnerApprover && (
                <p className="body-copy text-[14px]">
                  Approval is available after the registrar submits the baseline for owner review.
                </p>
              )}

              <Link href={`/p/${site.locationId}`} className="secondary-button justify-center">
                <ExternalLink size={16} aria-hidden="true" />
                Open public record
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

async function ownerAccountExists(email: string | null): Promise<boolean> {
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    return false
  }

  try {
    const client = await clerkClient()
    const users = await client.users.getUserList({
      emailAddress: [normalizedEmail],
      limit: 1,
    })

    return users.data.length > 0
  } catch (error) {
    console.error('Failed to check owner Clerk account before review redirect', error)
    return false
  }
}

function Notice({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'warning'
  title: string
  message: string
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle

  return (
    <div className="admin-notice mt-6" role={tone === 'success' ? 'status' : 'alert'}>
      <div className="flex items-start gap-3">
        <Icon size={18} aria-hidden="true" />
        <div>
          <p className="eyebrow">{title}</p>
          <p className="mt-2 font-medium">{message}</p>
        </div>
      </div>
    </div>
  )
}

function EvidenceGroup({
  title,
  evidence,
  emptyText,
}: {
  title: string
  evidence: Array<{
    id: string
    label?: string
    detail: string
    url: string
    caption: string | null
  }>
  emptyText: string
}) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <div>
        <p className="eyebrow">{title}</p>
        <p className="body-copy mt-1 text-[14px]">{evidence.length} photo URL{evidence.length === 1 ? '' : 's'}</p>
      </div>
      <div className="lifecycle-evidence-links">
        {evidence.length > 0 ? (
          evidence.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
              <span>
                <span className="eyebrow">{item.label ?? 'Evidence photo'}</span>
                <strong>{item.detail}</strong>
                {item.caption && <span>{item.caption}</span>}
              </span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ))
        ) : (
          <p>{emptyText}</p>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--rule)' }}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function stageLabel(stage: string): string {
  return stage
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
