import type { AuthenticatedMember } from '@/lib/auth-member'

type Queryable = {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>
}

export type AdvisorAuditSite = {
  id: string
  locationId: string
  name: string
  village: string
  district: string
  plantedCount: number
  plantingDate: string
  stage: string
  status: string
  scientificAdvisorName: string
  scheduledWindows: number
  openAssignments: number
  acceptedAssignments: number
}

export async function listAdvisorAuditSites(
  db: Queryable,
  member: AuthenticatedMember,
): Promise<AdvisorAuditSite[]> {
  if (member.role !== 'admin' && member.role !== 'manager') {
    return []
  }

  const email = member.email?.trim().toLowerCase() ?? ''
  const result = await db.query<{
    id: string
    location_id: string
    name: string
    village: string
    district: string
    planted_count: number
    planting_date: Date | string
    stage: string
    status: string
    scientific_advisor_name: string
    scheduled_windows: string
    open_assignments: string
    accepted_assignments: string
  }>(
    `
      select
        sites.id,
        sites.location_id,
        sites.name,
        sites.village,
        sites.district,
        sites.planted_count,
        sites.planting_date,
        sites.stage::text,
        sites.status,
        advisors.name as scientific_advisor_name,
        count(distinct windows.id) filter (where windows.status = 'scheduled')::text as scheduled_windows,
        count(distinct assignments.id) filter (where assignments.status in ('assigned', 'accepted'))::text as open_assignments,
        count(distinct assignments.id) filter (where assignments.status = 'accepted')::text as accepted_assignments
      from plantation_sites sites
      join plantation_programs programs on programs.id = sites.program_id
      join plantation_organizations organizations on organizations.id = programs.organization_id
      join plantation_scientific_advisors advisors
        on advisors.id = organizations.scientific_advisor_id
      left join plantation_audit_windows windows on windows.site_id = sites.id
      left join plantation_audit_assignments assignments on assignments.site_id = sites.id
      where $1 = 'admin'
        or lower(btrim(coalesce(advisors.contact_email, ''))) = $2
      group by sites.id, advisors.name
      order by sites.created_at desc
    `,
    [member.role, email],
  )

  return result.rows.map((row) => ({
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    village: row.village,
    district: row.district,
    plantedCount: row.planted_count,
    plantingDate: dateString(row.planting_date),
    stage: row.stage,
    status: row.status,
    scientificAdvisorName: row.scientific_advisor_name,
    scheduledWindows: Number(row.scheduled_windows),
    openAssignments: Number(row.open_assignments),
    acceptedAssignments: Number(row.accepted_assignments),
  }))
}

function dateString(value: Date | string): string {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  return value
}

