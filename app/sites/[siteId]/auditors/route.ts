import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlantationMember } from '@/lib/auth-member'
import { ensureAuditorInvitation } from '@/lib/auditor-invitation'
import { withDatabase } from '@/lib/db'

const auditorSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = auditorSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId, 'auditor')
  }

  const input = parsed.data
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName?.trim() || null

  try {
    const assignment = await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['admin'])
      const siteResult = await client.query<{ location_id: string }>(
        `
          select location_id
          from plantation_sites
          where id = $1
        `,
        [siteId],
      )
      const site = siteResult.rows[0]

      if (!site) {
        throw new Error('Plantation site not found')
      }

      const updated = await client.query<{ id: string }>(
        `
          update plantation_site_auditors
          set
            email = $3,
            display_name = $4,
            active = true,
            created_by_member_id = coalesce(created_by_member_id, $5),
            updated_at = now()
          where site_id = $1
            and lower(btrim(email)) = $2
          returning id
        `,
        [siteId, email, input.email.trim(), displayName, member.id],
      )

      if (updated.rows[0]) {
        return { id: updated.rows[0].id, locationId: site.location_id }
      }

      const inserted = await client.query<{ id: string }>(
        `
          insert into plantation_site_auditors (
            site_id,
            email,
            display_name,
            created_by_member_id
          ) values (
            $1,
            $2,
            $3,
            $4
          )
          returning id
        `,
        [siteId, input.email.trim(), displayName, member.id],
      )

      return { id: inserted.rows[0]?.id ?? null, locationId: site.location_id }
    })

    if (!assignment.id) {
      throw new Error('Failed to register auditor')
    }

    try {
      await ensureAuditorInvitation({
        siteId,
        locationId: assignment.locationId,
        email,
      })
    } catch (error) {
      console.error('Failed to create auditor invitation', error)
      revalidatePath('/admin')
      revalidatePath(`/sites/${siteId}`)

      return NextResponse.redirect(
        new URL(`/sites/${siteId}?console=1&auditor=1&invited=failed`, request.url),
        303,
      )
    }
  } catch (error) {
    console.error('Failed to register site auditor', error)
    return redirectToSite(request, siteId, 'auditor')
  }

  revalidatePath('/admin')
  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(
    new URL(`/sites/${siteId}?console=1&auditor=1&invited=sent`, request.url),
    303,
  )
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&error=${error}`, request.url), 303)
}
