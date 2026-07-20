import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlantationMember } from '@/lib/auth-member'
import { recordAuditCheck } from '@/lib/plantation-checks'
import { withDatabase } from '@/lib/db'

const auditCheckSchema = z.object({
  windowId: z.string().uuid(),
  auditedAt: z.string().trim().min(1),
  auditPhotoUrls: z.string().trim().min(1),
  auditLatitude: z.string().trim().optional(),
  auditLongitude: z.string().trim().optional(),
  auditGpsAccuracy: z.string().trim().optional(),
  gpsStatus: z.enum(['confirmed', 'plausible', 'questionable', 'unavailable']),
  remarks: z.string().trim().optional(),
})

const decimalCoordinateSchema = z.string().trim().regex(/^-?\d+(\.\d+)?$/)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = auditCheckSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId)
  }

  const input = parsed.data
  const photoUrls = parsePhotoUrls(input.auditPhotoUrls)
  const speciesResults = parseAuditSpeciesRows(formData)

  if (
    !photoUrls ||
    photoUrls.length === 0 ||
    !speciesResults ||
    (input.auditLatitude && !decimalCoordinateSchema.safeParse(input.auditLatitude).success) ||
    (input.auditLongitude && !decimalCoordinateSchema.safeParse(input.auditLongitude).success)
  ) {
    return redirectToSite(request, siteId)
  }

  try {
    await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['admin', 'auditor'])

      return recordAuditCheck(client, {
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
    })
  } catch {
    return redirectToSite(request, siteId)
  }

  revalidatePath('/admin')
  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(new URL(`/sites/${siteId}?checked=1`, request.url), 303)
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
  return NextResponse.redirect(new URL(`/sites/${siteId}?error=check`, request.url), 303)
}
