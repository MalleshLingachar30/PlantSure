import type { AuthenticatedMember } from '@/lib/auth-member'

type Queryable = {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>
}

export type AuditAssignmentStatus = 'assigned' | 'accepted' | 'submitted' | 'cancelled'

export type AuditorAssignment = {
  id: string
  siteId: string
  locationId: string
  siteName: string
  village: string
  district: string
  latitude: string
  longitude: string
  windowId: string
  cycleLabel: string
  dueDate: string
  graceUntil: string
  status: AuditAssignmentStatus
  assignedAt: string
  acceptedAt: string | null
  submittedAt: string | null
  plantedCount: number
  latestSurvivalRate: string | null
  auditId: string | null
}

export async function assignAuditWindow(
  db: Queryable,
  input: {
    siteId: string
    windowId: string
    siteAuditorId: string
    assignedByMemberId: string
  },
): Promise<{ assignmentId: string; auditorEmail: string; locationId: string }> {
  const result = await db.query<{
    assignment_id: string
    auditor_email: string
    location_id: string
  }>(
    `
      with selected_window as (
        select id, site_id
        from plantation_audit_windows
        where id = $2
          and site_id = $1
          and status = 'scheduled'
      ),
      selected_auditor as (
        select id, site_id, email
        from plantation_site_auditors
        where id = $3
          and site_id = $1
          and active = true
      )
      insert into plantation_audit_assignments (
        site_id,
        window_id,
        site_auditor_id,
        auditor_email,
        assigned_by_member_id
      )
      select
        selected_window.site_id,
        selected_window.id,
        selected_auditor.id,
        selected_auditor.email,
        $4
      from selected_window
      join selected_auditor on selected_auditor.site_id = selected_window.site_id
      join plantation_sites sites on sites.id = selected_window.site_id
      returning
        id as assignment_id,
        auditor_email,
        (select location_id from plantation_sites where id = $1) as location_id
    `,
    [input.siteId, input.windowId, input.siteAuditorId, input.assignedByMemberId],
  )
  const row = result.rows[0]

  if (!row) {
    throw new Error('Audit assignment target is not available')
  }

  return {
    assignmentId: row.assignment_id,
    auditorEmail: row.auditor_email,
    locationId: row.location_id,
  }
}

export async function listAuditorAssignments(
  db: Queryable,
  email: string,
): Promise<AuditorAssignment[]> {
  const result = await db.query<{
    id: string
    site_id: string
    location_id: string
    site_name: string
    village: string
    district: string
    latitude: string
    longitude: string
    window_id: string
    cycle_label: string
    due_date: Date | string
    grace_until: Date | string
    status: AuditAssignmentStatus
    assigned_at: Date | string
    accepted_at: Date | string | null
    submitted_at: Date | string | null
    planted_count: number
    latest_survival_rate: string | null
    audit_id: string | null
  }>(
    `
      select
        assignments.id,
        assignments.site_id,
        sites.location_id,
        sites.name as site_name,
        sites.village,
        sites.district,
        sites.latitude::text,
        sites.longitude::text,
        assignments.window_id,
        windows.cycle_label,
        windows.due_date,
        windows.grace_until,
        assignments.status,
        assignments.assigned_at,
        assignments.accepted_at,
        assignments.submitted_at,
        sites.planted_count,
        latest_audits.survival_rate::text as latest_survival_rate,
        window_audits.id as audit_id
      from plantation_audit_assignments assignments
      join plantation_sites sites on sites.id = assignments.site_id
      join plantation_audit_windows windows on windows.id = assignments.window_id
      left join plantation_audits window_audits on window_audits.id = windows.audit_id
      left join lateral (
        select audits.survival_rate
        from plantation_audits audits
        where audits.site_id = assignments.site_id
        order by audits.audited_at desc
        limit 1
      ) latest_audits on true
      where lower(btrim(assignments.auditor_email)) = $1
        and assignments.status in ('assigned', 'accepted', 'submitted')
      order by
        case assignments.status
          when 'accepted' then 1
          when 'assigned' then 2
          when 'submitted' then 3
          else 4
        end,
        windows.due_date asc,
        assignments.assigned_at asc
    `,
    [email.trim().toLowerCase()],
  )

  return result.rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    locationId: row.location_id,
    siteName: row.site_name,
    village: row.village,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    windowId: row.window_id,
    cycleLabel: row.cycle_label,
    dueDate: dateString(row.due_date),
    graceUntil: dateString(row.grace_until),
    status: row.status,
    assignedAt: timestampDateString(row.assigned_at),
    acceptedAt: row.accepted_at ? timestampDateString(row.accepted_at) : null,
    submittedAt: row.submitted_at ? timestampDateString(row.submitted_at) : null,
    plantedCount: row.planted_count,
    latestSurvivalRate: row.latest_survival_rate,
    auditId: row.audit_id,
  }))
}

export async function acceptAuditAssignment(
  db: Queryable,
  input: {
    assignmentId: string
    member: AuthenticatedMember
  },
): Promise<{ locationId: string }> {
  const email = input.member.email?.trim().toLowerCase()

  if (!email) {
    throw new Error('Auditor email is required')
  }

  const result = await db.query<{ location_id: string }>(
    `
      update plantation_audit_assignments assignments
      set
        status = 'accepted',
        accepted_by_member_id = $2,
        accepted_at = now(),
        updated_at = now()
      from plantation_sites sites
      where assignments.id = $1
        and sites.id = assignments.site_id
        and assignments.status = 'assigned'
        and lower(btrim(assignments.auditor_email)) = $3
      returning sites.location_id
    `,
    [input.assignmentId, input.member.id, email],
  )
  const row = result.rows[0]

  if (!row) {
    throw new Error('Audit assignment could not be accepted')
  }

  return { locationId: row.location_id }
}

export async function hasAcceptedAuditAssignment(
  db: Queryable,
  input: {
    siteId: string
    windowId: string
    email: string
  },
): Promise<boolean> {
  const result = await db.query<{ matched: boolean }>(
    `
      select exists(
        select 1
        from plantation_audit_assignments
        where site_id = $1
          and window_id = $2
          and status = 'accepted'
          and lower(btrim(auditor_email)) = $3
      ) as matched
    `,
    [input.siteId, input.windowId, input.email.trim().toLowerCase()],
  )

  return result.rows[0]?.matched === true
}

export async function markAuditAssignmentSubmitted(
  db: Queryable,
  input: {
    siteId: string
    windowId: string
    auditorEmail: string
  },
): Promise<void> {
  await db.query(
    `
      update plantation_audit_assignments
      set
        status = 'submitted',
        submitted_at = now(),
        updated_at = now()
      where site_id = $1
        and window_id = $2
        and status = 'accepted'
        and lower(btrim(auditor_email)) = $3
    `,
    [input.siteId, input.windowId, input.auditorEmail.trim().toLowerCase()],
  )
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

function timestampDateString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return value.slice(0, 10)
}
