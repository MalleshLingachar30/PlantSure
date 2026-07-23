export type Queryable = {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>
}

export type TransactionClient = Queryable

export type TransactionRunner = Queryable & {
  query(text: 'begin' | 'commit' | 'rollback'): Promise<{ rows: Record<string, unknown>[] }>
}

export type AuditFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'annual'

export type CreateProgramInput = {
  organizationId: string
  name: string
  escalationEmail: string
  ownerApproverEmail?: string | null
  knowledgePartnerOrgId?: string | null
  implementerOrgId?: string | null
  monitoringYears?: number
  auditFrequency?: AuditFrequency
  survivalThreshold?: string
}

export type CreateProgramResult = {
  id: string
}

export type CreateSiteInput = {
  programId: string
  stateCode: string
  districtCode: string
  villageCode: string
  name: string
  district: string
  taluk: string
  village: string
  plantingDate: string
  plantingPhotoUrls?: string[]
  species: CreateSiteSpeciesInput[]
  landOwnership: LandOwnership
  landCustodian?: string | null
  approvalReference?: string | null
  isSharedParcel?: boolean
  watchAndWard?: boolean
  boundaryPoints: BoundaryPointInput[]
  plantationType: PlantationType
  createdByMemberId: string
}

export type CreateSiteSpeciesInput = {
  speciesName: string
  plantedCount: number
  spacingNotes?: string | null
  placement?: string | null
}

export type BoundaryPointInput = {
  latitude: string
  longitude: string
}

export type LandOwnership = 'government' | 'private' | 'institutional' | 'other'

export type PlantationType = 'block' | 'bund_only' | 'bund_and_block'

export type CreateSiteResult = {
  id: string
  locationId: string
  status: 'registered'
}

export type ConfirmCountsInput = {
  siteId: string
  monitoringStart: string
  actor?: string
}

export type ConfirmCountsResult = {
  siteId: string
  status: 'counts_confirmed'
  monitoringStart: string
  monitoringEnd: string
  windowsCreated: number
  alreadyConfirmed: boolean
}

export type AcceptanceRequestNotificationPayload = {
  notificationId: string
  acceptanceId: string
  recipientEmail: string
  subject: string
  siteId: string
  locationId: string
  siteName: string
  programName: string
  plantingDate: string
  plantedCount: number
  speciesSummary: Array<{ speciesName: string; plantedCount: number }>
}

export type LifecycleStage =
  | 'land_identified'
  | 'land_verified'
  | 'species_configured'
  | 'material_arranged'
  | 'pits_dug'
  | 'planted'
  | 'submitted_for_acceptance'
  | 'accepted'
  | 'monitoring'
  | 'archived'

export type AuditWindowStatus = 'scheduled' | 'completed' | 'missed' | 'waived'

export type StageEvidenceInput = {
  siteId: string
  stage: Extract<LifecycleStage, 'pits_dug' | 'planted'>
  photoUrls: string[]
  capturedAt: string
  uploadedByMemberId: string
  latitude?: string | null
  longitude?: string | null
  gpsAccuracy?: string | null
  caption?: string | null
}

type ProgramForWindows = {
  monitoring_years: number
  audit_frequency: AuditFrequency
}

type SiteForConfirmation = {
  id: string
  status: string
  stage: LifecycleStage
  monitoring_start: Date | string | null
  monitoring_end: Date | string | null
  program_id: string
}

type AcceptanceSnapshotSiteRow = {
  program_name: string
  location_id: string
  name: string
  district: string
  taluk: string
  village: string
  planting_date: Date | string
  planted_count: number
  species_notes: string | null
  land_ownership: string
  land_custodian: string | null
  approval_reference: string | null
  is_shared_parcel: boolean
  watch_and_ward: boolean
  boundary_points: unknown
  plantation_type: string
}

type AuditWindowInput = {
  siteId: string
  sequenceNumber: number
  cycleLabel: string
  dueDate: string
  graceUntil: string
}

