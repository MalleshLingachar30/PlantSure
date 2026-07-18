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
  latitude: string
  longitude: string
  plantedCount: number
  plantingDate: string
  speciesNotes?: string | null
  createdByMemberId: string
}

export type CreateSiteResult = {
  id: string
  locationId: string
  status: 'registered'
}

export type ConfirmCountsInput = {
  siteId: string
  monitoringStart: string
}

export type ConfirmCountsResult = {
  siteId: string
  status: 'counts_confirmed'
  monitoringStart: string
  monitoringEnd: string
  windowsCreated: number
  alreadyConfirmed: boolean
}

type ProgramForWindows = {
  monitoring_years: number
  audit_frequency: AuditFrequency
}

type SiteForConfirmation = {
  id: string
  status: string
  monitoring_start: string | null
  monitoring_end: string | null
  program_id: string
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
          $8
        )
        returning id
      `,
      [
        input.organizationId,
        input.name,
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
          species_notes,
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
          $12
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
        input.latitude,
        input.longitude,
        input.plantedCount,
        input.plantingDate,
        input.speciesNotes ?? null,
        input.createdByMemberId,
      ],
    )

    const site = siteResult.rows[0]
    if (!site) {
      throw new Error('Failed to create plantation site')
    }

    return {
      id: site.id,
      locationId,
      status: site.status,
    }
  })
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
        monitoringStart: site.monitoring_start,
        monitoringEnd: site.monitoring_end,
        windowsCreated: 0,
        alreadyConfirmed: true,
      }
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
