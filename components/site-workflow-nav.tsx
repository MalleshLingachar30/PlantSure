import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'

type WorkflowStep = 'registration' | 'detail' | 'board' | 'public'

export function SiteWorkflowNav({
  siteId,
  locationId,
  active,
}: {
  siteId: string
  locationId: string
  active: WorkflowStep
}) {
  const steps: Array<{
    key: WorkflowStep
    label: string
    href: string
    external?: boolean
  }> = [
    { key: 'registration', label: 'Registration', href: '/admin' },
    { key: 'detail', label: 'Site detail', href: `/sites/${siteId}` },
    { key: 'board', label: 'Board', href: `/sites/${siteId}/board` },
    { key: 'public', label: 'Public page', href: `/p/${locationId}`, external: true },
  ]

  return (
    <nav className="workflow-nav print:hidden" aria-label="Site workflow">
      {steps.map((step, index) => (
        <div key={step.key} className="workflow-step-wrap">
          {index > 0 && <ArrowRight className="workflow-arrow" aria-hidden="true" />}
          <Link
            href={step.href}
            className="workflow-step"
            data-active={active === step.key}
            aria-current={active === step.key ? 'step' : undefined}
          >
            <span>{step.label}</span>
            {step.external && <ExternalLink size={13} aria-hidden="true" />}
          </Link>
        </div>
      ))}
    </nav>
  )
}
