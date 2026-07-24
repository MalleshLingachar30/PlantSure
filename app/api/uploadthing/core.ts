import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError, UTFiles } from 'uploadthing/server'
import { z } from 'zod'
import { hasAcceptedAuditAssignment } from '@/lib/audit-assignments'
import { requireSiteAuditorForSite } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'

const f = createUploadthing()

const auditEvidenceInput = z.object({
  siteId: z.string().uuid(),
  windowId: z.string().uuid(),
  locationId: z.string().trim().min(1),
})

export const uploadRouter = {
  auditEvidence: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
      minFileCount: 1,
    },
  })
    .input(auditEvidenceInput)
    .middleware(async ({ input, files }) => {
      const member = await withDatabase(async (client) => {
        const siteMember = await requireSiteAuditorForSite(client, input.siteId, {
          allowAdmin: false,
        })
        const email = siteMember.email?.trim().toLowerCase()

        if (!email) {
          throw new UploadThingError('Accepted audit assignment is required')
        }

        const accepted = await hasAcceptedAuditAssignment(client, {
          siteId: input.siteId,
          windowId: input.windowId,
          email,
        })

        if (!accepted) {
          throw new UploadThingError('Accept this audit order before uploading evidence')
        }

        return siteMember
      })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileOverrides = files.map((file) => ({
        ...file,
        name: `${input.locationId}-${input.windowId}-${timestamp}-${file.name}`,
        customId: `${input.siteId}:${input.windowId}:${member.id}:${timestamp}`,
      }))

      return {
        uploadedByMemberId: member.id,
        siteId: input.siteId,
        windowId: input.windowId,
        [UTFiles]: fileOverrides,
      }
    })
    .onUploadComplete(({ file, metadata }) => ({
      url: file.ufsUrl,
      key: file.key,
      uploadedByMemberId: metadata.uploadedByMemberId,
      siteId: metadata.siteId,
      windowId: metadata.windowId,
    })),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
