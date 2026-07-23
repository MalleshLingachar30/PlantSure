export type Queryable = {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>
}

export type ScientificAdvisorType =
  | 'scientific_institute'
  | 'forest_department'
  | 'university'
  | 'independent'
  | 'other'

export type OrganizationType =
  | 'institution'
  | 'corporate'
  | 'foundation'
  | 'government'
  | 'community'
  | 'other'

export type ScientificAdvisorSummary = {
  id: string
  name: string
  advisorType: ScientificAdvisorType
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}

export type PlantingOrganizationSummary = {
  id: string
  name: string
  organizationType: OrganizationType
  scientificAdvisorId: string
  scientificAdvisorName: string
  primaryContactName: string | null
  primaryContactEmail: string | null
  primaryContactPhone: string | null
  ownerApproverName: string | null
  ownerApproverEmail: string
}

export type PlantationDirectory = {
  scientificAdvisors: ScientificAdvisorSummary[]
  organizations: PlantingOrganizationSummary[]
}

export type CreateScientificAdvisorInput = {
  name: string
  advisorType: ScientificAdvisorType
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

export type CreatePlantingOrganizationInput = {
  name: string
  organizationType: OrganizationType
  scientificAdvisorId: string
  primaryContactName?: string | null
  primaryContactEmail?: string | null
  primaryContactPhone?: string | null
  ownerApproverName?: string | null
  ownerApproverEmail: string
}

export async function listPlantationDirectory(
  db: Queryable,
): Promise<PlantationDirectory> {
  const [advisorsResult, organizationsResult] = await Promise.all([
    db.query<{
      id: string
      name: string
      advisor_type: ScientificAdvisorType
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
    }>(
      `
        select
          id,
          name,
          advisor_type::text as advisor_type,
          contact_name,
          contact_email,
          contact_phone
        from plantation_scientific_advisors
        where is_active = true
        order by name asc
      `,
    ),
    db.query<{
      id: string
      name: string
      organization_type: OrganizationType
      scientific_advisor_id: string
      scientific_advisor_name: string
      primary_contact_name: string | null
      primary_contact_email: string | null
      primary_contact_phone: string | null
      owner_approver_name: string | null
      owner_approver_email: string
    }>(
      `
        select
          organizations.id,
          organizations.name,
          organizations.organization_type::text as organization_type,
          organizations.scientific_advisor_id,
          advisors.name as scientific_advisor_name,
          organizations.primary_contact_name,
          organizations.primary_contact_email,
          organizations.primary_contact_phone,
          organizations.owner_approver_name,
          organizations.owner_approver_email
        from plantation_organizations organizations
        join plantation_scientific_advisors advisors
          on advisors.id = organizations.scientific_advisor_id
        where organizations.is_active = true
        order by organizations.name asc
      `,
    ),
  ])

  return {
    scientificAdvisors: advisorsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      advisorType: row.advisor_type,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
    })),
    organizations: organizationsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      organizationType: row.organization_type,
      scientificAdvisorId: row.scientific_advisor_id,
      scientificAdvisorName: row.scientific_advisor_name,
      primaryContactName: row.primary_contact_name,
      primaryContactEmail: row.primary_contact_email,
      primaryContactPhone: row.primary_contact_phone,
      ownerApproverName: row.owner_approver_name,
      ownerApproverEmail: row.owner_approver_email,
    })),
  }
}

export async function findOrCreateScientificAdvisor(
  db: Queryable,
  input: CreateScientificAdvisorInput,
): Promise<{ id: string }> {
  const name = input.name.trim()

  if (!name) {
    throw new Error('Scientific advisor name is required')
  }

  const existing = await db.query<{ id: string }>(
    `
      select id
      from plantation_scientific_advisors
      where lower(name) = lower($1)
      order by created_at asc
      limit 1
    `,
    [name],
  )

  if (existing.rows[0]?.id) {
    await db.query(
      `
        update plantation_scientific_advisors
        set
          advisor_type = $2,
          contact_name = $3,
          contact_email = $4,
          contact_phone = $5,
          updated_at = now()
        where id = $1
      `,
      [
        existing.rows[0].id,
        input.advisorType,
        trimmedOrNull(input.contactName),
        trimmedOrNull(input.contactEmail),
        trimmedOrNull(input.contactPhone),
      ],
    )

    return { id: existing.rows[0].id }
  }

  const created = await db.query<{ id: string }>(
    `
      insert into plantation_scientific_advisors (
        name,
        advisor_type,
        contact_name,
        contact_email,
        contact_phone
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      returning id
    `,
    [
      name,
      input.advisorType,
      trimmedOrNull(input.contactName),
      trimmedOrNull(input.contactEmail),
      trimmedOrNull(input.contactPhone),
    ],
  )

  const id = created.rows[0]?.id
  if (!id) {
    throw new Error('Failed to create scientific advisor')
  }

  return { id }
}

export async function findOrCreatePlantingOrganization(
  db: Queryable,
  input: CreatePlantingOrganizationInput,
): Promise<{ id: string }> {
  const name = input.name.trim()
  const ownerApproverEmail = input.ownerApproverEmail.trim().toLowerCase()

  if (!name || !ownerApproverEmail) {
    throw new Error('Planting organization name and approver email are required')
  }

  const existing = await db.query<{ id: string }>(
    `
      select id
      from plantation_organizations
      where lower(name) = lower($1)
      order by created_at asc
      limit 1
    `,
    [name],
  )

  if (existing.rows[0]?.id) {
    await db.query(
      `
        update plantation_organizations
        set
          organization_type = $2,
          scientific_advisor_id = $3,
          primary_contact_name = $4,
          primary_contact_email = $5,
          primary_contact_phone = $6,
          owner_approver_name = $7,
          owner_approver_email = $8,
          updated_at = now()
        where id = $1
      `,
      [
        existing.rows[0].id,
        input.organizationType,
        input.scientificAdvisorId,
        trimmedOrNull(input.primaryContactName),
        normalizedEmailOrNull(input.primaryContactEmail),
        trimmedOrNull(input.primaryContactPhone),
        trimmedOrNull(input.ownerApproverName),
        ownerApproverEmail,
      ],
    )

    return { id: existing.rows[0].id }
  }

  const created = await db.query<{ id: string }>(
    `
      insert into plantation_organizations (
        name,
        organization_type,
        scientific_advisor_id,
        primary_contact_name,
        primary_contact_email,
        primary_contact_phone,
        owner_approver_name,
        owner_approver_email
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
      name,
      input.organizationType,
      input.scientificAdvisorId,
      trimmedOrNull(input.primaryContactName),
      normalizedEmailOrNull(input.primaryContactEmail),
      trimmedOrNull(input.primaryContactPhone),
      trimmedOrNull(input.ownerApproverName),
      ownerApproverEmail,
    ],
  )

  const id = created.rows[0]?.id
  if (!id) {
    throw new Error('Failed to create planting organization')
  }

  return { id }
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizedEmailOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  return trimmed ? trimmed : null
}
