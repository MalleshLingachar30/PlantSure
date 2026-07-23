import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Client } from 'pg'
import {
  findOrCreatePlantingOrganization,
  findOrCreateScientificAdvisor,
} from '../lib/plantation-directory'
import {
  acceptSiteAsSponsor,
  buildAuditWindows,
  confirmPlantationCounts,
  createPlantationProgram,
  createPlantationSite,
  recordStageEvidenceAndAdvance,
  submitSiteForAcceptance,
  submitSiteForAcceptanceWithNotification,
} from '../lib/plantation-registration'
import {
  markMissedAuditWindows,
  recordAuditCheck,
} from '../lib/plantation-checks'

const migrationsPath = new URL('../drizzle/', import.meta.url)
const memberId = '00000000-0000-4000-8000-000000000020'
const sponsorMemberId = '00000000-0000-4000-8000-000000000021'

type MigratedDatabase = {
  client: Client
  schemaName: string
}

async function withMigratedDatabase(run: (database: MigratedDatabase) => Promise<void>): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required for PlantSure registration tests')
  }

  const client = new Client({ connectionString })
  const schemaName = `plantsure_test_${randomUUID().replaceAll('-', '_')}`
  const schemaIdentifier = quoteIdentifier(schemaName)

  await client.connect()

  try {
    await client.query(`create schema ${schemaIdentifier}`)
    await client.query(`set search_path to ${schemaIdentifier}`)
    await client.query(`set statement_timeout to '15s'`)
    await client.query(`set lock_timeout to '5s'`)
    await client.query(await migrationSqlForSchema(schemaName))
    await run({ client, schemaName })
  } finally {
    await client.query(`drop schema if exists ${schemaIdentifier} cascade`)
    await client.end()
  }
}

