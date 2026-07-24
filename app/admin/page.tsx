import Link from 'next/link'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { registerPilotSite } from './actions'
import { GeographySelects } from '@/components/geography-selects'
import { InternalShell } from '@/components/internal-shell'
import { RegistrationDetails } from '@/components/registration-details'
import { requirePlantationMember, requireSignedIn } from '@/lib/auth-member'
import { getAdminOverview } from '@/lib/admin-data'
import { hasDatabaseUrl, withDatabase } from '@/lib/db'
import { KARNATAKA_GEOGRAPHIES } from '@/lib/karnataka-geography'
import { listPlantationDirectory } from '@/lib/plantation-directory'

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const member = hasDatabaseUrl()
    ? await withDatabase((client) => requirePlantationMember(client))
    : null

  if (!member) {
    await requireSignedIn()
  } else if (member.role === 'manager') {
    redirect('/advisor')
  } else if (member.role === 'auditor') {
    redirect('/auditor')
  } else if (member.role !== 'admin') {
    redirect('/')
  }

  const [{ error }, overview, directory] = await Promise.all([
    searchParams,
    getAdminOverview(),
    hasDatabaseUrl()
      ? withDatabase((client) => listPlantationDirectory(client))
      : Promise.resolve({ scientificAdvisors: [], organizations: [] }),
  ])
  const formDisabled = !overview.configured

  return (
    <InternalShell active="register" member={member}>
      <div className="admin-page-grid">
        <aside className="admin-rail">
          <div className="border-b pb-5" style={{ borderColor: 'var(--rule)' }}>
            <Link href="/" className="eyebrow hover:underline">
              PlantSure
            </Link>
            <h1 className="page-title mt-3">Site registration</h1>
            <p className="body-copy mt-3">
              Register planting details, confirm them once, then create the five-year
              check schedule.
            </p>
          </div>

          <dl className="admin-metrics mt-6">
            <Metric label="Sites" value={overview.sites.length.toString()} />
            <Metric
              label="Locked"
              value={overview.sites
                .filter((site) => site.status === 'counts_confirmed')
                .length.toString()}
            />
            <Metric
              label="Windows"
              value={overview.sites
                .reduce((total, site) => total + site.windowsCount, 0)
                .toString()}
            />
          </dl>
        </aside>

        <div className="grid gap-7">
          {!overview.configured && <DatabaseSetup />}
          {error && <ErrorNotice />}

          <section id="register" className="admin-panel" aria-labelledby="register-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">New site</p>
                <h2 id="register-heading" className="section-title mt-1">
                  Register planting details
                </h2>
              </div>
            </div>

            <form action={registerPilotSite} className="grid gap-7 p-5 sm:p-6">
              <fieldset className="form-grid" disabled={formDisabled}>
                <legend className="form-legend">Programme</legend>
                <TextField
                  label="Programme name"
                  name="programName"
                  defaultValue="Sindhi Seva Samaj 2026"
                  disabled={formDisabled}
                  required
                />
                <TextField
                  label="Escalation email"
                  name="escalationEmail"
                  type="email"
                  defaultValue="ml@feedbacknfc.com"
                  disabled={formDisabled}
                  required
                />
              </fieldset>

              <fieldset className="form-grid" disabled={formDisabled}>
                <legend className="form-legend">Scientific advisory</legend>
                <SelectField label="Use existing advisor" name="scientificAdvisorId" disabled={formDisabled}>
                  <option value="">Create new scientific advisor</option>
                  {directory.scientificAdvisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.name}
                      {advisor.contactEmail ? ` · ${advisor.contactEmail}` : ''}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Advisor type"
                  name="scientificAdvisorType"
                  defaultValue="scientific_institute"
                  disabled={formDisabled}
                >
                  <option value="scientific_institute">Scientific institute</option>
                  <option value="forest_department">Forest department</option>
                  <option value="university">University</option>
                  <option value="independent">Independent expert</option>
                  <option value="other">Other</option>
                </SelectField>
                <TextField
                  label="Advisor name"
                  name="scientificAdvisorName"
                  defaultValue="Institute of Agroforestry and Forest Technology"
                  disabled={formDisabled}
                />
                <TextField
                  label="Advisor contact"
                  name="scientificAdvisorContactName"
                  defaultValue="IAFT coordination desk"
                  disabled={formDisabled}
                />
                <TextField
                  label="Advisor email"
                  name="scientificAdvisorContactEmail"
                  type="email"
                  defaultValue="ml@feedbacknfc.com"
                  disabled={formDisabled}
                />
                <TextField
                  label="Advisor phone"
                  name="scientificAdvisorContactPhone"
                  defaultValue="047257"
                  disabled={formDisabled}
                />
              </fieldset>

              <fieldset className="form-grid" disabled={formDisabled}>
                <legend className="form-legend">Planting organization</legend>
                <SelectField label="Use existing organization" name="organizationId" disabled={formDisabled}>
                  <option value="">Create new planting organization</option>
                  {directory.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                      {organization.ownerApproverEmail ? ` · ${organization.ownerApproverEmail}` : ''}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Organization type"
                  name="organizationType"
                  defaultValue="institution"
                  disabled={formDisabled}
                >
                  <option value="institution">Institution</option>
                  <option value="corporate">Corporate</option>
                  <option value="foundation">Foundation</option>
                  <option value="government">Government</option>
                  <option value="community">Community group</option>
                  <option value="other">Other</option>
                </SelectField>
                <TextField
                  label="Organization name"
                  name="organizationName"
                  defaultValue="Sindhi Seva Samaj"
                  disabled={formDisabled}
                />
                <TextField
                  label="Owner approver name"
                  name="ownerApproverName"
                  defaultValue="Project owner approver"
                  disabled={formDisabled}
                />
                <TextField
                  label="Owner approver email"
                  name="ownerApproverEmail"
                  type="email"
                  disabled={formDisabled}
                />
                <TextField
                  label="Organization contact"
                  name="organizationContactName"
                  defaultValue="Field coordinator"
                  disabled={formDisabled}
                />
                <TextField
                  label="Organization email"
                  name="organizationContactEmail"
                  type="email"
                  disabled={formDisabled}
                />
                <TextField
                  label="Organization phone"
                  name="organizationContactPhone"
                  disabled={formDisabled}
                />
              </fieldset>

              <fieldset className="form-grid" disabled={formDisabled}>
                <legend className="form-legend">Site</legend>
                <TextField label="Site name" name="siteName" defaultValue="Gubbi pilot" disabled={formDisabled} required />
                <GeographySelects
                  options={KARNATAKA_GEOGRAPHIES}
                  disabled={formDisabled}
                />
                <TextField label="Village / locality" name="village" defaultValue="Gubbi" disabled={formDisabled} required />
              </fieldset>

              <fieldset className="form-grid" disabled={formDisabled}>
                <legend className="form-legend">Baseline</legend>
                <TextField label="Planting date" name="plantingDate" type="date" defaultValue="2026-07-15" disabled={formDisabled} required />
                <label className="field sm:col-span-2">
                  <span>Planting photo URLs</span>
                  <textarea
                    name="plantingPhotoUrls"
                    rows={3}
                    className="input resize-none"
                    placeholder="One photo URL per line"
                    disabled={formDisabled}
                  />
                </label>
              </fieldset>

              <RegistrationDetails disabled={formDisabled} />

              <div className="flex justify-end border-t pt-5" style={{ borderColor: 'var(--rule)' }}>
                <button className="command-button" type="submit" disabled={formDisabled}>
                  Register site
                </button>
              </div>
            </form>
          </section>

          <section id="sites" className="admin-panel" aria-labelledby="sites-heading">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Current sites</p>
                <h2 id="sites-heading" className="section-title mt-1">
                  Registered baselines
                </h2>
              </div>
            </div>

            {overview.sites.length > 0 ? (
              <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
                {overview.sites.map((site) => (
                  <Link key={site.id} href={`/sites/${site.id}?console=1`} className="site-row">
                    <span className="site-id">{site.locationId}</span>
                    <span>
                      <span className="block font-medium">{site.name}</span>
                      <span className="body-copy text-[13px]">
                        {site.village}, {site.taluk} · {site.plantedCount.toLocaleString()} planted
                      </span>
                    </span>
                    <StatusLabel status={site.status} windowsCount={site.windowsCount} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="body-copy p-5 sm:p-6">No sites registered.</p>
            )}
          </section>
        </div>
      </div>
    </InternalShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-line">
      <dt className="eyebrow">{label}</dt>
      <dd className="big-number mt-1 text-[24px]">{value}</dd>
    </div>
  )
}

function DatabaseSetup() {
  return (
    <div className="admin-notice" role="status">
      <p className="eyebrow">Database</p>
      <p className="mt-2 font-medium">DATABASE_URL is not set.</p>
      <p className="body-copy mt-1 text-[14px]">
        Registration writes are disabled until the app is pointed at Postgres.
      </p>
    </div>
  )
}

function ErrorNotice() {
  return (
    <div className="admin-notice" role="alert">
      <p className="eyebrow">Not saved</p>
      <p className="mt-2 font-medium">Check the required fields and try again.</p>
    </div>
  )
}

function TextField({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  inputMode,
  maxLength,
  min,
  disabled,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
  maxLength?: number
  min?: number
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
        disabled={disabled}
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  disabled,
  children,
}: {
  label: string
  name: string
  defaultValue?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" name={name} defaultValue={defaultValue} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function StatusLabel({
  status,
  windowsCount,
}: {
  status: string
  windowsCount: number
}) {
  const locked = status === 'counts_confirmed'

  return (
    <span
      className="justify-self-start text-[13px] sm:justify-self-end"
      style={{ color: locked ? 'var(--alive)' : 'var(--ink-soft)' }}
    >
      {locked ? `${windowsCount} checks created` : 'Counts open'}
    </span>
  )
}
