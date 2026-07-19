import { hasDatabaseUrl, withDatabase } from './db'

export type AdminSiteSummary = {
  id: string
  programId: string
  programName: string
  locationId: string
  name: string
  district: string
  taluk: string
  village: string
  plantedCount: number
  plantingDate: string
  speciesNotes: string | null
  status: string
  monitoringStart: string | null
  monitoringEnd: string | null
  windowsCount: number
  generatedEventsCount: number
}

export type AdminOverview =
  | {
      configured: false
      sites: []
    }
  | {
      configured: true
      sites: AdminSiteSummary[]
    }

export type AdminAuditWindow = {
  sequenceNumber: number
  cycleLabel: string
  dueDate: string
  graceUntil: string
  status: string
}

export type AdminSiteDetail = AdminSiteSummary & {
  windows: AdminAuditWindow[]
}

export type PublicSiteDetail = AdminSiteSummary & {
  latitude: string
  longitude: string
  plantingPhotoUrls: string[]
  latestAudit: {
    auditedAt: string
    survivingCount: number
    survivalRate: string
    photoCount: number
  } | null
  auditVisits: PublicAuditVisit[]
}

export type PublicAuditVisit = {
  sequenceNumber: number
  cycleLabel: string
  dueDate: string
  graceUntil: string
  status: string
  auditedAt: string | null
  survivingCount: number | null
  survivalRate: string | null
  latitude: string | null
  longitude: string | null
  gpsAccuracyM: string | null
  gpsStatus: string | null
  photoUrls: string[]
  remarks: string | null
}

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!hasDatabaseUrl()) {
    return { configured: false, sites: [] }
  }

  const sites = await withDatabase(async (client) => {
    const result = await client.query<{
      id: string
      program_id: string
      program_name: string
      location_id: string
      name: string
      district: string
      taluk: string
      village: string
      latitude: string
      longitude: string
      planting_photo_urls: string[] | null
      planted_count: number
      planting_date: Date | string
      species_notes: string | null
      status: string
      monitoring_start: Date | string | null
      monitoring_end: Date | string | null
      windows_count: string
      generated_events_count: string
    }>(
      `
        select
          sites.id,
          sites.program_id,
          programs.name as program_name,
          sites.location_id,
          sites.name,
          sites.district,
          sites.taluk,
          sites.village,
          sites.latitude::text,
          sites.longitude::text,
          sites.planting_photo_urls,
          sites.planted_count,
          sites.planting_date,
          sites.species_notes,
          sites.status,
          sites.monitoring_start,
          sites.monitoring_end,
          count(distinct windows.id)::text as windows_count,
          count(distinct events.id)::text as generated_events_count
        from plantation_sites sites
        join plantation_programs programs on programs.id = sites.program_id
        left join plantation_audit_windows windows on windows.site_id = sites.id
        left join plantation_window_events events
          on events.window_id = windows.id
          and events.event_type = 'generated'
        where programs.is_demo = false
        group by sites.id, programs.name
        order by sites.created_at desc
        limit 20
      `,
    )

    return result.rows.map((row) => ({
      id: row.id,
      programId: row.program_id,
      programName: row.program_name,
      locationId: row.location_id,
      name: row.name,
      district: row.district,
      taluk: row.taluk,
      village: row.village,
      plantedCount: row.planted_count,
      plantingDate: dateString(row.planting_date),
      speciesNotes: row.species_notes,
      status: row.status,
      monitoringStart: row.monitoring_start ? dateString(row.monitoring_start) : null,
      monitoringEnd: row.monitoring_end ? dateString(row.monitoring_end) : null,
      windowsCount: Number(row.windows_count),
      generatedEventsCount: Number(row.generated_events_count),
    }))
  })

  return { configured: true, sites }
}

