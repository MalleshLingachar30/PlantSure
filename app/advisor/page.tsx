import Link from 'next/link'
import { ClipboardCheck, MapPinned, UserPlus } from 'lucide-react'
import { InternalShell } from '@/components/internal-shell'
import { listAdvisorAuditSites, type AdvisorAuditSite } from '@/lib/advisor-data'
import { requirePlantationMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdvisorDashboardPage() {
  const { member, sites } = await withDatabase(async (client) => {
    const currentMember = await requirePlantationMember(client)

    return {
      member: currentMember,
      sites: await listAdvisorAuditSites(client, currentMember),
    }
  })

  return (
    <InternalShell active="advisor" member={member}>
      <div className="mx-auto max-w-[1040px]">
        <header className="border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
          <p className="eyebrow">Scientific institution</p>
          <h1 className="page-title mt-3">Audit operations</h1>
          <p className="body-copy mt-3">
            Institution admins register auditors and allocate scheduled checks
            for the planting projects advised by their scientific institution.
          </p>
        </header>

        {member.role !== 'admin' && member.role !== 'manager' ? (
          <section className="admin-panel mt-7" aria-labelledby="advisor-access-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Access</p>
                <h2 id="advisor-access-heading" className="section-title mt-1">
                  Scientific institution admin required
                </h2>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p className="body-copy">
                This dashboard is available to the contact email configured on a
                PlantSure scientific advisor record.
              </p>
            </div>
          </section>
        ) : sites.length === 0 ? (
          <section className="admin-panel mt-7" aria-labelledby="advisor-empty-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">No projects</p>
                <h2 id="advisor-empty-heading" className="section-title mt-1">
                  No advised sites found
                </h2>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p className="body-copy">
                Add this institution&apos;s contact email to the scientific advisor
                master record, then advised planting sites will appear here.
              </p>
            </div>
          </section>
        ) : (
          <section className="admin-panel mt-7" aria-labelledby="advisor-sites-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Projects</p>
                <h2 id="advisor-sites-heading" className="section-title mt-1">
                  Sites ready for audit management
                </h2>
              </div>
              <span className="public-status-pill">{sites.length} sites</span>
            </div>
            <div className="grid gap-4 p-5 sm:p-6">
              {sites.map((site) => (
                <AdvisorSiteCard key={site.id} site={site} />
              ))}
            </div>
          </section>
        )}
      </div>
    </InternalShell>
  )
}

function AdvisorSiteCard({ site }: { site: AdvisorAuditSite }) {
  return (
    <article className="repeat-row items-start">
      <div className="grid gap-3">
        <div>
          <p className="site-id text-[16px]">{site.locationId}</p>
          <h3 className="section-title mt-1">{site.name}</h3>
          <p className="body-copy mt-1">
            {site.village}, {site.district} · {site.scientificAdvisorName}
          </p>
        </div>
        <dl className="public-evidence-facts">
          <div>
            <dt>Plants</dt>
            <dd>{site.plantedCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Planted</dt>
            <dd>{site.plantingDate}</dd>
          </div>
          <div>
            <dt>Scheduled</dt>
            <dd>{site.scheduledWindows}</dd>
          </div>
          <div>
            <dt>Open orders</dt>
            <dd>{site.openAssignments}</dd>
          </div>
          <div>
            <dt>Accepted</dt>
            <dd>{site.acceptedAssignments}</dd>
          </div>
        </dl>
      </div>
      <div className="grid min-w-[210px] gap-3 justify-items-start sm:justify-items-end">
        <span className="public-status-pill">{site.stage.replaceAll('_', ' ')}</span>
        <Link className="command-button" href={`/sites/${site.id}?console=1`}>
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>Allocate audits</span>
        </Link>
        <Link className="secondary-button" href={`/sites/${site.id}?console=1#site-auditors-heading`}>
          <UserPlus size={16} aria-hidden="true" />
          <span>Onboard auditors</span>
        </Link>
        <Link className="secondary-button" href={`/p/${site.locationId}`}>
          <MapPinned size={16} aria-hidden="true" />
          <span>Public record</span>
        </Link>
      </div>
    </article>
  )
}

