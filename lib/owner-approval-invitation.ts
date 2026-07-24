import { clerkClient } from '@clerk/nextjs/server'
import type { AcceptanceRequestNotificationPayload } from '@/lib/plantation-registration'
import { siteUrl } from '@/lib/site-url'

export async function ensureOwnerApprovalInvitation(
  payload: AcceptanceRequestNotificationPayload,
): Promise<void> {
  const email = payload.recipientEmail.trim().toLowerCase()

  if (!email) {
    return
  }

  const client = await clerkClient()
  const existingUsers = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  })

  if (existingUsers.data.length > 0) {
    return
  }

  const pendingInvitations = await client.invitations.getInvitationList({
    query: email,
    status: 'pending',
    limit: 1,
  })

  if (pendingInvitations.data.length > 0) {
    return
  }

  await client.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: siteUrl(`/sites/${payload.siteId}/review`),
    publicMetadata: {
      plantsureRole: 'owner_approver',
      siteId: payload.siteId,
      locationId: payload.locationId,
    },
    notify: true,
  })
}