const cyclesByFrequency: Record<AuditFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  annual: 1,
}

export async function createPlantationProgram(
  db: TransactionRunner,
  input: CreateProgramInput,
): Promise<CreateProgramResult> {
  return transaction(db, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `
        insert into plantation_programs (
          organization_id,
          name,
          owner_approver_email,
          knowledge_partner_org_id,
          implementer_org_id,
          monitoring_years,
          audit_frequency,
          survival_threshold,
          escalation_email
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        returning id
      `,
      [
        input.organizationId,
        input.name,
        input.ownerApproverEmail ?? null,
        input.knowledgePartnerOrgId ?? null,
        input.implementerOrgId ?? null,
        input.monitoringYears ?? 5,
        input.auditFrequency ?? 'quarterly',
        input.survivalThreshold ?? '85',
        input.escalationEmail,
      ],
    )

    const id = result.rows[0]?.id
    if (!id) {
      throw new Error('Failed to create plantation program')
    }

    return { id }
  })
}

export async function createPlantationSite(db: TransactionRunner, input: CreateSiteInput): Promise<CreateSiteResult> {
  return transaction(db, async (tx) => {
    const species = normalizedSpeciesRows(input)
    const boundaryPoints = normalizedBoundaryPoints(input.boundaryPoints)
    const firstBoundaryPoint = boundaryPoints[0]
    const plantedCount = species.reduce((total, row) => total + row.plantedCount, 0)

    if (!firstBoundaryPoint) {
      throw new Error('At least one boundary point is required')
    }

    const locationIdResult = await tx.query<{ location_id: string }>(
      `
        select allocate_plantation_location_id($1, $2, $3, $4) as location_id
      `,
      [input.programId, input.stateCode, input.districtCode, input.villageCode],
    )
    const locationId = locationIdResult.rows[0]?.location_id

    if (!locationId) {
      throw new Error('Failed to allocate Location ID')
    }

    const siteResult = await tx.query<{ id: string; status: 'registered' }>(
      `
        insert into plantation_sites (
          program_id,
          location_id,
          name,
          district,
          taluk,
          village,
          latitude,
          longitude,
          planted_count,
          planting_date,
          planting_photo_urls,
          species_notes,
          land_ownership,
          land_custodian,
          approval_reference,
          is_shared_parcel,
          watch_and_ward,
          boundary_points,
          plantation_type,
          created_by_member_id
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20
        )
        returning id, status
      `,
      [
        input.programId,
        locationId,
        input.name,
        input.district,
        input.taluk,
        input.village,
        firstBoundaryPoint.lat,
        firstBoundaryPoint.lng,
        plantedCount,
        input.plantingDate,
        JSON.stringify(input.plantingPhotoUrls ?? []),
        species.map((row) => row.speciesName).join(', '),
        input.landOwnership,
        input.landCustodian ?? null,
        input.approvalReference ?? null,
        input.isSharedParcel ?? false,
        input.watchAndWard ?? false,
        JSON.stringify(boundaryPoints),
        input.plantationType,
        input.createdByMemberId,
      ],
    )

    const site = siteResult.rows[0]
    if (!site) {
      throw new Error('Failed to create plantation site')
    }

    await insertBatchSpecies(tx, site.id, species)
    await advanceSiteThroughIntakeStages(tx, site.id, input.createdByMemberId)

    return {
      id: site.id,
      locationId,
      status: site.status,
    }
  })
}

async function advanceSiteThroughIntakeStages(
  tx: TransactionClient,
  siteId: string,
  actor: string,
): Promise<void> {
  const intakeStages: LifecycleStage[] = [
    'land_verified',
    'species_configured',
    'material_arranged',
  ]

  for (const stage of intakeStages) {
    await tx.query(
      `
        select advance_plantation_site_stage($1, $2, $3, $4)
      `,
      [siteId, stage, actor, 'Registered intake fields'],
    )
  }
}

