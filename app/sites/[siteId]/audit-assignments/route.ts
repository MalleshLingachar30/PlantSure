import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assignAuditWindow } from '@/lib/audit-assignments'
import { requirePlantationMember } from '@/lib/auth-member'
import { ensureAuditorInvitation } from '@/lib/auditor-invitation'
import { withDatabase } from '@/lib/db'

const assignmentSchema = z.object({
  windowId: z.string().uuid(),
  siteAuditorId: z.string().uuid(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId, 'assignment')
  }

  try {
    const assignment = await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['admin'])

      return assignAuditWindow(client, {
        siteId,
        windowId: parsed.data.windowId,
        siteAuditorId: parsed.data.siteAuditorId,
        assignedByMemberId: member.id,
      })
    })

    try {
      await ensureAuditorInvitation({
        siteId,
        locationId: assignment.locationId,
        email: assignment.auditorEmail,
      })
    } catch (error) {
      console.error('Failed to create auditor invitation for assignment', error)
    }
  } catch (error) {
    console.error('Failed to assign audit window', error)
    return redirectToSite(request, siteId, 'assignment')
  }

  revalidatePath('/admin')
  revalidatePath('/auditor')
  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(
    new URL(`/sites/${siteId}?console=1&assignment=1`, request.url),
    303,
  )
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&error=${error}`, request.url), 303)
}

