import { randomUUID } from 'node:crypto'
import {
  advanceWindowState,
  type AuditWindowStatus,
  type TransactionClient,
  type TransactionRunner,
} from './plantation-registration'

export type RecordAuditCheckInput = {
  windowId: string
  auditorMemberId: string
  auditedAt: string
  speciesResults: AuditSpeciesResultInput[]
  photoUrls: string[]
  latitude?: string | null
  longitude?: string | null
  gpsAccuracyM?: string | null
  gpsStatus: 'confirmed' | 'plausible' | 'questionable' | 'unavailable'
  remarks?: string | null
}

export type AuditSpeciesResultInput = {
  speciesName: string
  survivingCount: number
}

export type RecordAuditCheckResult = {
  auditId: string
  status: AuditWindowStatus
}

export type MarkMissedWindowsResult = {
  scanned: number
  missed: number
}

type WindowForAudit = {
  id: string
  site_id: string
  status: AuditWindowStatus
  planted_count: number
}

type BaselineSpeciesRow = {
  species_name: string
  planted_count: number
}

export async function recordAuditCheck(
  db: TransactionRunner,
  input: RecordAuditCheckInput,
): Promise<RecordAuditCheckResult> {
  return transaction(db, async (tx) => {
    const windowResult = await tx.query<WindowForAudit>(
      `
        select
          windows.id,
          windows.site_id,
          windows.status,
          sites.planted_count
        from plantation_audit_windows windows
        join plantation_sites sites on sites.id = windows.site_id
        where windows.id = $1
        for update of windows
      `,
      [input.windowId],
    )
    const window = windowResult.rows[0]

    if (!window) {
      throw new Error('Audit window not found')
    }

    if (window.status === 'completed' || window.status === 'waived') {
      throw new Error('Audit window is not open for checks')
    }

    const baseline = await tx.query<BaselineSpeciesRow>(
      `
        select species_name, planted_count
        from plantation_batch_species
        where site_id = $1
        order by species_name
      `,
      [window.site_id],
    )
    const speciesResults = normalizedSpeciesResults(input.speciesResults, baseline.rows)
    const survivingCount = speciesResults.reduce(
      (total, row) => total + row.survivingCount,
      0,
    )
    const photoUrls = input.photoUrls.map((url) => url.trim()).filter(Boolean)

    if (photoUrls.length === 0) {
      throw new Error('At least one audit photo is required')
    }

    if (survivingCount > window.planted_count) {
      throw new Error('Surviving count cannot exceed planted count')
    }

    const audit = await tx.query<{ id: string }>(
      `
        insert into plantation_audits (
          site_id,
          window_id,
          client_uuid,
          auditor_member_id,
          audited_at,
          access_method,
          planted_count,
          surviving_count,
          latitude,
          longitude,
          gps_accuracy_m,
          gps_status,
          photo_urls,
          remarks
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          'manual',
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        returning id
      `,
      [
        window.site_id,
        window.id,
        randomUUID(),
        input.auditorMemberId,
        input.auditedAt,
        window.planted_count,
        survivingCount,
        input.latitude || null,
        input.longitude || null,
        input.gpsAccuracyM || null,
        input.gpsStatus,
        JSON.stringify(photoUrls),
        input.remarks || null,
      ],
    )
    const auditId = audit.rows[0]?.id

    if (!auditId) {
      throw new Error('Failed to record audit')
    }

    await insertAuditSpeciesResults(tx, auditId, speciesResults)
    await insertAuditEvidence(tx, {
      siteId: window.site_id,
      auditId,
      photoUrls,
      capturedAt: input.auditedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      gpsAccuracyM: input.gpsAccuracyM,
      uploadedByMemberId: input.auditorMemberId,
    })
    await tx.query(
      `
        update plantation_audit_windows
        set audit_id = $2
        where id = $1
      `,
      [window.id, auditId],
    )
    const status = await advanceWindowState(tx, {
      windowId: window.id,
      toState: 'completed',
      actor: input.auditorMemberId,
    })

    return { auditId, status }
  })
}

export async function markMissedAuditWindows(
  db: TransactionRunner,
  input: { asOfDate?: string; limit?: number } = {},
): Promise<MarkMissedWindowsResult> {
  return transaction(db, async (tx) => {
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10)
    const limit = input.limit ?? 100
    const windows = await tx.query<{ id: string }>(
      `
        select id
        from plantation_audit_windows
        where status = 'scheduled'
          and grace_until < $1
        order by grace_until, due_date, sequence_number
        limit $2
        for update skip locked
      `,
      [asOfDate, limit],
    )
    let missed = 0

    for (const window of windows.rows) {
      await advanceWindowState(tx, {
        windowId: window.id,
        toState: 'missed',
        actor: 'cron',
      })
      missed += 1
    }

    return { scanned: windows.rows.length, missed }
  })
}

function normalizedSpeciesResults(
  inputRows: AuditSpeciesResultInput[],
  baselineRows: BaselineSpeciesRow[],
): Array<BaselineSpeciesRow & { survivingCount: number }> {
  const bySpecies = new Map(
    inputRows.map((row) => [row.speciesName.trim(), row.survivingCount]),
  )

  if (baselineRows.length === 0) {
    throw new Error('Baseline species rows are required before checks')
  }

  return baselineRows.map((baseline) => {
    const survivingCount = bySpecies.get(baseline.species_name)

    if (
      survivingCount === undefined ||
      !Number.isInteger(survivingCount) ||
      survivingCount < 0 ||
      survivingCount > baseline.planted_count
    ) {
      throw new Error('Each species requires a valid surviving count')
    }

    return {
      ...baseline,
      survivingCount,
    }
  })
}

async function insertAuditSpeciesResults(
  tx: TransactionClient,
  auditId: string,
  speciesResults: Array<BaselineSpeciesRow & { survivingCount: number }>,
): Promise<void> {
  for (const result of speciesResults) {
    await tx.query(
      `
        insert into plantation_audit_species_results (
          audit_id,
          species_name,
          planted_count,
          surviving_count
        ) values (
          $1,
          $2,
          $3,
          $4
        )
      `,
      [auditId, result.species_name, result.planted_count, result.survivingCount],
    )
  }
}

async function insertAuditEvidence(
  tx: TransactionClient,
  input: {
    siteId: string
    auditId: string
    photoUrls: string[]
    capturedAt: string
    latitude?: string | null
    longitude?: string | null
    gpsAccuracyM?: string | null
    uploadedByMemberId: string
  },
): Promise<void> {
  for (const url of input.photoUrls) {
    await tx.query(
      `
        insert into plantation_evidence (
          site_id,
          stage,
          audit_id,
          url,
          captured_at,
          latitude,
          longitude,
          gps_accuracy,
          uploaded_by
        ) values (
          $1,
          'monitoring',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
      `,
      [
        input.siteId,
        input.auditId,
        url,
        input.capturedAt,
        input.latitude || null,
        input.longitude || null,
        input.gpsAccuracyM || null,
        input.uploadedByMemberId,
      ],
    )
  }
}

async function transaction<T>(
  db: TransactionRunner,
  run: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  await db.query('begin')

  try {
    const result = await run(db)
    await db.query('commit')

    return result
  } catch (error) {
    await db.query('rollback')
    throw error
  }
}
