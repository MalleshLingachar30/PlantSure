import Link from 'next/link'
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  MapPinned,
  PanelTop,
  ScanLine,
  ShieldCheck,
  Shovel,
  Sprout,
  Truck,
} from 'lucide-react'

export type WorkflowStep = 'registration' | 'detail' | 'board' | 'public'

export type SiteWorkflowMenuProps = {
  siteId: string
  locationId: string
  locationCode?: string
  siteName?: string
  stage: string
  status: string
  windowsCount: number
  active: WorkflowStep
}

const workflowLinks: Array<{
  key: WorkflowStep
  label: string
  href: (siteId: string, locationId: string) => string
  icon: typeof MapPinned
  external?: boolean
}> = [
  {
    key: 'registration',
    label: 'Registration',
    href: () => '/admin',
    icon: ClipboardCheck,
  },
  {
    key: 'detail',
    label: 'Site detail',
    href: (siteId) => `/sites/${siteId}`,
    icon: MapPinned,
  },
  {
    key: 'board',
    label: 'Board',
    href: (siteId) => `/sites/${siteId}/board`,
    icon: PanelTop,
  },
  {
    key: 'public',
    label: 'Public record',
    href: (_siteId, locationId) => `/p/${locationId}`,
    icon: ScanLine,
    external: true,
  },
]

const lifecycleStages: Array<{
  key: string
  label: string
  detail: string
  icon: typeof Sprout
}> = [
  {
    key: 'land_identified',
    label: 'Land identified',
    detail: 'Site exists',
    icon: MapPinned,
  },
  {
    key: 'land_verified',
    label: 'Land verified',
    detail: 'Custody checked',
    icon: ShieldCheck,
  },
  {
    key: 'species_configured',
    label: 'Species entered',
    detail: 'Baseline rows',
    icon: Sprout,
  },
  {
    key: 'material_arranged',
    label: 'Materials ready',
    detail: 'Intake complete',
    icon: Truck,
  },
  {
    key: 'pits_dug',
    label: 'Pits dug',
    detail: 'Photo required',
    icon: Shovel,
  },
  {
    key: 'planted',
    label: 'Planted',
    detail: 'Photo required',
    icon: Sprout,
  },
  {
    key: 'submitted_for_acceptance',
    label: 'Submitted',
    detail: 'Sponsor review',
    icon: FileCheck2,
  },
  {
    key: 'accepted',
    label: 'Accepted',
    detail: 'Baseline signed',
    icon: CheckCircle2,
  },
]

export function SiteLifecycleMenu({
  siteId,
  locationId,
  locationCode = locationId,
  siteName,
  stage,
  status,
  windowsCount,
  active,
  compact = false,
}: SiteWorkflowMenuProps & { compact?: boolean }) {
  const currentIndex = Math.max(
    0,
    lifecycleStages.findIndex((item) => item.key === stage),
  )

  return (
    <section
      className={compact ? 'site-lifecycle-menu site-lifecycle-menu-compact' : 'site-lifecycle-menu'}
      aria-label="Site workflow"
    >
      <div className="site-menu-summary">
        <p className="eyebrow">Current site</p>
        <p className="site-menu-location">{locationCode}</p>
        {siteName && <p className="site-menu-name">{siteName}</p>}
      </div>

      <nav className="site-menu-links" aria-label="Site pages">
        {workflowLinks.map((item) => {
          const Icon = item.icon
          const href = item.href(siteId, locationId)

          return (
            <Link
              key={item.key}
              href={href}
              className="site-menu-link"
              data-active={active === item.key}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
              {item.external && <ExternalLink size={12} aria-hidden="true" />}
            </Link>
          )
        })}
      </nav>

      <div className="site-stage-list" aria-label="Planting lifecycle">
        <div className="site-stage-heading">
          <span className="eyebrow">Lifecycle</span>
          <span>{stageSummary(stage, status, windowsCount)}</span>
        </div>

        {lifecycleStages.map((item, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
          const Icon = item.icon
          const StateIcon = state === 'done' ? CheckCircle2 : state === 'current' ? CircleDot : Circle

          return (
            <div key={item.key} className="site-stage-item" data-state={state}>
              <span className="site-stage-connector" aria-hidden="true" />
              <span className="site-stage-state" aria-hidden="true">
                <StateIcon size={15} />
              </span>
              <span className="site-stage-icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="site-stage-copy">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </span>
            </div>
          )
        })}

        <div className="site-stage-item site-stage-monitoring" data-state={status === 'counts_confirmed' ? 'current' : 'upcoming'}>
          <span className="site-stage-connector" aria-hidden="true" />
          <span className="site-stage-state" aria-hidden="true">
            {status === 'counts_confirmed' ? <CircleDot size={15} /> : <Circle size={15} />}
          </span>
          <span className="site-stage-icon" aria-hidden="true">
            <CalendarCheck size={15} />
          </span>
          <span className="site-stage-copy">
            <strong>Monitoring</strong>
            <span>
              {status === 'counts_confirmed'
                ? `${windowsCount} checks scheduled`
                : 'Starts after confirm'}
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}

function stageSummary(stage: string, status: string, windowsCount: number): string {
  if (status === 'counts_confirmed') {
    return `${windowsCount} checks live`
  }

  if (stage === 'material_arranged') {
    return 'Ready for field photos'
  }

  if (stage === 'pits_dug') {
    return 'Planting photo next'
  }

  if (stage === 'planted') {
    return 'Awaiting acceptance'
  }

  return stageLabel(stage)
}

function stageLabel(stage: string): string {
  const match = lifecycleStages.find((item) => item.key === stage)

  return match?.label ?? stage
}
