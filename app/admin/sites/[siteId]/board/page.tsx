import QRCode from 'qrcode'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/print-button'
import { SiteWorkflowNav } from '@/components/site-workflow-nav'
import { requireAdminMember } from '@/lib/auth-member'
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
  await withDatabase(requireAdminMember)

  const site = await getAdminSiteDetail(siteId)

  if (!site) {
    notFound()
  }

  const publicUrl = siteUrl(`/p/${site.locationId}`)
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 360,
    color: {
      dark: '#1f1e1b',
      light: '#ffffff',
    },
  })

  return (
    <main className="min-h-screen px-5 py-6 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-[1100px]">
        <SiteWorkflowNav
          siteId={site.id}
          locationId={site.locationId}
          active="board"
        />
      </div>

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
              <p className="eyebrow">Scan to view</p>
              <p className="body-copy mt-2 break-all text-[13px]">{publicUrl}</p>
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
            deliberately large so a damaged QR does not block a visit.
          </p>
          <div className="mt-6 grid gap-3">
            <Link className="secondary-button" href={`/admin/sites/${site.id}`}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to site detail</span>
            </Link>
            <a className="command-button text-center" href={publicUrl}>
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open public page</span>
            </a>
            <PrintButton />
          </div>
        </aside>
      </div>
    </main>
  )
}
