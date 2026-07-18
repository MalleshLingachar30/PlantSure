import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrationPath = new URL('../drizzle/0000_remarkable_justin_hammer.sql', import.meta.url)

async function applyMigration(db: PGlite): Promise<void> {
  const migrationSql = await readFile(migrationPath, 'utf8')
  const pgliteSql = migrationSql.replace(
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    `
      create or replace function gen_random_uuid()
      returns uuid
      language sql
      as 'select ''00000000-0000-4000-8000-000000000000''::uuid';
    `,
  )

  await db.exec(pgliteSql)
}

test('database refuses planted_count changes after counts are confirmed', async () => {
  const db = new PGlite()
  await applyMigration(db)

  const programId = '00000000-0000-4000-8000-000000000001'
  const siteId = '00000000-0000-4000-8000-000000000002'

  await db.query(
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
    [programId],
  )

  await db.query(
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
        'KA-TMK-GUB-000123',
        'Gubbi site 1',
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
    [siteId, programId],
  )

  await db.query(`update plantation_sites set planted_count = 610 where id = $1`, [siteId])
  await db.query(`update plantation_sites set status = 'counts_confirmed' where id = $1`, [siteId])

  await assert.rejects(
    () => db.query(`update plantation_sites set planted_count = 611 where id = $1`, [siteId]),
    /planted_count is locked after counts are confirmed/,
  )
})

test('database refuses confirming a site and changing planted_count in the same update', async () => {
  const db = new PGlite()
  await applyMigration(db)

  const programId = '00000000-0000-4000-8000-000000000101'
  const siteId = '00000000-0000-4000-8000-000000000102'

  await db.query(
    `
      insert into plantation_programs (
        id,
        organization_id,
        name,
        escalation_email
      ) values (
        $1,
        '00000000-0000-4000-8000-000000000110',
        'Green Karnataka 2026',
        'iaft@example.com'
      )
    `,
    [programId],
  )

  await db.query(
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
        'KA-TMK-GUB-000124',
        'Gubbi site 2',
        'Tumakuru',
        'Gubbi',
        'Gubbi',
        13.313000,
        76.942000,
        600,
        '2026-07-15',
        '00000000-0000-4000-8000-000000000120'
      )
    `,
    [siteId, programId],
  )

  await assert.rejects(
    () =>
      db.query(
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