export async function getAdminSite(siteId: string): Promise<AdminSiteSummary | null> {
  if (!hasDatabaseUrl()) {
    return null
  }

  return withDatabase(async (client) => {
    const result = await client.query<{
      id: string
      program_id: string
      program_name: string
      location_id: string
      name: string
      district: string
      taluk: string
      village: string
      latitude: string
      longitude: string
      planting_photo_urls: string[] | null
      planted_count: number
      planting_date: Date | string
      species_notes: string | null
      status: string
      monitoring_start: Date | string | null
      monitoring_end: Date | string | null
      windows_count: string
      generated_events_count: string
    }>(
      `
        select
          sites.id,
          sites.program_id,
          programs.name as program_name,
          sites.location_id,
          sites.name,
          sites.district,
          sites.taluk,
          sites.village,
          sites.latitude::text,
          sites.longitude::text,
          sites.planting_photo_urls,
          sites.planted_count,
          sites.planting_date,
          sites.species_notes,
          sites.status,
          sites.monitoring_start,
          sites.monitoring_end,
          count(distinct windows.id)::text as windows_count,
          count(distinct events.id)::text as generated_events_count
        from plantation_sites sites
        join plantation_programs programs on programs.id = sites.program_id
        left join plantation_audit_windows windows on windows.site_id = sites.id
        left join plantation_window_events events
          on events.window_id = windows.id
          and events.event_type = 'generated'
        where sites.id = $1
          and programs.is_demo = false
        group by sites.id, programs.name
      `,
      [siteId],
    )
    const row = result.rows[0]

    if (!row) {
      return null
    }

    return {
      id: row.id,
      programId: row.program_id,
      programName: row.program_name,
      locationId: row.location_id,
      name: row.name,
      district: row.district,
      taluk: row.taluk,
      village: row.village,
      plantedCount: row.planted_count,
      plantingDate: dateString(row.planting_date),
      speciesNotes: row.species_notes,
      status: row.status,
      monitoringStart: row.monitoring_start ? dateString(row.monitoring_start) : null,
      monitoringEnd: row.monitoring_end ? dateString(row.monitoring_end) : null,
      windowsCount: Number(row.windows_count),
      generatedEventsCount: Number(row.generated_events_count),
    }
  })
}

export async function getAdminSiteDetail(siteId: string): Promise<AdminSiteDetail | null> {
  const site = await getAdminSite(siteId)

  if (!site) {
    return null
  }

  const windows = await withDatabase(async (client) => {
    const result = await client.query<{
      sequence_number: number
      cycle_label: string
      due_date: Date | string
      grace_until: Date | string
      status: string
    }>(
      `
        select sequence_number, cycle_label, due_date, grace_until, status
        from plantation_audit_windows
        where site_id = $1
        order by sequence_number
      `,
      [siteId],
    )

    return result.rows.map((row) => ({
      sequenceNumber: row.sequence_number,
      cycleLabel: row.cycle_label,
      dueDate: dateString(row.due_date),
      graceUntil: dateString(row.grace_until),
      status: row.status,
    }))
  })

  return { ...site, windows }
}

