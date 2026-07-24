import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  hasAcceptedAuditAssignment,
  markAuditAssignmentSubmitted,
} from '@/lib/audit-assignments'
import { requireSiteAuditorForSite } from '@/lib/auth-member'
import { recordAuditCheck } from '@/lib/plantation-checks'
import { withDatabase } from '@/lib/db'

const auditCheckSchema = z.object({
  windowId: z.string().uuid(),
  returnTo: z.enum(['console', 'public']).optional(),
  locationId: z.string().trim().optional(),
  auditedAt: z.string().trim().min(1),
  auditPhotoUrls: z.string().trim().optional(),
  auditLatitude: z.string().trim().optional(),
  auditLongitude: z.string().trim().optional(),
  auditGpsAccuracy: z.string().trim().optional(),
  gpsStatus: z.enum(['confirmed', 'plausible', 'questionable', 'unavailable']),
  remarks: z.string().trim().optional(),
})

const decimalCoordinateSchema = z.string().trim().regex(/^-?\d+(\.\d+)?$/)
const decimalNonNegativeSchema = z.string().trim().regex(/^\d+(\.\d+)?$/)

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const rawInput = Object.fromEntries(formData)
  const parsed = auditCheckSchema.safeParse(rawInput)
  const returnTarget = returnTargetFromForm(rawInput)

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId, returnTarget)
  }

  const input = parsed.data
  const photoUrls = await parsePhotoEvidence(
    input.auditPhotoUrls,
    formData.get('auditPhotoFile'),
  )
  const speciesResults = parseAuditSpeciesRows(formData)
  const fieldQrCheck = input.returnTo === 'public'

  if (
    !photoUrls ||
    photoUrls.length === 0 ||
    !speciesResults ||
    (fieldQrCheck && !hasCapturedFieldEvidence(photoUrls)) ||
    (fieldQrCheck && (!input.auditLatitude || !input.auditLongitude || !input.auditGpsAccuracy)) ||
    (input.auditLatitude && !decimalCoordinateSchema.safeParse(input.auditLatitude).success) ||
    (input.auditLongitude && !decimalCoordinateSchema.safeParse(input.auditLongitude).success) ||
    (input.auditGpsAccuracy && !decimalNonNegativeSchema.safeParse(input.auditGpsAccuracy).success)
  ) {
    return redirectToSite(request, siteId, returnTarget)
  }

  try {
    await withDatabase(async (client) => {
      const member = await requireSiteAuditorForSite(client, siteId, {
        allowAdmin: input.returnTo !== 'public',
      })
      const memberEmail = member.email?.trim().toLowerCase() ?? null

      if (input.returnTo === 'public') {
        if (!memberEmail) {
          throw new Error('Accepted audit assignment is required')
        }

        const accepted = await hasAcceptedAuditAssignment(client, {
          siteId,
          windowId: input.windowId,
          email: memberEmail,
        })

        if (!accepted) {
          throw new Error('Accepted audit assignment is required')
        }
      }

      const result = await recordAuditCheck(client, {
        windowId: input.windowId,
        auditorMemberId: member.id,
        auditedAt: input.auditedAt,
        speciesResults,
        photoUrls,
        latitude: input.auditLatitude || null,
        longitude: input.auditLongitude || null,
        gpsAccuracyM: input.auditGpsAccuracy || null,
        gpsStatus: input.gpsStatus,
        remarks: input.remarks || null,
      })

      if (input.returnTo === 'public' && memberEmail) {
        await markAuditAssignmentSubmitted(client, {
          siteId,
          windowId: input.windowId,
          auditorEmail: memberEmail,
        })
      }

      return result
    })
  } catch (error) {
    console.error('Failed to record audit check', error)
    if (
      error instanceof Error &&
      ['Registered site auditor access is required', 'Accepted audit assignment is required'].includes(error.message)
    ) {
      return redirectToSite(request, siteId, returnTarget, 'auditor_access')
    }

    return redirectToSite(request, siteId, returnTarget)
  }

  revalidatePath('/admin')
  revalidatePath(`/sites/${siteId}`)

  if (input.returnTo === 'public' && input.locationId) {
    return NextResponse.redirect(
      new URL(`/p/${encodeURIComponent(input.locationId)}?checked=1`, request.url),
      303,
    )
  }

  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&checked=1`, request.url), 303)
}

function parseAuditSpeciesRows(formData: FormData) {
  const names = formData.getAll('auditSpeciesName').map((value) => `${value}`.trim())
  const counts = formData.getAll('auditSurvivingCount').map((value) => `${value}`.trim())
  const rowCount = Math.max(names.length, counts.length)
  const rows: Array<{ speciesName: string; survivingCount: number }> = []

  for (let index = 0; index < rowCount; index += 1) {
    const speciesName = names[index] ?? ''
    const countValue = counts[index] ?? ''

    if (!speciesName && !countValue) {
      continue
    }

    const survivingCount = Number(countValue)

    if (!speciesName || !Number.isInteger(survivingCount) || survivingCount < 0) {
      return null
    }

    rows.push({ speciesName, survivingCount })
  }

  return rows.length > 0 ? rows : null
}

async function parsePhotoEvidence(
  value: string | undefined,
  fileEntry: FormDataEntryValue | null,
): Promise<string[] | null> {
  const urls = parsePhotoUrls(value)

  if (urls && urls.length > 0) {
    return urls
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return urls
  }

  if (!fileEntry.type.startsWith('image/') || fileEntry.size > 2_500_000) {
    return null
  }

  const bytes = Buffer.from(await fileEntry.arrayBuffer())
  const mimeType = normalizedImageMimeType(fileEntry.type)
  const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`

  return isValidEvidenceUrl(dataUrl) ? [dataUrl] : null
}

function parsePhotoUrls(value: string | undefined): string[] | null {
  if (!value) {
    return []
  }

  const urls = value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean)

  if (urls.length > 12) {
    return null
  }

  for (const url of urls) {
    if (!isValidEvidenceUrl(url)) {
      return null
    }
  }

  return urls
}

function hasCapturedFieldEvidence(urls: string[]): boolean {
  return urls.some((url) => url.startsWith('data:image/'))
}

function isValidEvidenceUrl(url: string): boolean {
  if (/^data:image\/(?:jpeg|jpg|png|webp|heic|heif);base64,[a-z0-9+/=]+$/i.test(url)) {
    return url.length <= 2_500_000
  }

  try {
    const parsed = new URL(url)

    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function normalizedImageMimeType(value: string): string {
  const normalized = value.toLowerCase()

  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(normalized)) {
    return normalized
  }

  return 'image/jpeg'
}

function returnTargetFromForm(rawInput: Record<string, FormDataEntryValue>): {
  returnTo: string
  locationId: string
} {
  return {
    returnTo: `${rawInput.returnTo ?? ''}`,
    locationId: `${rawInput.locationId ?? ''}`.trim(),
  }
}

function redirectToSite(
  request: Request,
  siteId: string,
  target: { returnTo: string; locationId: string },
  error = 'check',
) {
  if (target.returnTo === 'public' && target.locationId) {
    return NextResponse.redirect(
      new URL(`/p/${encodeURIComponent(target.locationId)}/check?error=${error}`, request.url),
      303,
    )
  }

  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&error=${error}`, request.url), 303)
}
