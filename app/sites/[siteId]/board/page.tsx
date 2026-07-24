import QRCode from 'qrcode'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { notFound } from 'next/navigation'
import { InternalShell } from '@/components/internal-shell'
import { PrintButton } from '@/components/print-button'
import { requirePlantationMember } from '@/lib/auth-member'
import { getAdminSiteDetail } from '@/lib/admin-data'
import { withDatabase } from '@/lib/db'
import { displayDate, siteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const member = await withDatabase((client) => requirePlantationMember(client))

  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const isOwnerApprover =
    member.role === 'technician' &&
    Boolean(member.email) &&
    Boolean(site.ownerApproverEmail) &&
    member.email!.trim().toLowerCase() === site.ownerApproverEmail!.trim().toLowerCase()

  if (member.role === 'technician' && !isOwnerApprover) {
    notFound()
  }

  const publicPath = `/p/${site.locationId}`
  const auditPath = `/p/${site.locationId}/check`
  const auditUrl = siteUrl(auditPath)
  const qrDataUrl = await QRCode.toDataURL(auditUrl, {
    margin: 1,
    width: 360,
    color: {
      dark: '#1f1e1b',
      light: '#ffffff',
    },
  })

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
        active: 'board',
      }}
    >

      <div className="mx-auto mt-5 grid max-w-[1100px] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="board-sheet" aria-labelledby="board-heading">
          <div className="board-brand">
            <span>PlantSure</span>
          </div>
          <div className="board-rule" />

          <p className="board-site-id">{site.locationId}</p>

          <div className="board-copy">
            <h1 id="board-heading" className="serif">
              {site.name}
            </h1>
            <p>{site.programName}</p>
            <p>
              {site.village}, {site.district}
            </p>
          </div>

          <p className="board-count">
            {site.plantedCount.toLocaleString()} plants ·{' '}
            {displayDate(site.plantingDate)}
          </p>
          {site.speciesNotes && (
            <p className="board-monitoring">{site.speciesNotes}</p>
          )}
          {site.monitoringEnd && (
            <p className="board-monitoring">
              Monitored to {displayDate(site.monitoringEnd)}
            </p>
          )}

          <div className="board-qr-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code for ${site.locationId}`} />
            <div>
              <p className="eyebrow">Scan to audit</p>
              <p className="body-copy mt-2 break-all text-[13px]">{auditUrl}</p>
            </div>
          </div>

          {site.status !== 'counts_confirmed' && (
            <p className="board-draft">Confirm planting details before printing.</p>
          )}
        </section>

        <aside className="admin-rail print:hidden">
          <h2 className="section-title mt-3">Site board</h2>
          <p className="body-copy mt-3">
            Print this page after planting details are confirmed. The Site ID is
            deliberately large so a damaged QR does not block a visit. The QR
            opens the inspector audit template for this plantation.
          </p>
          <div className="mt-6 grid gap-3">
            <Link className="secondary-button" href={`/sites/${site.id}?console=1`}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to site detail</span>
            </Link>
            <Link className="command-button text-center" href={publicPath}>
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open public page</span>
            </Link>
            <Link className="command-button text-center" href={auditPath}>
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open QR audit template</span>
            </Link>
            <PrintButton />
          </div>
        </aside>
      </div>
    </InternalShell>
  )
}
