import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Client } from 'pg'

const migrationsPath = new URL('../drizzle/', import.meta.url)

type MigratedDatabase = {
  client: Client
  schemaName: string
}

async function withMigratedDatabase(run: (database: MigratedDatabase) => Promise<void>): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required for Postgres invariant tests')
  }

  const client = new Client({ connectionString })
  const schemaName = `plantsure_test_${randomUUID().replaceAll('-', '_')}`
  const schemaIdentifier = quoteIdentifier(schemaName)

  await client.connect()

  try {
    await client.query(`create schema ${schemaIdentifier}`)
    await client.query(`set search_path to ${schemaIdentifier}`)
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

async function insertProgram(client: Client, id: string): Promise<void> {
  await client.query(
    `
      insert into plantation_programs (
        id,
        organization_id,
        name,
        escalation_email
      ) values (
        $1,
        '00000000-0000-4000-8000-000000000010',
        'Green Karnataka 2026',
        'iaft@example.com'
      )
    `,
    [id],
  )
}

async function insertSite(client: Client, id: string, programId: string, locationId: string): Promise<void> {
  await client.query(
    `
      insert into plantation_sites (
        id,
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
        created_by_member_id
      ) values (
        $1,
        $2,
        $3,
        'Gubbi site',
        'Tumakuru',
        'Gubbi',
        'Gubbi',
        13.312000,
        76.941000,
        600,
        '2026-07-15',
        '00000000-0000-4000-8000-000000000020'
      )
    `,
    [id, programId, locationId],
  )
}

test('Postgres refuses planted_count changes after counts are confirmed', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000001'
    const siteId = '00000000-0000-4000-8000-000000000002'

    await insertProgram(client, programId)
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000123')

    await client.query(`update plantation_sites set planted_count = 610 where id = $1`, [siteId])
    await client.query(`update plantation_sites set status = 'counts_confirmed' where id = $1`, [siteId])

    await assert.rejects(
      () => client.query(`update plantation_sites set planted_count = 611 where id = $1`, [siteId]),
      /planted_count is locked after counts are confirmed/,
    )
  })
})

test('Postgres refuses confirming a site and changing planted_count in the same update', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000101'
    const siteId = '00000000-0000-4000-8000-000000000102'

    await insertProgram(client, programId)
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000124')

    await assert.rejects(
      () =>
        client.query(
          `
            update plantation_sites
            set status = 'counts_confirmed', planted_count = 601
            where id = $1
          `,
          [siteId],
        ),
      /planted_count is locked after counts are confirmed/,
    )
  })
})

test('Postgres keeps window events append-only', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000201'
    const siteId = '00000000-0000-4000-8000-000000000202'
    const windowId = '00000000-0000-4000-8000-000000000203'
    const eventId = '00000000-0000-4000-8000-000000000204'

    await insertProgram(client, programId)
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000125')
    await client.query(
      `
        insert into plantation_audit_windows (
          id,
          site_id,
          sequence_number,
          cycle_label,
          due_date,
          grace_until
        ) values (
          $1,
          $2,
          1,
          'Y1-Q1',
          '2026-10-15',
          '2026-10-29'
        )
      `,
      [windowId, siteId],
    )
    await client.query(
      `
        insert into plantation_window_events (
          id,
          window_id,
          event_type,
          actor
        ) values (
          $1,
          $2,
          'missed',
          'system'
        )
      `,
      [eventId, windowId],
    )

    await assert.rejects(
      () => client.query(`update plantation_window_events set actor = 'admin' where id = $1`, [eventId]),
      /plantation_window_events is append-only/,
    )
    await assert.rejects(
      () => client.query(`delete from plantation_window_events where id = $1`, [eventId]),
      /plantation_window_events is append-only/,
    )
  })
})

test('Postgres allocates Location IDs atomically from the global prefix sequence', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const firstProgramId = '00000000-0000-4000-8000-000000000301'
    const secondProgramId = '00000000-0000-4000-8000-000000000302'

    await insertProgram(client, firstProgramId)
    await insertProgram(client, secondProgramId)

    const first = await client.query<{ location_id: string }>(
      `select allocate_plantation_location_id($1, 'ka', 'tmk', 'gub') as location_id`,
      [firstProgramId],
    )
    const second = await client.query<{ location_id: string }>(
      `select allocate_plantation_location_id($1, 'KA', 'TMK', 'GUB') as location_id`,
      [secondProgramId],
    )
    const sequence = await client.query<{ next_location_sequence: number }>(
      `select next_location_sequence from plantation_location_sequences where prefix = $1`,
      ['KA-TMK-GUB'],
    )

    assert.equal(first.rows[0]?.location_id, 'KA-TMK-GUB-000001')
    assert.equal(second.rows[0]?.location_id, 'KA-TMK-GUB-000002')
    assert.equal(sequence.rows[0]?.next_location_sequence, 3)
  })
})

test('Postgres audit band thresholds match the Phase 1 contract', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const thresholds = await client.query<{ band: string }>(
      `
        select plantation_audit_band_for_counts(100, 85)::text as band
        union all select plantation_audit_band_for_counts(100, 84)::text
        union all select plantation_audit_band_for_counts(100, 70)::text
        union all select plantation_audit_band_for_counts(100, 69)::text
        union all select plantation_audit_band_for_counts(100, 50)::text
        union all select plantation_audit_band_for_counts(100, 49)::text
      `,
    )

    assert.deepEqual(
      thresholds.rows.map((row) => row.band),
      ['healthy', 'watch', 'watch', 'poor', 'poor', 'critical'],
    )
  })
})