function normalizedSpeciesRows(input: CreateSiteInput): CreateSiteSpeciesInput[] {
  const rows = input.species
    .map((row) => ({
      speciesName: row.speciesName.trim(),
      plantedCount: row.plantedCount,
      spacingNotes: row.spacingNotes?.trim() || null,
      placement: row.placement?.trim() || null,
    }))
    .filter((row) => row.speciesName.length > 0 || row.plantedCount > 0)

  if (rows.length === 0) {
    throw new Error('At least one species row is required')
  }

  for (const row of rows) {
    if (row.speciesName.length === 0 || !Number.isInteger(row.plantedCount) || row.plantedCount <= 0) {
      throw new Error('Each species row requires a species name and positive count')
    }
  }

  return rows
}

function normalizedBoundaryPoints(points: BoundaryPointInput[]): Array<{ lat: number; lng: number }> {
  const rows = points
    .map((point) => ({
      lat: Number(point.latitude),
      lng: Number(point.longitude),
    }))
    .filter((point) => Number.isFinite(point.lat) || Number.isFinite(point.lng))

  if (rows.length < 3) {
    throw new Error('At least three boundary points are required')
  }

  for (const point of rows) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      throw new Error('Each boundary point requires latitude and longitude')
    }
  }

  return rows
}

function normalizedSpeciesRow(row: CreateSiteSpeciesInput): CreateSiteSpeciesInput {
  return {
    speciesName: row.speciesName.trim(),
    plantedCount: row.plantedCount,
    spacingNotes: row.spacingNotes?.trim() || null,
    placement: row.placement?.trim() || null,
  }
}

async function insertBatchSpecies(
  tx: TransactionClient,
  siteId: string,
  species: CreateSiteSpeciesInput[],
): Promise<void> {
  for (const row of species) {
    const speciesRow = normalizedSpeciesRow(row)

    await tx.query(
      `
        insert into plantation_batch_species (
          site_id,
          species_name,
          planted_count,
          spacing_notes,
          placement
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5
        )
      `,
      [
        siteId,
        speciesRow.speciesName,
        speciesRow.plantedCount,
        speciesRow.spacingNotes ?? null,
        speciesRow.placement ?? null,
      ],
    )
  }
}

export async function confirmPlantationCounts(
  db: TransactionRunner,
  input: ConfirmCountsInput,
): Promise<ConfirmCountsResult> {
  return transaction(db, async (tx) => {
    const siteResult = await tx.query<SiteForConfirmation>(
      `
        select
          id,
          status,
          stage,
          monitoring_start,
          monitoring_end,
          program_id
        from plantation_sites
        where id = $1
        for update
      `,
      [input.siteId],
    )
    const site = siteResult.rows[0]

    if (!site) {
      throw new Error('Plantation site not found')
    }

    if (site.status !== 'registered') {
      if (site.status !== 'counts_confirmed' || !site.monitoring_start || !site.monitoring_end) {
        throw new Error('Plantation counts can only be confirmed from registered status')
      }

      return {
        siteId: site.id,
        status: 'counts_confirmed',
        monitoringStart: dateString(site.monitoring_start),
        monitoringEnd: dateString(site.monitoring_end),
        windowsCreated: 0,
        alreadyConfirmed: true,
      }
    }

    if (site.stage !== 'accepted') {
      throw new Error('Plantation counts can only be confirmed after acceptance')
    }

    const programResult = await tx.query<ProgramForWindows>(
      `
        select monitoring_years, audit_frequency
        from plantation_programs
        where id = $1
        for update
      `,
      [site.program_id],
    )
    const program = programResult.rows[0]

    if (!program) {
      throw new Error('Plantation program not found')
    }

    const windows = buildAuditWindows({
      siteId: site.id,
      monitoringStart: input.monitoringStart,
      monitoringYears: program.monitoring_years,
      auditFrequency: program.audit_frequency,
    })
    const monitoringEnd = addMonths(
      input.monitoringStart,
      program.monitoring_years * 12,
    )

    await tx.query(
      `
        update plantation_sites
        set
          status = 'counts_confirmed',
          monitoring_start = $2,
          monitoring_end = $3,
          updated_at = now()
        where id = $1
      `,
      [site.id, input.monitoringStart, monitoringEnd],
    )

    await insertAuditWindows(tx, windows)
    await insertGeneratedWindowEvents(tx, windows)
    if (input.actor) {
      await advanceSiteStage(tx, {
        siteId: site.id,
        toStage: 'monitoring',
        actor: input.actor,
        notes: `Monitoring opened with ${windows.length} scheduled checks`,
      })
    }

    return {
      siteId: site.id,
      status: 'counts_confirmed',
      monitoringStart: input.monitoringStart,
      monitoringEnd,
      windowsCreated: windows.length,
      alreadyConfirmed: false,
    }
  })
}

