import { auth, clerkClient } from '@clerk/nextjs/server'

type Queryable = {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TResult[] }>
}

export type AuthenticatedMember = {
  id: string
  clerkUserId: string
  email: string | null
  displayName: string | null
  role: 'admin' | 'manager' | 'auditor' | 'technician'
}

type MemberRow = {
  id: string
  clerk_user_id: string
  email: string | null
  display_name: string | null
  role: 'admin' | 'manager' | 'auditor' | 'technician'
}

type PlantationMemberRole = AuthenticatedMember['role']

export async function requireSignedIn(): Promise<{ userId: string }> {
  const { userId } = await auth.protect()

  return { userId }
}

export async function requirePlantationMember(
  db: Queryable,
  allowedRoles?: PlantationMemberRole[],
): Promise<AuthenticatedMember> {
  const { userId } = await requireSignedIn()
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses.at(0)?.emailAddress ??
    null
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    null
  const role = await inferredRole(db, email)
  const member = await db.query<MemberRow>(
    `
      insert into plantation_members (
        clerk_user_id,
        email,
        display_name,
        role
      ) values (
        $1,
        $2,
        $3,
        $4
      )
      on conflict (clerk_user_id)
      do update set
        email = excluded.email,
        display_name = excluded.display_name,
        role = case
          when excluded.role = 'admin' then 'admin'::plantation_member_role
          when excluded.role = 'technician' then 'technician'::plantation_member_role
          else plantation_members.role
        end,
        updated_at = now()
      returning id, clerk_user_id, email, display_name, role
    `,
    [userId, email, displayName, role],
  )
  const row = member.rows[0]

  if (!row) {
    throw new Error('Failed to load authenticated member')
  }

  if (allowedRoles && !allowedRoles.includes(row.role)) {
    throw new Error(`PlantSure ${allowedRoles.join('/')} access is required`)
  }

  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  }
}

export async function requireAdminMember(db: Queryable): Promise<AuthenticatedMember> {
  return requirePlantationMember(db, ['admin'])
}

export async function requireProgramOwnerApproverForSite(
  db: Queryable,
  siteId: string,
): Promise<AuthenticatedMember> {
  const member = await requirePlantationMember(db, ['technician'])
  const result = await db.query<{ owner_approver_email: string | null }>(
    `
      select programs.owner_approver_email
      from plantation_sites sites
      join plantation_programs programs on programs.id = sites.program_id
      where sites.id = $1
    `,
    [siteId],
  )
  const ownerApproverEmail = result.rows[0]?.owner_approver_email?.trim().toLowerCase() ?? null

  if (!ownerApproverEmail || !member.email || member.email.trim().toLowerCase() !== ownerApproverEmail) {
    throw new Error('Project owner approval is required from the assigned approver account')
  }

  return member
}

async function inferredRole(db: Queryable, email: string | null): Promise<PlantationMemberRole> {
  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  if (adminEmails().has(normalizedEmail)) {
    return 'admin'
  }

  if (normalizedEmail) {
    const sponsorMatch = await db.query<{ matched: boolean }>(
      `
        select exists(
          select 1
          from plantation_programs
          where lower(coalesce(owner_approver_email, '')) = $1
        ) as matched
      `,
      [normalizedEmail],
    )

    if (sponsorMatch.rows[0]?.matched) {
      return 'technician'
    }
  }

  return 'auditor'
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.PLANTSURE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}