async function migrationSqlForSchema(schemaName: string): Promise<string> {
  const migrationFiles = (await readdir(migrationsPath))
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const migrationSql = (
    await Promise.all(
      migrationFiles.map((file) => readFile(new URL(file, migrationsPath), 'utf8')),
    )
  ).join('\n')

  return migrationSql.replaceAll('"public".', `${quoteIdentifier(schemaName)}.`)
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function dateValue(value: Date | string | undefined): string | undefined {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  return value
}

async function createProgram(client: Client): Promise<string> {
  const advisor = await findOrCreateScientificAdvisor(client, {
    name: 'Institute of Agroforestry and Forest Technology',
    advisorType: 'scientific_institute',
    contactEmail: 'iaft@example.com',
  })
  const organization = await findOrCreatePlantingOrganization(client, {
    name: 'Green Karnataka Owner',
    organizationType: 'institution',
    scientificAdvisorId: advisor.id,
    primaryContactEmail: 'iaft@example.com',
    ownerApproverEmail: 'owner@example.com',
  })
  const program = await createPlantationProgram(client, {
    organizationId: organization.id,
    name: 'Green Karnataka 2026',
    escalationEmail: 'iaft@example.com',
  })

  return program.id
}

async function insertMember(
  client: Client,
  id: string,
  role: 'admin' | 'manager' | 'auditor' | 'technician',
  email: string,
): Promise<void> {
  await client.query(
    `
      insert into plantation_members (
        id,
        clerk_user_id,
        email,
        display_name,
        role
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      on conflict (id) do update set
        email = excluded.email,
        role = excluded.role
    `,
    [id, `test:${id}`, email, `Test ${role}`, role],
  )
}

async function createSite(client: Client, programId: string, name = 'Gubbi site'): Promise<string> {
  const site = await createPlantationSite(client, {
    programId,
    stateCode: 'ka',
    districtCode: 'tmk',
    villageCode: 'gub',
    name,
    district: 'Tumakuru',
    taluk: 'Gubbi',
    village: 'Gubbi',
    plantingDate: '2026-07-15',
    species: [{ speciesName: 'Mixed native', plantedCount: 600 }],
    landOwnership: 'institutional',
    boundaryPoints: [
      { latitude: '13.312000', longitude: '76.941000' },
      { latitude: '13.313000', longitude: '76.942000' },
      { latitude: '13.311000', longitude: '76.943000' },
    ],
    plantationType: 'block',
    createdByMemberId: memberId,
  })

  return site.id
}

async function advanceSiteToAccepted(client: Client, siteId: string): Promise<void> {
  await insertMember(client, sponsorMemberId, 'technician', 'owner@example.com')
  await recordStageEvidenceAndAdvance(client, {
    siteId,
    stage: 'pits_dug',
    photoUrls: ['https://plantsure.feedbacknfc.com/evidence/pits-1.jpg'],
    capturedAt: '2026-07-10T09:30:00',
    uploadedByMemberId: memberId,
  })
  await recordStageEvidenceAndAdvance(client, {
    siteId,
    stage: 'planted',
    photoUrls: ['https://plantsure.feedbacknfc.com/evidence/planting-1.jpg'],
    capturedAt: '2026-07-15T11:00:00',
    uploadedByMemberId: memberId,
  })
  await submitSiteForAcceptance(client, {
    siteId,
    submittedByMemberId: memberId,
  })
  await acceptSiteAsSponsor(client, {
    siteId,
    acceptedByMemberId: sponsorMemberId,
    acceptedRole: 'primary',
  })
}

test('buildAuditWindows creates the five-year quarterly schedule from the monitoring start date', () => {
  const windows = buildAuditWindows({
    siteId: '00000000-0000-4000-8000-000000000001',
    monitoringStart: '2026-07-15',
    monitoringYears: 5,
    auditFrequency: 'quarterly',
  })

  assert.equal(windows.length, 20)
  assert.deepEqual(windows[0], {
    siteId: '00000000-0000-4000-8000-000000000001',
    sequenceNumber: 1,
    cycleLabel: 'Y1-Q1',
    dueDate: '2026-10-15',
    graceUntil: '2026-10-29',
  })
  assert.equal(windows.at(-1)?.sequenceNumber, 20)
  assert.equal(windows.at(-1)?.cycleLabel, 'Y5-Q4')
  assert.equal(windows.at(-1)?.dueDate, '2031-07-15')
})

test('site registration allocates Location IDs from the global prefix sequence', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const firstProgramId = await createProgram(client)
    const secondProgramId = await createProgram(client)

    const first = await createPlantationSite(client, {
      programId: firstProgramId,
      stateCode: 'ka',
      districtCode: 'tmk',
      villageCode: 'gub',
      name: 'Gubbi site 1',
      district: 'Tumakuru',
      taluk: 'Gubbi',
      village: 'Gubbi',
      plantingDate: '2026-07-15',
      species: [
        { speciesName: 'Teak', plantedCount: 200 },
        { speciesName: 'Mahogany', plantedCount: 150 },
        { speciesName: 'Silver oak', plantedCount: 250 },
      ],
      landOwnership: 'institutional',
      landCustodian: 'Sindhi Seva Samaj',
      approvalReference: 'SSS field approval',
      isSharedParcel: true,
      watchAndWard: true,
      boundaryPoints: [
        { latitude: '13.312000', longitude: '76.941000' },
        { latitude: '13.313000', longitude: '76.942000' },
        { latitude: '13.311000', longitude: '76.943000' },
      ],
      plantationType: 'block',
      plantingPhotoUrls: [
        'https://plantsure.feedbacknfc.com/evidence/planting-1.jpg',
        'https://plantsure.feedbacknfc.com/evidence/planting-2.jpg',
      ],
      createdByMemberId: memberId,
    })
    const second = await createPlantationSite(client, {
      programId: secondProgramId,
      stateCode: 'KA',
      districtCode: 'TMK',
      villageCode: 'GUB',
      name: 'Gubbi site 2',
      district: 'Tumakuru',
      taluk: 'Gubbi',
      village: 'Gubbi',
      plantingDate: '2026-07-15',
      species: [{ speciesName: 'Mixed native', plantedCount: 600 }],
      landOwnership: 'institutional',
      boundaryPoints: [
        { latitude: '13.313000', longitude: '76.942000' },
        { latitude: '13.314000', longitude: '76.943000' },
        { latitude: '13.312000', longitude: '76.944000' },
      ],
      plantationType: 'block',
      createdByMemberId: memberId,
    })

    assert.equal(first.locationId, 'KA-TMK-GUB-000001')
    assert.equal(first.status, 'registered')
    assert.equal(second.locationId, 'KA-TMK-GUB-000002')

    const sequence = await client.query<{ next_location_sequence: number }>(
      `select next_location_sequence from plantation_location_sequences where prefix = $1`,
      ['KA-TMK-GUB'],
    )
    const evidence = await client.query<{ planting_photo_urls: string[] }>(
      `select planting_photo_urls from plantation_sites where id = $1`,
      [first.id],
    )
    const site = await client.query<{
      planted_count: number
      land_ownership: string
      land_custodian: string | null
      approval_reference: string | null
      is_shared_parcel: boolean
      watch_and_ward: boolean
      boundary_points: Array<{ lat: number; lng: number }>
      plantation_type: string
    }>(
      `
        select
          planted_count,
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
      [first.id],
    )
    const species = await client.query<{ species_name: string; planted_count: number }>(
      `
        select species_name, planted_count
        from plantation_batch_species
        where site_id = $1
        order by species_name
      `,
      [first.id],
    )
    const stage = await client.query<{ stage: string; events_count: string }>(
      `
        select
          sites.stage::text,
          count(events.id)::text as events_count
        from plantation_sites sites
        left join plantation_stage_events events on events.site_id = sites.id
        where sites.id = $1
        group by sites.id
      `,
      [first.id],
    )

    assert.equal(sequence.rows[0]?.next_location_sequence, 3)
    assert.deepEqual(evidence.rows[0]?.planting_photo_urls, [
      'https://plantsure.feedbacknfc.com/evidence/planting-1.jpg',
      'https://plantsure.feedbacknfc.com/evidence/planting-2.jpg',
    ])
    assert.deepEqual(site.rows[0], {
      planted_count: 600,
      land_ownership: 'institutional',
      land_custodian: 'Sindhi Seva Samaj',
      approval_reference: 'SSS field approval',
      is_shared_parcel: true,
      watch_and_ward: true,
      boundary_points: [
        { lat: 13.312, lng: 76.941 },
        { lat: 13.313, lng: 76.942 },
        { lat: 13.311, lng: 76.943 },
      ],
      plantation_type: 'block',
    })
    assert.deepEqual(species.rows, [
      { species_name: 'Mahogany', planted_count: 150 },
      { species_name: 'Silver oak', planted_count: 250 },
      { species_name: 'Teak', planted_count: 200 },
    ])
    assert.deepEqual(stage.rows[0], {
      stage: 'material_arranged',
      events_count: '3',
    })
  })
})

test('stage evidence capture advances pits and planted stages with photos', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)

    const pits = await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'pits_dug',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/pits-1.jpg'],
      capturedAt: '2026-07-10T09:30:00',
      latitude: '13.312100',
      longitude: '76.941100',
      uploadedByMemberId: memberId,
    })
    assert.equal(pits, 'pits_dug')

    const planted = await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'planted',
      photoUrls: [
        'https://plantsure.feedbacknfc.com/evidence/planting-1.jpg',
        'https://plantsure.feedbacknfc.com/evidence/planting-2.jpg',
      ],
      capturedAt: '2026-07-15T11:00:00',
      caption: 'Planting complete',
      uploadedByMemberId: memberId,
    })
    assert.equal(planted, 'planted')

    const evidence = await client.query<{ stage: string; count: string }>(
      `
        select stage::text, count(*)::text
        from plantation_evidence
        where site_id = $1
        group by stage
        order by stage
      `,
      [siteId],
    )
    const site = await client.query<{ stage: string }>(
      `select stage::text from plantation_sites where id = $1`,
      [siteId],
    )

    assert.equal(site.rows[0]?.stage, 'planted')
    assert.deepEqual(evidence.rows, [
      { stage: 'pits_dug', count: '1' },
      { stage: 'planted', count: '2' },
    ])
  })
})

test('acceptance submission and owner approval advance the site into accepted stage', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)
    await insertMember(client, sponsorMemberId, 'technician', 'owner@example.com')

    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'pits_dug',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/pits-1.jpg'],
      capturedAt: '2026-07-10T09:30:00',
      uploadedByMemberId: memberId,
    })
    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'planted',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/planting-1.jpg'],
      capturedAt: '2026-07-15T11:00:00',
      uploadedByMemberId: memberId,
    })

    const submitted = await submitSiteForAcceptance(client, {
      siteId,
      submittedByMemberId: memberId,
    })
    const accepted = await acceptSiteAsSponsor(client, {
      siteId,
      acceptedByMemberId: sponsorMemberId,
      acceptedRole: 'primary',
    })

    const acceptance = await client.query<{
      accepted_as_admin: boolean
      accepted_role: string | null
      accepted_at: Date | string | null
      accepted_snapshot: { species?: unknown[] } | null
    }>(
      `
        select accepted_as_admin, accepted_role::text, accepted_at, accepted_snapshot
        from plantation_acceptances
        where site_id = $1
      `,
      [siteId],
    )
    const site = await client.query<{ stage: string }>(
      `select stage::text from plantation_sites where id = $1`,
      [siteId],
    )

    assert.equal(submitted, 'submitted_for_acceptance')
    assert.equal(accepted, 'accepted')
    assert.equal(site.rows[0]?.stage, 'accepted')
    assert.equal(acceptance.rows[0]?.accepted_as_admin, false)
    assert.equal(acceptance.rows[0]?.accepted_role, 'primary')
    assert.ok(acceptance.rows[0]?.accepted_at)
    assert.equal(Array.isArray(acceptance.rows[0]?.accepted_snapshot?.species), true)
  })
})

test('acceptance submission queues a pending owner approval email notification', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)

    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'pits_dug',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/pits-1.jpg'],
      capturedAt: '2026-07-10T09:30:00',
      uploadedByMemberId: memberId,
    })
    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'planted',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/planting-1.jpg'],
      capturedAt: '2026-07-15T11:00:00',
      uploadedByMemberId: memberId,
    })

    const notification = await submitSiteForAcceptanceWithNotification(client, {
      siteId,
      submittedByMemberId: memberId,
    })

    const queued = await client.query<{
      recipient_email: string
      subject: string
      status: string
      notification_type: string
      channel: string
    }>(
      `
        select recipient_email, subject, status::text, notification_type::text, channel::text
        from plantation_notifications
        where id = $1
      `,
      [notification.notificationId],
    )

    assert.equal(notification.recipientEmail, 'owner@example.com')
    assert.equal(notification.locationId.startsWith('KA-TMK-GUB-'), true)
    assert.equal(notification.plantedCount, 600)
    assert.equal(notification.speciesSummary.length > 0, true)
    assert.equal(queued.rows[0]?.recipient_email, 'owner@example.com')
    assert.equal(queued.rows[0]?.status, 'pending')
    assert.equal(queued.rows[0]?.notification_type, 'acceptance_request')
    assert.equal(queued.rows[0]?.channel, 'email')
    assert.match(queued.rows[0]?.subject ?? '', /PlantSure approval request:/)
  })
})

test('owner approval rejects a technician who is not the configured programme approver', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const wrongSponsorId = '00000000-0000-4000-8000-000000000022'
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)

    await insertMember(client, wrongSponsorId, 'technician', 'someone-else@example.com')

    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'pits_dug',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/pits-1.jpg'],
      capturedAt: '2026-07-10T09:30:00',
      uploadedByMemberId: memberId,
    })
    await recordStageEvidenceAndAdvance(client, {
      siteId,
      stage: 'planted',
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/planting-1.jpg'],
      capturedAt: '2026-07-15T11:00:00',
      uploadedByMemberId: memberId,
    })

    await submitSiteForAcceptance(client, {
      siteId,
      submittedByMemberId: memberId,
    })

    await assert.rejects(
      () =>
        acceptSiteAsSponsor(client, {
          siteId,
          acceptedByMemberId: wrongSponsorId,
          acceptedRole: 'primary',
        }),
      /assigned project owner account/,
    )
  })
})

test('concurrent site registrations allocate unique Location IDs', async () => {
  await withMigratedDatabase(async ({ client, schemaName }) => {
    const programIds: string[] = []

    for (let index = 0; index < 5; index += 1) {
      programIds.push(await createProgram(client))
    }

    const clients = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const connection = new Client({ connectionString: process.env.TEST_DATABASE_URL })
        await connection.connect()
        await connection.query(`set search_path to ${quoteIdentifier(schemaName)}`)
        await connection.query(`set statement_timeout to '15s'`)
        await connection.query(`set lock_timeout to '5s'`)
        return connection
      }),
    )

    try {
      const sites = await Promise.all(
        clients.map((connection, index) =>
          createPlantationSite(connection, {
            programId: programIds[index],
            stateCode: 'KA',
            districtCode: 'TMK',
            villageCode: 'GUB',
            name: `Gubbi site ${index + 1}`,
            district: 'Tumakuru',
            taluk: 'Gubbi',
            village: 'Gubbi',
            plantingDate: '2026-07-15',
            species: [{ speciesName: 'Mixed native', plantedCount: 600 }],
            landOwnership: 'institutional',
            boundaryPoints: [
              { latitude: '13.312000', longitude: '76.941000' },
              { latitude: '13.313000', longitude: '76.942000' },
              { latitude: '13.311000', longitude: '76.943000' },
            ],
            plantationType: 'block',
            createdByMemberId: memberId,
          }),
        ),
      )
      const locationIds = sites.map((site) => site.locationId).sort()

      assert.deepEqual(locationIds, [
        'KA-TMK-GUB-000001',
        'KA-TMK-GUB-000002',
        'KA-TMK-GUB-000003',
        'KA-TMK-GUB-000004',
        'KA-TMK-GUB-000005',
      ])
    } finally {
      await Promise.all(clients.map((connection) => connection.end()))
    }
  })
})

test('confirm counts locks the site and creates twenty windows with generated events', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)
    await advanceSiteToAccepted(client, siteId)

    const confirmation = await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-15',
      actor: memberId,
    })

    assert.deepEqual(confirmation, {
      siteId,
      status: 'counts_confirmed',
      monitoringStart: '2026-07-15',
      monitoringEnd: '2031-07-15',
      windowsCreated: 20,
      alreadyConfirmed: false,
    })

    const site = await client.query<{
      status: string
      stage: string
      monitoring_start: Date | string
      monitoring_end: Date | string
    }>(`select status, stage::text, monitoring_start, monitoring_end from plantation_sites where id = $1`, [siteId])
    const windows = await client.query<{
      sequence_number: number
      cycle_label: string
      due_date: Date | string
      grace_until: Date | string
    }>(
      `
        select sequence_number, cycle_label, due_date, grace_until
        from plantation_audit_windows
        where site_id = $1
        order by sequence_number
      `,
      [siteId],
    )
    const events = await client.query<{ count: string }>(
      `
        select count(*)::text
        from plantation_window_events events
        join plantation_audit_windows windows on windows.id = events.window_id
        where windows.site_id = $1
          and events.event_type = 'generated'
      `,
      [siteId],
    )

    assert.equal(site.rows[0]?.status, 'counts_confirmed')
    assert.equal(site.rows[0]?.stage, 'monitoring')
    assert.equal(dateValue(site.rows[0]?.monitoring_start), '2026-07-15')
    assert.equal(dateValue(site.rows[0]?.monitoring_end), '2031-07-15')
    assert.equal(windows.rows.length, 20)
    assert.equal(windows.rows[0]?.cycle_label, 'Y1-Q1')
    assert.equal(dateValue(windows.rows[0]?.due_date), '2026-10-15')
    assert.equal(dateValue(windows.rows[0]?.grace_until), '2026-10-29')
    assert.equal(windows.rows.at(-1)?.cycle_label, 'Y5-Q4')
    assert.equal(events.rows[0]?.count, '20')

    await assert.rejects(
      () => client.query(`update plantation_sites set planted_count = 601 where id = $1`, [siteId]),
      /planted_count is derived from species rows/,
    )
  })
})

test('confirm counts is idempotent and does not create duplicate windows', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)
    await advanceSiteToAccepted(client, siteId)

    await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-15',
      actor: memberId,
    })
    const second = await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-16',
      actor: memberId,
    })
    const windows = await client.query<{ count: string }>(
      `select count(*)::text from plantation_audit_windows where site_id = $1`,
      [siteId],
    )
    const events = await client.query<{ count: string }>(
      `
        select count(*)::text
        from plantation_window_events events
        join plantation_audit_windows windows on windows.id = events.window_id
        where windows.site_id = $1
      `,
      [siteId],
    )

    assert.equal(second.alreadyConfirmed, true)
    assert.equal(second.monitoringStart, '2026-07-15')
    assert.equal(second.monitoringEnd, '2031-07-15')
    assert.equal(second.windowsCreated, 0)
    assert.equal(windows.rows[0]?.count, '20')
    assert.equal(events.rows[0]?.count, '20')
  })
})

test('audit check records per-species results and completes the window', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const site = await createPlantationSite(client, {
      programId,
      stateCode: 'ka',
      districtCode: 'tmk',
      villageCode: 'gub',
      name: 'Gubbi site',
      district: 'Tumakuru',
      taluk: 'Gubbi',
      village: 'Gubbi',
      plantingDate: '2026-07-15',
      species: [
        { speciesName: 'Teak', plantedCount: 200 },
        { speciesName: 'Mahogany', plantedCount: 150 },
      ],
      landOwnership: 'institutional',
      boundaryPoints: [
        { latitude: '13.312000', longitude: '76.941000' },
        { latitude: '13.313000', longitude: '76.942000' },
        { latitude: '13.311000', longitude: '76.943000' },
      ],
      plantationType: 'block',
      createdByMemberId: memberId,
    })

    await advanceSiteToAccepted(client, site.id)
    await confirmPlantationCounts(client, {
      siteId: site.id,
      monitoringStart: '2026-07-15',
      actor: memberId,
    })

    const window = await client.query<{ id: string }>(
      `
        select id
        from plantation_audit_windows
        where site_id = $1
        order by sequence_number
        limit 1
      `,
      [site.id],
    )

    await assert.rejects(
      () =>
        recordAuditCheck(client, {
          windowId: window.rows[0]?.id ?? '',
          auditorMemberId: memberId,
          auditedAt: '2026-07-19T10:00:00',
          speciesResults: [
            { speciesName: 'Teak', survivingCount: 190 },
            { speciesName: 'Mahogany', survivingCount: 140 },
          ],
          photoUrls: ['https://plantsure.feedbacknfc.com/evidence/check-too-early.jpg'],
          latitude: '13.312200',
          longitude: '76.941200',
          gpsStatus: 'confirmed',
          remarks: 'Too early',
        }),
      /Audit checks can only be recorded during the open window/,
    )

    const result = await recordAuditCheck(client, {
      windowId: window.rows[0]?.id ?? '',
      auditorMemberId: memberId,
      auditedAt: '2026-10-16T10:00:00',
      speciesResults: [
        { speciesName: 'Teak', survivingCount: 190 },
        { speciesName: 'Mahogany', survivingCount: 140 },
      ],
      photoUrls: ['https://plantsure.feedbacknfc.com/evidence/check-1.jpg'],
      latitude: '13.312200',
      longitude: '76.941200',
      gpsStatus: 'confirmed',
      remarks: 'Healthy canopy',
    })

    const audit = await client.query<{
      status: string
      audit_id: string | null
      surviving_count: number
      species_rows: string
      evidence_rows: string
    }>(
      `
        select
          windows.status::text,
          windows.audit_id::text,
          audits.surviving_count,
          count(distinct species.id)::text as species_rows,
          count(distinct evidence.id)::text as evidence_rows
        from plantation_audit_windows windows
        join plantation_audits audits on audits.id = windows.audit_id
        left join plantation_audit_species_results species on species.audit_id = audits.id
        left join plantation_evidence evidence on evidence.audit_id = audits.id
        where windows.id = $1
        group by windows.id, audits.id
      `,
      [window.rows[0]?.id],
    )

    assert.equal(result.status, 'completed')
    assert.equal(audit.rows[0]?.status, 'completed')
    assert.equal(audit.rows[0]?.audit_id, result.auditId)
    assert.equal(audit.rows[0]?.surviving_count, 330)
    assert.equal(audit.rows[0]?.species_rows, '2')
    assert.equal(audit.rows[0]?.evidence_rows, '1')
  })
})

test('cron marks overdue scheduled windows as missed', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)
    await advanceSiteToAccepted(client, siteId)

    await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-15',
      actor: memberId,
    })

    const result = await markMissedAuditWindows(client, {
      asOfDate: '2026-10-30',
      limit: 10,
    })
    const windows = await client.query<{ status: string; missed_at: Date | string | null }>(
      `
        select status::text, missed_at
        from plantation_audit_windows
        where site_id = $1
        order by sequence_number
        limit 2
      `,
      [siteId],
    )
    const event = await client.query<{ event_type: string; actor: string }>(
      `
        select event_type::text, actor
        from plantation_window_events events
        join plantation_audit_windows windows on windows.id = events.window_id
        where windows.site_id = $1
          and events.event_type = 'missed'
        order by events.created_at desc
        limit 1
      `,
      [siteId],
    )

    assert.deepEqual(result, { scanned: 1, missed: 1 })
    assert.equal(windows.rows[0]?.status, 'missed')
    assert.ok(windows.rows[0]?.missed_at)
    assert.equal(windows.rows[1]?.status, 'scheduled')
    assert.deepEqual(event.rows[0], { event_type: 'missed', actor: 'cron' })
  })
})