export async function submitSiteForAcceptance(
  db: TransactionRunner,
  input: {
    siteId: string
    submittedByMemberId: string
  },
): Promise<LifecycleStage> {
  return transaction(db, async (tx) => {
    return submitSiteForAcceptanceTx(tx, input)
  })
}

export async function submitSiteForAcceptanceWithNotification(
  db: TransactionRunner,
  input: {
    siteId: string
    submittedByMemberId: string
  },
): Promise<AcceptanceRequestNotificationPayload> {
  return transaction(db, async (tx) => {
    await submitSiteForAcceptanceTx(tx, input)
    return queueAcceptanceRequestNotificationTx(tx, input)
  })
}

export async function acceptSiteAsAdmin(
  db: TransactionRunner,
  input: {
    siteId: string
    acceptedByMemberId: string
  },
): Promise<LifecycleStage> {
  return transaction(db, async (tx) => {
    const snapshot = await acceptanceSnapshot(tx, input.siteId)
    const result = await tx.query<{ id: string }>(
      `
        update plantation_acceptances
        set
          accepted_by = $2,
          accepted_as_admin = true,
          accepted_at = now(),
          accepted_snapshot = $3::jsonb
        where site_id = $1
          and accepted_at is null
          and rejected_at is null
        returning id
      `,
      [input.siteId, input.acceptedByMemberId, JSON.stringify(snapshot)],
    )

    if (!result.rows[0]?.id) {
      throw new Error('Submitted acceptance record not found')
    }

    return advanceSiteStage(tx, {
      siteId: input.siteId,
      toStage: 'accepted',
      actor: input.acceptedByMemberId,
      notes: 'Accepted in admin break-glass',
    })
  })
}

export async function acceptSiteAsSponsor(
  db: TransactionRunner,
  input: {
    siteId: string
    acceptedByMemberId: string
    acceptedRole?: 'primary' | 'fallback'
  },
): Promise<LifecycleStage> {
  return transaction(db, async (tx) => {
    const snapshot = await acceptanceSnapshot(tx, input.siteId)
    const result = await tx.query<{ id: string }>(
      `
        update plantation_acceptances
        set
          accepted_by = $2,
          accepted_role = $3,
          accepted_as_admin = false,
          accepted_at = now(),
          accepted_snapshot = $4::jsonb
        where site_id = $1
          and accepted_at is null
          and rejected_at is null
        returning id
      `,
      [input.siteId, input.acceptedByMemberId, input.acceptedRole ?? 'primary', JSON.stringify(snapshot)],
    )

    if (!result.rows[0]?.id) {
      throw new Error('Submitted acceptance record not found')
    }

    return advanceSiteStage(tx, {
      siteId: input.siteId,
      toStage: 'accepted',
      actor: input.acceptedByMemberId,
      notes: 'Accepted by project owner approver',
    })
  })
}

