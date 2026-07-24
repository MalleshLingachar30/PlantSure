import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck,
  ClipboardList,
  Home,
  MapPinned,
  Sprout,
} from 'lucide-react'
import type { AuthenticatedMember } from '@/lib/auth-member'
import { SignOutControl } from '@/components/sign-out-control'
import {
  SiteLifecycleMenu,
  type SiteWorkflowMenuProps,
} from '@/components/site-workflow-nav'

type InternalSection = 'register' | 'sites' | 'auditor'

type InternalShellProps = {
  active: InternalSection
  children: ReactNode
  member?: Pick<AuthenticatedMember, 'displayName' | 'email' | 'role'> | null
  siteMenu?: SiteWorkflowMenuProps
}

const navigation: Array<{
  key: InternalSection
  label: string
  href: string
  icon: typeof ClipboardList
}> = [
  {
    key: 'register',
    label: 'Register a site',
    href: '/admin',
    icon: ClipboardList,
  },
  {
    key: 'sites',
    label: 'View records',
    href: '/admin#sites',
    icon: MapPinned,
  },
  {
    key: 'auditor',
    label: 'My audits',
    href: '/auditor',
    icon: ClipboardCheck,
  },
]

export function InternalShell({ active, children, member, siteMenu }: InternalShellProps) {
  const name = member?.displayName || member?.email || 'Signed in'
  const email = member?.displayName ? member.email : null

  return (
    <main className="internal-shell">
      <aside className="internal-sidebar print:hidden" aria-label="Internal navigation">
        <div className="internal-sidebar-body">
          <Link href="/" className="internal-brand" aria-label="PlantSure home">
            <span className="internal-brand-mark">
              <Sprout size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="internal-brand-name">PlantSure</span>
              <span className="internal-brand-subtitle">Field console</span>
            </span>
          </Link>

          <nav className="internal-nav" aria-label="Primary">
            <p className="internal-nav-label">Work</p>
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="internal-nav-item"
                  data-active={active === item.key}
                  aria-current={active === item.key ? 'page' : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {siteMenu && <SiteLifecycleMenu {...siteMenu} />}
        </div>

        <div className="internal-sidebar-footer">
          <div className="internal-user">
            <p>{name}</p>
            {email && <span>{email}</span>}
            {member?.role && <span className="internal-user-role">{member.role}</span>}
          </div>
          <SignOutControl />
        </div>
      </aside>

      <div className="internal-main">
        <header className="internal-topbar print:hidden">
          <Link href="/" className="internal-topbar-brand" aria-label="PlantSure home">
            <Sprout size={17} aria-hidden="true" />
            <span>PlantSure</span>
          </Link>
          <nav className="internal-topbar-nav" aria-label="Primary">
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="internal-topbar-link"
                  data-active={active === item.key}
                  aria-current={active === item.key ? 'page' : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
          <Link href="/" className="internal-home-button" aria-label="Home">
            <Home size={16} aria-hidden="true" />
          </Link>
          <SignOutControl />
        </header>

        {siteMenu && (
          <div className="internal-mobile-site-menu print:hidden">
            <SiteLifecycleMenu {...siteMenu} compact />
          </div>
        )}

        <div className="internal-content">{children}</div>
      </div>
    </main>
  )
}
