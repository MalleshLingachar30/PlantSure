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
        owner_approver_email,
        escalation_email
      ) values (
        $1,
        '00000000-0000-4000-8000-000000000010',
        'Green Karnataka 2026',
        'technician-0277@example.com',
        'iaft@example.com'
      )
    `,
    [id],
  )
}

async function insertMember(
  client: Client,
  id: string,
  role: 'admin' | 'manager' | 'auditor' | 'technician',
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
      on conflict (id) do update set role = excluded.role
    `,
    [
      id,
      `test:${id}`,
      `${role}-${id.slice(-4)}@example.com`,
      `Test ${role}`,
      role,
    ],
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
  await client.query(
    `
      insert into plantation_batch_species (
        site_id,
        species_name,
        planted_count
      ) values (
        $1,
        'Mixed',
        600
      )
    `,
    [id],
  )
}

test('Postgres derives planted_count from species rows and refuses direct count changes', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000001'
    const siteId = '00000000-0000-4000-8000-000000000002'

    await insertProgram(client, programId)
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000123')

    await assert.rejects(
      () => client.query(`update plantation_sites set planted_count = 611 where id = $1`, [siteId]),
      /planted_count is derived from species rows/,
    )

    await client.query(
      `
        update plantation_batch_species
        set planted_count = 610
        where site_id = $1
      `,
      [siteId],
    )

    const refreshed = await client.query<{ planted_count: number }>(
      `select planted_count from plantation_sites where id = $1`,
      [siteId],
    )
    assert.equal(refreshed.rows[0]?.planted_count, 610)

    await client.query(`update plantation_sites set status = 'counts_confirmed' where id = $1`, [siteId])
    await assert.rejects(
      () =>
        client.query(
          `
            update plantation_batch_species
            set planted_count = 612
            where site_id = $1
          `,
          [siteId],
        ),
      /species composition is locked after acceptance/,
    )
  })
})

test('Postgres stores boundary corner points as an array', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000101'
    const siteId = '00000000-0000-4000-8000-000000000102'

    await insertProgram(client, programId)
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000124')

    const boundary = [
      { lat: 13.312, lng: 76.941 },
      { lat: 13.313, lng: 76.942 },
      { lat: 13.311, lng: 76.943 },
    ]
    await client.query(
      `update plantation_sites set boundary_points = $2::jsonb where id = $1`,
      [siteId, JSON.stringify(boundary)],
    )

    const stored = await client.query<{ boundary_points: Array<{ lat: number; lng: number }> }>(
      `select boundary_points from plantation_sites where id = $1`,
      [siteId],
    )
    assert.deepEqual(stored.rows[0]?.boundary_points, boundary)

    await assert.rejects(
      () =>
        client.query(
          `
            update plantation_sites
            set boundary_points = '{"lat": 13.312, "lng": 76.941}'::jsonb
            where id = $1
          `,
          [siteId],
        ),
      /plantation_sites_boundary_points_array_check/,
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

test('Postgres advances site stages only through the state function', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000251'
    const siteId = '00000000-0000-4000-8000-000000000252'
    const registrarId = '00000000-0000-4000-8000-000000000253'
    const sponsorId = '00000000-0000-4000-8000-000000000254'

    await insertProgram(client, programId)
    await insertMember(client, registrarId, 'manager')
    await insertMember(client, sponsorId, 'technician')
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000126')

    await assert.rejects(
      () =>
        client.query(
          `update plantation_sites set stage = 'land_verified' where id = $1`,
          [siteId],
        ),
      /site stage must advance through advance_plantation_site_stage/,
    )

    await assert.rejects(
      () =>
        client.query(
          `select advance_plantation_site_stage($1, 'land_verified', $2)`,
          [siteId, sponsorId],
        ),
      /plantation member role technician cannot advance planting stages/,
    )

    const verified = await client.query<{ stage: string }>(
      `select advance_plantation_site_stage($1, 'land_verified', $2, 'verified in field')::text as stage`,
      [siteId, registrarId],
    )
    assert.equal(verified.rows[0]?.stage, 'land_verified')

    await assert.rejects(
      () =>
        client.query(
          `select advance_plantation_site_stage($1, 'material_arranged', $2)`,
          [siteId, registrarId],
        ),
      /site stage must move forward one step at a time/,
    )

    await client.query(
      `select advance_plantation_site_stage($1, 'species_configured', $2)`,
      [siteId, registrarId],
    )
    await client.query(
      `select advance_plantation_site_stage($1, 'material_arranged', $2)`,
      [siteId, registrarId],
    )

    await assert.rejects(
      () =>
        client.query(
          `select advance_plantation_site_stage($1, 'pits_dug', $2)`,
          [siteId, registrarId],
        ),
      /required stage evidence is missing/,
    )

    await client.query(
      `
        insert into plantation_evidence (
          site_id,
          stage,
          url,
          captured_at,
          uploaded_by
        ) values (
          $1,
          'pits_dug',
          'https://plantsure.feedbacknfc.com/evidence/pits.jpg',
          now(),
          '00000000-0000-4000-8000-000000000020'
        )
      `,
      [siteId],
    )
    const pits = await client.query<{ stage: string }>(
      `select advance_plantation_site_stage($1, 'pits_dug', $2)::text as stage`,
      [siteId, registrarId],
    )
    assert.equal(pits.rows[0]?.stage, 'pits_dug')

    const events = await client.query<{ count: string }>(
      `select count(*)::text from plantation_stage_events where site_id = $1`,
      [siteId],
    )
    assert.equal(events.rows[0]?.count, '4')
  })
})