export async function advanceSiteStage(
  db: Queryable,
  input: {
    siteId: string
    toStage: LifecycleStage
    actor: string
    notes?: string | null
  },
): Promise<LifecycleStage> {
  const result = await db.query<{ stage: LifecycleStage }>(
    `
      select advance_plantation_site_stage($1, $2, $3, $4) as stage
    `,
    [input.siteId, input.toStage, input.actor, input.notes ?? null],
  )
  const stage = result.rows[0]?.stage

  if (!stage) {
    throw new Error('Failed to advance site stage')
  }

  return stage
}

export async function advanceWindowState(
  db: Queryable,
  input: {
    windowId: string
    toState: Exclude<AuditWindowStatus, 'scheduled'>
    actor: string
  },
): Promise<AuditWindowStatus> {
  const result = await db.query<{ status: AuditWindowStatus }>(
    `
      select advance_plantation_window_state($1, $2, $3) as status
    `,
    [input.windowId, input.toState, input.actor],
  )
  const status = result.rows[0]?.status

  if (!status) {
    throw new Error('Failed to advance audit window state')
  }

  return status
}

export async function recordStageEvidenceAndAdvance(
  db: TransactionRunner,
  input: StageEvidenceInput,
): Promise<LifecycleStage> {
  return transaction(db, async (tx) => {
    const urls = input.photoUrls.map((url) => url.trim()).filter(Boolean)

    if (urls.length === 0) {
      throw new Error('At least one photo is required')
    }

    for (const url of urls) {
      await tx.query(
        `
          insert into plantation_evidence (
            site_id,
            stage,
            url,
            captured_at,
            latitude,
            longitude,
            gps_accuracy,
            caption,
            uploaded_by
          ) values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
        `,
        [
          input.siteId,
          input.stage,
          url,
          input.capturedAt,
          input.latitude || null,
          input.longitude || null,
          input.gpsAccuracy || null,
          input.caption || null,
          input.uploadedByMemberId,
        ],
      )
    }

    return advanceSiteStage(tx, {
      siteId: input.siteId,
      toStage: input.stage,
      actor: input.uploadedByMemberId,
      notes: `${urls.length} photo${urls.length === 1 ? '' : 's'} recorded`,
    })
  })
}

export async function markAcceptanceRequestNotificationSent(
  db: Queryable,
  input: {
    notificationId: string
    provider: string
    providerMessageId?: string | null
  },
): Promise<void> {
  await db.query(
    `
      update plantation_notifications
      set
        status = 'sent',
        provider = $2,
        provider_message_id = $3,
        error_message = null,
        sent_at = now(),
        updated_at = now()
      where id = $1
    `,
    [input.notificationId, input.provider, input.providerMessageId ?? null],
  )
}

export async function markAcceptanceRequestNotificationFailed(
  db: Queryable,
  input: {
    notificationId: string
    provider: string
    errorMessage: string
  },
): Promise<void> {
  await db.query(
    `
      update plantation_notifications
      set
        status = 'failed',
        provider = $2,
        error_message = $3,
        updated_at = now()
      where id = $1
    `,
    [input.notificationId, input.provider, input.errorMessage],
  )
}

