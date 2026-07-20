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
  stage: string
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
  id: string
  sequenceNumber: number
  cycleLabel: string
  dueDate: string
  graceUntil: string
  status: string
}

export type AdminSiteDetail = AdminSiteSummary & {
  latitude: string
  longitude: string
  plantingPhotoUrls: string[]
  landOwnership: string
  landCustodian: string | null
  approvalReference: string | null
  isSharedParcel: boolean
  watchAndWard: boolean
  boundaryPoints: AdminBoundaryPoint[]
  plantationType: string
  windows: AdminAuditWindow[]
  stageEvidence: AdminStageEvidence[]
  species: AdminBatchSpecies[]
}

export type AdminBoundaryPoint = {
  lat: number
  lng: number
}

export type AdminStageEvidence = {
  id: string
  stage: string
  url: string
  capturedAt: string
  caption: string | null
}

export type AdminBatchSpecies = {
  speciesName: string
  plantedCount: number
  spacingNotes: string | null
  placement: string | null
}

export type PublicSiteDetail = AdminSiteSummary & {
  latitude: string
  longitude: string
  plantingPhotoUrls: string[]
  stageEvidence: PublicPlantingEvidence[]
  latestAudit: {
    auditedAt: string
    survivingCount: number
    survivalRate: string
    photoCount: number
  } | null
  auditVisits: PublicAuditVisit[]
}

export type PublicPlantingEvidence = {
  id: string
  stage: string
  url: string
  capturedAt: string
  caption: string | null
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
      stage: string
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
          sites.stage::text,
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
      stage: row.stage,
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
      stage: string
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
          sites.stage::text,
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
      stage: row.stage,
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

  const {
    detail,
    windows,
    stageEvidence,
    species,
  } = await withDatabase(async (client) => {
    const detailResult = await client.query<{
      latitude: string
      longitude: string
      planting_photo_urls: string[] | null
      land_ownership: string
      land_custodian: string | null
      approval_reference: string | null
      is_shared_parcel: boolean
      watch_and_ward: boolean
      boundary_points: unknown
      plantation_type: string
    }>(
      `
        select
          latitude::text,
          longitude::text,
          planting_photo_urls,
          land_ownership::text,
          land_custodian,
          approval_reference,
          is_shared_parcel,
          watch_and_ward,
          boundary_points,
          plantation_type::text
        from plantation_sites
        where id = $1
      `,
      [siteId],
    )
    const windowsResult = await client.query<{
      id: string
      sequence_number: number
      cycle_label: string
      due_date: Date | string
      grace_until: Date | string
      status: string
    }>(
      `
        select id, sequence_number, cycle_label, due_date, grace_until, status
        from plantation_audit_windows
        where site_id = $1
        order by sequence_number
      `,
      [siteId],
    )
    const evidenceResult = await client.query<{
      id: string
      stage: string
      url: string
      captured_at: Date | string
      caption: string | null
    }>(
      `
        select id, stage::text, url, captured_at, caption
        from plantation_evidence
        where site_id = $1
          and stage in ('pits_dug', 'planted')
        order by captured_at desc, received_at desc
      `,
      [siteId],
    )
    const speciesResult = await client.query<{
      species_name: string
      planted_count: number
      spacing_notes: string | null
      placement: string | null
    }>(
      `
        select species_name, planted_count, spacing_notes, placement
        from plantation_batch_species
        where site_id = $1
        order by species_name
      `,
      [siteId],
    )

    return {
      detail: detailResult.rows[0],
      windows: windowsResult.rows.map((row) => ({
        id: row.id,
        sequenceNumber: row.sequence_number,
        cycleLabel: row.cycle_label,
        dueDate: dateString(row.due_date),
        graceUntil: dateString(row.grace_until),
        status: row.status,
      })),
      stageEvidence: evidenceResult.rows.map((row) => ({
        id: row.id,
        stage: row.stage,
        url: row.url,
        capturedAt: timestampDateString(row.captured_at),
        caption: row.caption,
      })),
      species: speciesResult.rows.map((row) => ({
        speciesName: row.species_name,
        plantedCount: row.planted_count,
        spacingNotes: row.spacing_notes,
        placement: row.placement,
      })),
    }
  })

  if (!detail) {
    return null
  }

  return {
    ...site,
    latitude: detail.latitude,
    longitude: detail.longitude,
    plantingPhotoUrls: detail.planting_photo_urls ?? [],
    landOwnership: detail.land_ownership,
    landCustodian: detail.land_custodian,
    approvalReference: detail.approval_reference,
    isSharedParcel: detail.is_shared_parcel,
    watchAndWard: detail.watch_and_ward,
    boundaryPoints: normalizeBoundaryPoints(detail.boundary_points),
    plantationType: detail.plantation_type,
    windows,
    stageEvidence,
    species,
  }
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
      stage: string
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
          sites.stage::text,
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
    const stageEvidence = await client.query<{
      id: string
      stage: string
      url: string
      captured_at: Date | string
      caption: string | null
    }>(
      `
        select id, stage::text, url, captured_at, caption
        from plantation_evidence
        where site_id = $1
          and stage in ('pits_dug', 'planted')
        order by
          case stage
            when 'planted' then 1
            when 'pits_dug' then 2
            else 3
          end,
          captured_at desc,
          received_at desc
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
      stageEvidence: stageEvidence.rows.map((evidence) => ({
        id: evidence.id,
        stage: evidence.stage,
        url: evidence.url,
        capturedAt: timestampDateString(evidence.captured_at),
        caption: evidence.caption,
      })),
      plantedCount: row.planted_count,
      plantingDate: dateString(row.planting_date),
      speciesNotes: row.species_notes,
      status: row.status,
      stage: row.stage,
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

function normalizeBoundaryPoints(value: unknown): AdminBoundaryPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null
      }

      const lat = Number((point as { lat?: unknown }).lat)
      const lng = Number((point as { lng?: unknown }).lng)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null
      }

      return { lat, lng }
    })
    .filter((point): point is AdminBoundaryPoint => point !== null)
}