test('Postgres advances window state only through the state function', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000261'
    const siteId = '00000000-0000-4000-8000-000000000262'
    const windowId = '00000000-0000-4000-8000-000000000263'
    const secondWindowId = '00000000-0000-4000-8000-000000000264'
    const inspectorId = '00000000-0000-4000-8000-000000000265'
    const registrarId = '00000000-0000-4000-8000-000000000266'

    await insertProgram(client, programId)
    await insertMember(client, inspectorId, 'auditor')
    await insertMember(client, registrarId, 'manager')
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000127')
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
          2,
          'Y1-Q2',
          '2027-01-15',
          '2027-01-29'
        )
      `,
      [secondWindowId, siteId],
    )

    await assert.rejects(
      () =>
        client.query(
          `update plantation_audit_windows set status = 'missed' where id = $1`,
          [windowId],
        ),
      /window status must advance through advance_plantation_window_state/,
    )

    await assert.rejects(
      () =>
        client.query(
          `select advance_plantation_window_state($1, 'completed', $2)`,
          [windowId, registrarId],
        ),
      /plantation member role manager cannot record checks/,
    )

    const completed = await client.query<{ status: string }>(
      `select advance_plantation_window_state($1, 'completed', $2)::text as status`,
      [windowId, inspectorId],
    )
    assert.equal(completed.rows[0]?.status, 'completed')

    await assert.rejects(
      () =>
        client.query(
          `select advance_plantation_window_state($1, 'missed', $2)`,
          [secondWindowId, inspectorId],
        ),
      /missed windows can only be recorded by cron/,
    )

    const missed = await client.query<{ status: string }>(
      `select advance_plantation_window_state($1, 'missed', 'cron')::text as status`,
      [secondWindowId],
    )
    assert.equal(missed.rows[0]?.status, 'missed')

    const event = await client.query<{ event_type: string; actor: string }>(
      `
        select event_type::text, actor
        from plantation_window_events
        where window_id = $1
        order by created_at desc
        limit 1
      `,
      [secondWindowId],
    )
    assert.deepEqual(event.rows[0], { event_type: 'missed', actor: 'cron' })
  })
})

test('Postgres locks accepted acceptance records', async () => {
  await withMigratedDatabase(async ({ client }) => {
    const programId = '00000000-0000-4000-8000-000000000271'
    const siteId = '00000000-0000-4000-8000-000000000272'
    const acceptanceId = '00000000-0000-4000-8000-000000000273'
    const rejectedAcceptanceId = '00000000-0000-4000-8000-000000000274'
    const secondSiteId = '00000000-0000-4000-8000-000000000275'
    const registrarId = '00000000-0000-4000-8000-000000000276'
    const sponsorId = '00000000-0000-4000-8000-000000000277'
    const wrongSponsorId = '00000000-0000-4000-8000-000000000281'
    const inspectorId = '00000000-0000-4000-8000-000000000278'
    const adminBreakGlassSiteId = '00000000-0000-4000-8000-000000000279'
    const adminAcceptanceId = '00000000-0000-4000-8000-000000000280'
    const adminMemberId = '00000000-0000-4000-8000-000000000020'

    await insertProgram(client, programId)
    await insertMember(client, registrarId, 'manager')
    await insertMember(client, sponsorId, 'technician')
    await insertMember(client, wrongSponsorId, 'technician')
    await insertMember(client, inspectorId, 'auditor')
    await insertSite(client, siteId, programId, 'KA-TMK-GUB-000128')
    await insertSite(client, secondSiteId, programId, 'KA-TMK-GUB-000129')
    await insertSite(client, adminBreakGlassSiteId, programId, 'KA-TMK-GUB-000130')

    await assert.rejects(
      () =>
        client.query(
          `
            insert into plantation_acceptances (
              site_id,
              submitted_by
            ) values (
              $1,
              $2
            )
          `,
          [siteId, inspectorId],
        ),
      /plantation member role auditor cannot submit a baseline for acceptance/,
    )

    await assert.rejects(
      () =>
        client.query(
          `
            insert into plantation_acceptances (
              site_id,
              submitted_by,
              accepted_by,
              accepted_role,
              accepted_at,
              accepted_snapshot
            ) values (
              $1,
              $2,
              $2,
              'primary',
              now(),
              '{"species":[{"speciesName":"Mixed","plantedCount":600}]}'::jsonb
            )
          `,
          [siteId, registrarId],
        ),
      /registrar and sponsor must be different members/,
    )

    await assert.rejects(
      () =>
        client.query(
          `
            insert into plantation_acceptances (
              site_id,
              submitted_by,
              accepted_by,
              accepted_role,
              accepted_at,
              accepted_snapshot
            ) values (
              $1,
              $2,
              $2,
              'primary',
              now(),
              '{"species":[{"speciesName":"Mixed","plantedCount":600}]}'::jsonb
            )
          `,
          [adminBreakGlassSiteId, adminMemberId],
        ),
      /admin acceptance must be recorded as admin break-glass/,
    )

    await client.query(
      `
        insert into plantation_acceptances (
          id,
          site_id,
          submitted_by,
          accepted_by,
          accepted_as_admin,
          accepted_at,
          accepted_snapshot
        ) values (
          $1,
          $2,
          $3,
          $3,
          true,
          now(),
          '{"species":[{"speciesName":"Mixed","plantedCount":600}]}'::jsonb
        )
      `,
      [adminAcceptanceId, adminBreakGlassSiteId, adminMemberId],
    )

    await assert.rejects(
      () =>
        client.query(
          `
            insert into plantation_acceptances (
              site_id,
              submitted_by,
              accepted_by,
              accepted_role,
              accepted_at,
              accepted_snapshot
            ) values (
              $1,
              $2,
              $3,
              'primary',
              now(),
              '{"species":[{"speciesName":"Mixed","plantedCount":600}]}'::jsonb
            )
          `,
          [siteId, registrarId, wrongSponsorId],
        ),
      /accepted baseline must be approved by the assigned project owner account/,
    )

    await client.query(
      `
        insert into plantation_acceptances (
          id,
          site_id,
          submitted_by,
          accepted_by,
          accepted_role,
          accepted_at,
          accepted_snapshot
        ) values (
          $1,
          $2,
          $3,
          $4,
          'primary',
          now(),
          '{"species":[{"speciesName":"Mixed","plantedCount":600}]}'::jsonb
        )
      `,
      [acceptanceId, siteId, registrarId, sponsorId],
    )

    await assert.rejects(
      () =>
        client.query(
          `update plantation_acceptances set accepted_snapshot = '{}'::jsonb where id = $1`,
          [acceptanceId],
        ),
      /decided plantation acceptance records are locked/,
    )
    await assert.rejects(
      () => client.query(`delete from plantation_acceptances where id = $1`, [acceptanceId]),
      /decided plantation acceptance records are locked/,
    )

    await client.query(
      `
        insert into plantation_acceptances (
          id,
          site_id,
          submitted_by,
          rejected_by,
          rejected_at,
          rejection_reason
        ) values (
          $1,
          $2,
          $3,
          $4,
          now(),
          'baseline needs corrected species rows'
        )
      `,
      [rejectedAcceptanceId, secondSiteId, registrarId, sponsorId],
    )

    await assert.rejects(
      () =>
        client.query(
          `update plantation_acceptances set rejection_reason = 'changed' where id = $1`,
          [rejectedAcceptanceId],
        ),
      /decided plantation acceptance records are locked/,
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
