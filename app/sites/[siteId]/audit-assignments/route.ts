import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assignAuditWindow, cancelAuditAssignment } from '@/lib/audit-assignments'
import { requireSiteAuditManager } from '@/lib/auth-member'
import { ensureAuditorInvitation } from '@/lib/auditor-invitation'
import { withDatabase } from '@/lib/db'

const assignmentSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    windowId: z.string().uuid(),
    siteAuditorId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('cancel'),
    assignmentId: z.string().uuid(),
  }),
])

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
    const result = await withDatabase(async (client) => {
      const member = await requireSiteAuditManager(client, siteId)

      if (parsed.data.action === 'cancel') {
        await cancelAuditAssignment(client, {
          siteId,
          assignmentId: parsed.data.assignmentId,
        })

        return { action: 'cancelled' as const }
      }

      const assignment = await assignAuditWindow(client, {
        siteId,
        windowId: parsed.data.windowId,
        siteAuditorId: parsed.data.siteAuditorId,
        assignedByMemberId: member.id,
      })

      return { action: 'assigned' as const, assignment }
    })

    if (result.action === 'assigned') {
      const assignment = result.assignment

      try {
        await ensureAuditorInvitation({
          siteId,
          locationId: assignment.locationId,
          email: assignment.auditorEmail,
        })
      } catch (error) {
        console.error('Failed to create auditor invitation for assignment', error)
      }
    }
  } catch (error) {
    console.error('Failed to update audit assignment', error)
    return redirectToSite(request, siteId, 'assignment')
  }

  revalidatePath('/admin')
  revalidatePath('/auditor')
  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(
    new URL(
      `/sites/${siteId}?console=1&assignment=${parsed.data.action === 'cancel' ? 'cancelled' : '1'}`,
      request.url,
    ),
    303,
  )
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&error=${error}`, request.url), 303)
}
