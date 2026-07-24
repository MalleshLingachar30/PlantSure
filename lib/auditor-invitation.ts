import { clerkClient } from '@clerk/nextjs/server'
import { siteUrl } from '@/lib/site-url'

export type AuditorInvitationPayload = {
  siteId: string
  locationId: string
  email: string
}

export async function ensureAuditorInvitation(
  payload: AuditorInvitationPayload,
): Promise<void> {
  const email = payload.email.trim().toLowerCase()

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
    redirectUrl: siteUrl(
      `/p/${payload.locationId}/check?invited=${encodeURIComponent(email)}`,
    ),
    publicMetadata: {
      plantsureRole: 'auditor',
      siteId: payload.siteId,
      locationId: payload.locationId,
    },
    notify: true,
  })
}