async function acceptanceSnapshot(
  tx: TransactionClient,
  siteId: string,
): Promise<Record<string, unknown>> {
  const siteResult = await tx.query<AcceptanceSnapshotSiteRow>(
    `
      select
        programs.name as program_name,
        sites.location_id,
        sites.name,
        sites.district,
        sites.taluk,
        sites.village,
        sites.planting_date,
        sites.planted_count,
        sites.species_notes,
        sites.land_ownership::text as land_ownership,
        sites.land_custodian,
        sites.approval_reference,
        sites.is_shared_parcel,
        sites.watch_and_ward,
        sites.boundary_points,
        sites.plantation_type::text as plantation_type
      from plantation_sites sites
      join plantation_programs programs on programs.id = sites.program_id
      where sites.id = $1
    `,
    [siteId],
  )
  const speciesResult = await tx.query<{
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
  const site = siteResult.rows[0]

  if (!site) {
    throw new Error('Plantation site not found')
  }

  return {
    programName: site.program_name,
    locationId: site.location_id,
    siteName: site.name,
    district: site.district,
    taluk: site.taluk,
    village: site.village,
    plantingDate: dateString(site.planting_date),
    plantedCount: site.planted_count,
    speciesNotes: site.species_notes,
    landOwnership: site.land_ownership,
    landCustodian: site.land_custodian,
    approvalReference: site.approval_reference,
    isSharedParcel: site.is_shared_parcel,
    watchAndWard: site.watch_and_ward,
    boundaryPoints: site.boundary_points,
    plantationType: site.plantation_type,
    species: speciesResult.rows.map((row) => ({
      speciesName: row.species_name,
      plantedCount: row.planted_count,
      spacingNotes: row.spacing_notes,
      placement: row.placement,
    })),
  }
}

async function submitSiteForAcceptanceTx(
  tx: TransactionClient,
  input: {
    siteId: string
    submittedByMemberId: string
  },
): Promise<LifecycleStage> {
  await tx.query(
    `
      insert into plantation_acceptances (
        site_id,
        submitted_by
      ) values (
        $1,
        $2
      )
      on conflict (site_id) do nothing
    `,
    [input.siteId, input.submittedByMemberId],
  )

  return advanceSiteStage(tx, {
    siteId: input.siteId,
    toStage: 'submitted_for_acceptance',
    actor: input.submittedByMemberId,
    notes: 'Baseline submitted for acceptance',
  })
}

async function queueAcceptanceRequestNotificationTx(
  tx: TransactionClient,
  input: {
    siteId: string
    submittedByMemberId: string
  },
): Promise<AcceptanceRequestNotificationPayload> {
  const siteResult = await tx.query<{
    acceptance_id: string
    recipient_email: string | null
    subject: string
    location_id: string
    site_name: string
    program_name: string
    planting_date: Date | string
    planted_count: number
  }>(
    `
      select
        acceptances.id as acceptance_id,
        programs.owner_approver_email as recipient_email,
        ('PlantSure approval request: ' || sites.location_id || ' - ' || sites.name) as subject,
        sites.location_id,
        sites.name as site_name,
        programs.name as program_name,
        sites.planting_date,
        sites.planted_count
      from plantation_sites sites
      join plantation_programs programs on programs.id = sites.program_id
      join plantation_acceptances acceptances on acceptances.site_id = sites.id
      where sites.id = $1
    `,
    [input.siteId],
  )
  const speciesResult = await tx.query<{
    species_name: string
    planted_count: number
  }>(
    `
      select species_name, planted_count
      from plantation_batch_species
      where site_id = $1
      order by species_name
    `,
    [input.siteId],
  )
  const site = siteResult.rows[0]

  if (!site?.acceptance_id) {
    throw new Error('Submitted acceptance record not found')
  }

  if (!site.recipient_email?.trim()) {
    throw new Error('Programme owner approval email is not configured')
  }

  const notificationResult = await tx.query<{ id: string }>(
    `
      insert into plantation_notifications (
        site_id,
        acceptance_id,
        notification_type,
        recipient_email,
        subject,
        triggered_by_member_id
      ) values (
        $1,
        $2,
        'acceptance_request',
        $3,
        $4,
        $5
      )
      returning id
    `,
    [
      input.siteId,
      site.acceptance_id,
      site.recipient_email.trim(),
      site.subject,
      input.submittedByMemberId,
    ],
  )
  const notificationId = notificationResult.rows[0]?.id

  if (!notificationId) {
    throw new Error('Failed to create acceptance notification record')
  }

  return {
    notificationId,
    acceptanceId: site.acceptance_id,
    recipientEmail: site.recipient_email.trim(),
    subject: site.subject,
    siteId: input.siteId,
    locationId: site.location_id,
    siteName: site.site_name,
    programName: site.program_name,
    plantingDate: dateString(site.planting_date),
    plantedCount: site.planted_count,
    speciesSummary: speciesResult.rows.map((row) => ({
      speciesName: row.species_name,
      plantedCount: row.planted_count,
    })),
  }
}

export function buildAuditWindows(input: {
  siteId: string
  monitoringStart: string
  monitoringYears: number
  auditFrequency: AuditFrequency
}): AuditWindowInput[] {
  const cyclesPerYear = cyclesByFrequency[input.auditFrequency]
  const total = input.monitoringYears * cyclesPerYear
  const monthsPerCycle = 12 / cyclesPerYear

  return Array.from({ length: total }, (_, index) => {
    const sequenceNumber = index + 1
    const dueDate = addMonths(input.monitoringStart, sequenceNumber * monthsPerCycle)

    return {
      siteId: input.siteId,
      sequenceNumber,
      cycleLabel: cycleLabel(sequenceNumber, cyclesPerYear),
      dueDate,
      graceUntil: addDays(dueDate, 14),
    }
  })
}

async function insertAuditWindows(tx: TransactionClient, windows: AuditWindowInput[]): Promise<void> {
  if (windows.length === 0) {
    return
  }

  const values = windows
    .map((_, index) => {
      const offset = index * 5
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
    })
    .join(', ')
  const params = windows.flatMap((window) => [
    window.siteId,
    window.sequenceNumber,
    window.cycleLabel,
    window.dueDate,
    window.graceUntil,
  ])

  await tx.query(
    `
      insert into plantation_audit_windows (
        site_id,
        sequence_number,
        cycle_label,
        due_date,
        grace_until
      ) values ${values}
    `,
    params,
  )
}

async function insertGeneratedWindowEvents(tx: TransactionClient, windows: AuditWindowInput[]): Promise<void> {
  if (windows.length === 0) {
    return
  }

  const values = windows
    .map((_, index) => {
      const offset = index * 4
      return `(
        (
          select id
          from plantation_audit_windows
          where site_id = $${offset + 1}
            and sequence_number = $${offset + 2}
        ),
        'generated',
        jsonb_build_object(
          'sequenceNumber', $${offset + 2}::integer,
          'dueDate', $${offset + 3}::text,
          'graceUntil', $${offset + 4}::text
        ),
        'system'
      )`
    })
    .join(', ')
  const params = windows.flatMap((window) => [
    window.siteId,
    window.sequenceNumber,
    window.dueDate,
    window.graceUntil,
  ])

  await tx.query(
    `
      insert into plantation_window_events (
        window_id,
        event_type,
        detail,
        actor
      ) values ${values}
    `,
    params,
  )
}

function cycleLabel(sequenceNumber: number, cyclesPerYear: number): string {
  const year = Math.ceil(sequenceNumber / cyclesPerYear)

  if (cyclesPerYear === 4) {
    return `Y${year}-Q${((sequenceNumber - 1) % cyclesPerYear) + 1}`
  }

  if (cyclesPerYear === 2) {
    return `Y${year}-H${((sequenceNumber - 1) % cyclesPerYear) + 1}`
  }

  if (cyclesPerYear === 12) {
    return `Y${year}-M${((sequenceNumber - 1) % cyclesPerYear) + 1}`
  }

  return `Y${year}`
}

function addMonths(dateString: string, months: number): string {
  const [year, month, day] = parseDate(dateString)
  const target = new Date(Date.UTC(year, month - 1 + months, day))

  return formatDate(target)
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = parseDate(dateString)
  const target = new Date(Date.UTC(year, month - 1, day + days))

  return formatDate(target)
}

function parseDate(dateString: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)

  if (!match) {
    throw new Error('Date must use YYYY-MM-DD format')
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dateString(value: Date | string): string {
  if (value instanceof Date) {
    return formatLocalDate(value)
  }

  return value
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

async function transaction<TResult>(
  db: TransactionRunner,
  run: (tx: TransactionClient) => Promise<TResult>,
): Promise<TResult> {
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
