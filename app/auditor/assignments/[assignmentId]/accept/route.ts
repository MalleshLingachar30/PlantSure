import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { acceptAuditAssignment } from '@/lib/audit-assignments'
import { requirePlantationMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params

  if (!z.string().uuid().safeParse(assignmentId).success) {
    return redirectToDashboard(request, 'assignment')
  }

  try {
    const result = await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['auditor'])

      return acceptAuditAssignment(client, {
        assignmentId,
        member,
      })
    })

    revalidatePath('/auditor')
    revalidatePath(`/p/${result.locationId}/check`)

    return NextResponse.redirect(new URL('/auditor?accepted=1', request.url), 303)
  } catch (error) {
    console.error('Failed to accept audit assignment', error)
    return redirectToDashboard(request, 'assignment')
  }
}

function redirectToDashboard(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/auditor?error=${error}`, request.url), 303)
}

