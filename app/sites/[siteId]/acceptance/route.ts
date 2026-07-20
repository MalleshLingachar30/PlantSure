import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requirePlantationMember,
  requireProgramOwnerApproverForSite,
} from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import {
  acceptSiteAsSponsor,
  submitSiteForAcceptance,
} from '@/lib/plantation-registration'

const acceptanceSchema = z.object({
  action: z.enum(['submit', 'accept']),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = acceptanceSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId, 'acceptance')
  }

  try {
    await withDatabase(async (client) => {
      if (parsed.data.action === 'submit') {
        const member = await requirePlantationMember(client, ['admin', 'manager'])
        await submitSiteForAcceptance(client, {
          siteId,
          submittedByMemberId: member.id,
        })
        return
      }

      const member = await requireProgramOwnerApproverForSite(client, siteId)
      await acceptSiteAsSponsor(client, {
        siteId,
        acceptedByMemberId: member.id,
        acceptedRole: 'primary',
      })
    })
  } catch {
    return redirectToSite(request, siteId, 'acceptance')
  }

  revalidatePath('/admin')
  revalidatePath(`/sites/${siteId}`)

  const searchParam = parsed.data.action === 'submit' ? 'submitted=1' : 'approved=1'
  return NextResponse.redirect(new URL(`/sites/${siteId}?${searchParam}`, request.url), 303)
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?error=${error}`, request.url), 303)
}
