import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendAcceptanceRequestEmail } from '@/lib/acceptance-request-email'
import {
  requirePlantationMember,
  requireProgramOwnerApproverForSite,
} from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import {
  acceptSiteAsSponsor,
  markAcceptanceRequestNotificationFailed,
  markAcceptanceRequestNotificationSent,
  submitSiteForAcceptanceWithNotification,
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

  if (parsed.data.action === 'submit') {
    try {
      const notification = await withDatabase(async (client) => {
        const member = await requirePlantationMember(client, ['admin', 'manager'])
        return submitSiteForAcceptanceWithNotification(client, {
          siteId,
          submittedByMemberId: member.id,
        })
      })

      let notified: 'sent' | 'failed' = 'sent'

      try {
        const delivery = await sendAcceptanceRequestEmail(notification)
        await withDatabase((client) =>
          markAcceptanceRequestNotificationSent(client, {
            notificationId: notification.notificationId,
            provider: delivery.provider,
            providerMessageId: delivery.providerMessageId,
          }),
        )
      } catch (error) {
        notified = 'failed'
        await withDatabase((client) =>
          markAcceptanceRequestNotificationFailed(client, {
            notificationId: notification.notificationId,
            provider: 'resend',
            errorMessage:
              error instanceof Error ? error.message.slice(0, 500) : 'Email delivery failed',
          }),
        )
      }

      revalidatePath('/admin')
      revalidatePath(`/sites/${siteId}`)

      return NextResponse.redirect(
        new URL(`/sites/${siteId}?submitted=1&notified=${notified}`, request.url),
        303,
      )
    } catch {
      return redirectToSite(request, siteId, 'acceptance')
    }
  }

  try {
    await withDatabase(async (client) => {
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

  return NextResponse.redirect(new URL(`/sites/${siteId}?approved=1`, request.url), 303)
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?error=${error}`, request.url), 303)
}
