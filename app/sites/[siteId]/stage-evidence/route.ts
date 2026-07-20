import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlantationMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import { recordStageEvidenceAndAdvance } from '@/lib/plantation-registration'

const stageEvidenceSchema = z.object({
  stage: z.enum(['pits_dug', 'planted']),
  capturedAt: z.string().trim().min(1),
  evidencePhotoUrls: z.string().trim().min(1),
  evidenceLatitude: z.string().trim().optional(),
  evidenceLongitude: z.string().trim().optional(),
  gpsAccuracy: z.string().trim().optional(),
  caption: z.string().trim().optional(),
})

const decimalCoordinateSchema = z.string().trim().regex(/^-?\d+(\.\d+)?$/)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = stageEvidenceSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId)
  }

  const input = parsed.data
  const photoUrls = parsePhotoUrls(input.evidencePhotoUrls)

  if (
    !photoUrls ||
    photoUrls.length === 0 ||
    (input.evidenceLatitude && !decimalCoordinateSchema.safeParse(input.evidenceLatitude).success) ||
    (input.evidenceLongitude && !decimalCoordinateSchema.safeParse(input.evidenceLongitude).success)
  ) {
    return redirectToSite(request, siteId)
  }

  try {
    await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['admin', 'manager'])

      return recordStageEvidenceAndAdvance(client, {
        siteId,
        stage: input.stage,
        photoUrls,
        capturedAt: input.capturedAt,
        latitude: input.evidenceLatitude || null,
        longitude: input.evidenceLongitude || null,
        gpsAccuracy: input.gpsAccuracy || null,
        caption: input.caption || null,
        uploadedByMemberId: member.id,
      })
    })
  } catch {
    return redirectToSite(request, siteId)
  }

  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(new URL(`/sites/${siteId}?stage=${input.stage}`, request.url), 303)
}

function parsePhotoUrls(value: string | undefined): string[] | null {
  if (!value) {
    return []
  }

  const urls = value
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean)

  if (urls.length > 12) {
    return null
  }

  for (const url of urls) {
    try {
      const parsed = new URL(url)

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null
      }
    } catch {
      return null
    }
  }

  return urls
}

function redirectToSite(request: Request, siteId: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?error=stage`, request.url), 303)
}
