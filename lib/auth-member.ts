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
  role: 'admin' | 'auditor'
}

type MemberRow = {
  id: string
  clerk_user_id: string
  email: string | null
  display_name: string | null
  role: 'admin' | 'auditor'
}

export async function requireSignedIn(): Promise<{ userId: string }> {
  const { userId } = await auth.protect()

  return { userId }
}

export async function requireAdminMember(db: Queryable): Promise<AuthenticatedMember> {
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
  const role = adminEmails().has(email?.toLowerCase() ?? '') ? 'admin' : 'auditor'
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

  if (row.role !== 'admin') {
    throw new Error('PlantSure admin access is required')
  }

  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  }
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.PLANTSURE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}