export async function getPublicSiteByLocationId(
  locationId: string,
): Promise<PublicSiteDetail | null> {
  if (!hasDatabaseUrl()) {
    return null
  }

  return withDatabase(async (client) => {
    const result = await client.query<{
      id: string
      program_id: string
      program_name: string
      location_id: string
      name: string
      district: string
      taluk: string
      village: string
      latitude: string
      longitude: string
      planting_photo_urls: string[] | null
      planted_count: number
      planting_date: Date | string
      species_notes: string | null
      status: string
      monitoring_start: Date | string | null
      monitoring_end: Date | string | null
      windows_count: string
      generated_events_count: string
    }>(
      `
        select
          sites.id,
          sites.program_id,
          programs.name as program_name,
          sites.location_id,
          sites.name,
          sites.district,
          sites.taluk,
          sites.village,
          sites.latitude::text,
          sites.longitude::text,
          sites.planting_photo_urls,
          sites.planted_count,
          sites.planting_date,
          sites.species_notes,
          sites.status,
          sites.monitoring_start,
          sites.monitoring_end,
          count(distinct windows.id)::text as windows_count,
          count(distinct events.id)::text as generated_events_count
        from plantation_sites sites
        join plantation_programs programs on programs.id = sites.program_id
        left join plantation_audit_windows windows on windows.site_id = sites.id
        left join plantation_window_events events
          on events.window_id = windows.id
          and events.event_type = 'generated'
        where sites.location_id = upper($1)
        group by sites.id, programs.name
      `,
      [locationId.trim()],
    )
    const row = result.rows[0]

    if (!row) {
      return null
    }

    const latestAudit = await client.query<{
      audited_at: Date | string
      surviving_count: number
      survival_rate: string
      photo_count: number
    }>(
      `
        select
          audited_at,
          surviving_count,
          survival_rate::text,
          jsonb_array_length(photo_urls) as photo_count
        from plantation_audits
        where site_id = $1
        order by audited_at desc
        limit 1
      `,
      [row.id],
    )
    const audit = latestAudit.rows[0]
    const auditVisits = await client.query<{
      sequence_number: number
      cycle_label: string
      due_date: Date | string
      grace_until: Date | string
      status: string
      audited_at: Date | string | null
      surviving_count: number | null
      survival_rate: string | null
      latitude: string | null
      longitude: string | null
      gps_accuracy_m: string | null
      gps_status: string | null
      photo_urls: string[] | null
      remarks: string | null
    }>(
      `
        select
          windows.sequence_number,
          windows.cycle_label,
          windows.due_date,
          windows.grace_until,
          windows.status,
          audits.audited_at,
          audits.surviving_count,
          audits.survival_rate::text,
          audits.latitude::text,
          audits.longitude::text,
          audits.gps_accuracy_m::text,
          audits.gps_status::text,
          audits.photo_urls,
          audits.remarks
        from plantation_audit_windows windows
        left join plantation_audits audits on audits.window_id = windows.id
        where windows.site_id = $1
        order by windows.sequence_number
      `,
      [row.id],
    )

    return {
      id: row.id,
      programId: row.program_id,
      programName: row.program_name,
      locationId: row.location_id,
      name: row.name,
      district: row.district,
      taluk: row.taluk,
      village: row.village,
      latitude: row.latitude,
      longitude: row.longitude,
      plantingPhotoUrls: row.planting_photo_urls ?? [],
      plantedCount: row.planted_count,
      plantingDate: dateString(row.planting_date),
      speciesNotes: row.species_notes,
      status: row.status,
      monitoringStart: row.monitoring_start ? dateString(row.monitoring_start) : null,
      monitoringEnd: row.monitoring_end ? dateString(row.monitoring_end) : null,
      windowsCount: Number(row.windows_count),
      generatedEventsCount: Number(row.generated_events_count),
      latestAudit: audit
        ? {
            auditedAt: timestampDateString(audit.audited_at),
            survivingCount: audit.surviving_count,
            survivalRate: audit.survival_rate,
            photoCount: audit.photo_count,
          }
        : null,
      auditVisits: auditVisits.rows.map((visit) => ({
        sequenceNumber: visit.sequence_number,
        cycleLabel: visit.cycle_label,
        dueDate: dateString(visit.due_date),
        graceUntil: dateString(visit.grace_until),
        status: visit.status,
        auditedAt: visit.audited_at ? timestampDateString(visit.audited_at) : null,
        survivingCount: visit.surviving_count,
        survivalRate: visit.survival_rate,
        latitude: visit.latitude,
        longitude: visit.longitude,
        gpsAccuracyM: visit.gps_accuracy_m,
        gpsStatus: visit.gps_status,
        photoUrls: visit.photo_urls ?? [],
        remarks: visit.remarks,
      })),
    }
  })
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
