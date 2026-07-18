import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Client } from 'pg'
import {
  buildAuditWindows,
  confirmPlantationCounts,
  createPlantationProgram,
  createPlantationSite,
} from '../lib/plantation-registration'

const migrationsPath = new URL('../drizzle/', import.meta.url)
const memberId = '00000000-0000-4000-8000-000000000020'

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
  const program = await createPlantationProgram(client, {
    organizationId: randomUUID(),
    name: 'Green Karnataka 2026',
    escalationEmail: 'iaft@example.com',
  })

  return program.id
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
    latitude: '13.312000',
    longitude: '76.941000',
    plantedCount: 600,
    plantingDate: '2026-07-15',
    createdByMemberId: memberId,
  })

  return site.id
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

test('site registration allocates Location IDs from the database sequence', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)

    const first = await createPlantationSite(client, {
      programId,
      stateCode: 'ka',
      districtCode: 'tmk',
      villageCode: 'gub',
      name: 'Gubbi site 1',
      district: 'Tumakuru',
      taluk: 'Gubbi',
      village: 'Gubbi',
      latitude: '13.312000',
      longitude: '76.941000',
      plantedCount: 600,
      plantingDate: '2026-07-15',
      createdByMemberId: memberId,
    })
    const second = await createPlantationSite(client, {
      programId,
      stateCode: 'KA',
      districtCode: 'TMK',
      villageCode: 'GUB',
      name: 'Gubbi site 2',
      district: 'Tumakuru',
      taluk: 'Gubbi',
      village: 'Gubbi',
      latitude: '13.313000',
      longitude: '76.942000',
      plantedCount: 600,
      plantingDate: '2026-07-15',
      createdByMemberId: memberId,
    })

    assert.equal(first.locationId, 'KA-TMK-GUB-000001')
    assert.equal(first.status, 'registered')
    assert.equal(second.locationId, 'KA-TMK-GUB-000002')

    const sequence = await client.query<{ next_location_sequence: number }>(
      `select next_location_sequence from plantation_programs where id = $1`,
      [programId],
    )
    assert.equal(sequence.rows[0]?.next_location_sequence, 3)
  })
})

test('concurrent site registrations allocate unique Location IDs', async () => {
  await withMigratedDatabase(async ({ client, schemaName }) => {
    const programId = await createProgram(client)
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
            programId,
            stateCode: 'KA',
            districtCode: 'TMK',
            villageCode: 'GUB',
            name: `Gubbi site ${index + 1}`,
            district: 'Tumakuru',
            taluk: 'Gubbi',
            village: 'Gubbi',
            latitude: '13.312000',
            longitude: '76.941000',
            plantedCount: 600,
            plantingDate: '2026-07-15',
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

    const confirmation = await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-15',
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
      monitoring_start: Date | string
      monitoring_end: Date | string
    }>(`select status, monitoring_start, monitoring_end from plantation_sites where id = $1`, [siteId])
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
        from plantation_window_events
        where event_type = 'generated'
      `,
    )

    assert.equal(site.rows[0]?.status, 'counts_confirmed')
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
      /planted_count is locked after counts are confirmed/,
    )
  })
})

test('confirm counts is idempotent and does not create duplicate windows', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = await createProgram(client)
    const siteId = await createSite(client, programId)

    await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-15',
    })
    const second = await confirmPlantationCounts(client, {
      siteId,
      monitoringStart: '2026-07-16',
    })
    const windows = await client.query<{ count: string }>(
      `select count(*)::text from plantation_audit_windows where site_id = $1`,
      [siteId],
    )
    const events = await client.query<{ count: string }>(
      `select count(*)::text from plantation_window_events`,
    )

    assert.equal(second.alreadyConfirmed, true)
    assert.equal(second.monitoringStart, '2026-07-15')
    assert.equal(second.monitoringEnd, '2031-07-15')
    assert.equal(second.windowsCreated, 0)
    assert.equal(windows.rows[0]?.count, '20')
    assert.equal(events.rows[0]?.count, '20')
  })
})
