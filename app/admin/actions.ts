'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  type BoundaryPointInput,
  confirmPlantationCounts,
  createPlantationProgram,
  createPlantationSite,
  type CreateSiteSpeciesInput,
  recordStageEvidenceAndAdvance,
} from '@/lib/plantation-registration'
import { recordAuditCheck } from '@/lib/plantation-checks'
import { requireAdminMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import { getKarnatakaGeographyByKey } from '@/lib/karnataka-geography'

const registrationSchema = z.object({
  programName: z.string().trim().min(2),
  escalationEmail: z.string().trim().email(),
  siteName: z.string().trim().min(2),
  geographyKey: z.string().trim().min(2),
  village: z.string().trim().min(2),
  plantingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  plantingPhotoUrls: z.string().trim().optional(),
  landOwnership: z.enum(['government', 'private', 'institutional', 'other']),
  landCustodian: z.string().trim().optional(),
  approvalReference: z.string().trim().optional(),
  isSharedParcel: z.coerce.boolean().optional(),
  watchAndWard: z.coerce.boolean().optional(),
  plantationType: z.enum(['block', 'bund_only', 'bund_and_block']),
})

const confirmSchema = z.object({
  siteId: z.string().uuid(),
  monitoringStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const stageEvidenceSchema = z.object({
  siteId: z.string().uuid(),
  stage: z.enum(['pits_dug', 'planted']),
  capturedAt: z.string().trim().min(1),
  evidencePhotoUrls: z.string().trim().min(1),
  evidenceLatitude: z.string().trim().optional(),
  evidenceLongitude: z.string().trim().optional(),
  gpsAccuracy: z.string().trim().optional(),
  caption: z.string().trim().optional(),
})

const auditCheckSchema = z.object({
  siteId: z.string().uuid(),
  windowId: z.string().uuid(),
  auditedAt: z.string().trim().min(1),
  auditPhotoUrls: z.string().trim().min(1),
  auditLatitude: z.string().trim().optional(),
  auditLongitude: z.string().trim().optional(),
  auditGpsAccuracy: z.string().trim().optional(),
  gpsStatus: z.enum(['confirmed', 'plausible', 'questionable', 'unavailable']),
  remarks: z.string().trim().optional(),
})

export async function registerPilotSite(formData: FormData): Promise<void> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    redirect('/admin?error=registration')
  }

  const input = parsed.data
  const geography = getKarnatakaGeographyByKey(input.geographyKey)
  const plantingPhotoUrls = parsePhotoUrls(input.plantingPhotoUrls)
  const species = parseSpeciesRows(formData)
  const boundaryPoints = parseBoundaryPoints(formData)

  if (!geography || !plantingPhotoUrls || !species || !boundaryPoints) {
    redirect('/admin?error=registration')
  }

  const site = await withDatabase(async (client) => {
    const member = await requireAdminMember(client)
    const program = await createPlantationProgram(client, {
      organizationId: randomUUID(),
      name: input.programName,
      escalationEmail: input.escalationEmail,
    })

    return createPlantationSite(client, {
      programId: program.id,
      stateCode: geography.stateCode,
      districtCode: geography.districtCode,
      villageCode: geography.talukCode,
      name: input.siteName,
      district: geography.district,
      taluk: geography.taluk,
      village: input.village,
      plantingDate: input.plantingDate,
      plantingPhotoUrls,
      species,
      landOwnership: input.landOwnership,
      landCustodian: input.landCustodian || null,
      approvalReference: input.approvalReference || null,
      isSharedParcel: input.isSharedParcel ?? false,
      watchAndWard: input.watchAndWard ?? false,
      boundaryPoints,
      plantationType: input.plantationType,
      createdByMemberId: member.id,
    })
  })

  revalidatePath('/admin')
  redirect(`/sites/${site.id}`)
}

export async function confirmSiteCounts(formData: FormData): Promise<void> {
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    redirect('/admin?error=confirm')
  }

  await withDatabase(async (client) => {
    await requireAdminMember(client)

    return confirmPlantationCounts(client, {
      siteId: parsed.data.siteId,
      monitoringStart: parsed.data.monitoringStart,
    })
  })

  revalidatePath('/admin')
  revalidatePath(`/sites/${parsed.data.siteId}`)
  redirect(`/sites/${parsed.data.siteId}?confirmed=1`)
}

export async function captureStageEvidence(formData: FormData): Promise<void> {
  const parsed = stageEvidenceSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    redirect('/admin?error=stage')
  }

  const input = parsed.data
  const photoUrls = parsePhotoUrls(input.evidencePhotoUrls)

  if (!photoUrls || photoUrls.length === 0) {
    redirect(`/sites/${input.siteId}?error=stage`)
  }

  if (
    (input.evidenceLatitude && !decimalCoordinateSchema.safeParse(input.evidenceLatitude).success) ||
    (input.evidenceLongitude && !decimalCoordinateSchema.safeParse(input.evidenceLongitude).success)
  ) {
    redirect(`/sites/${input.siteId}?error=stage`)
  }

  await withDatabase(async (client) => {
    const member = await requireAdminMember(client)

    return recordStageEvidenceAndAdvance(client, {
      siteId: input.siteId,
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

  revalidatePath(`/sites/${input.siteId}`)
  redirect(`/sites/${input.siteId}?stage=${input.stage}`)
}

export async function recordAuditWindowCheck(formData: FormData): Promise<void> {
  const parsed = auditCheckSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    redirect('/admin?error=check')
  }

  const input = parsed.data
  const photoUrls = parsePhotoUrls(input.auditPhotoUrls)
  const speciesResults = parseAuditSpeciesRows(formData)

  if (!photoUrls || photoUrls.length === 0 || !speciesResults) {
    redirect(`/sites/${input.siteId}?error=check`)
  }

  if (
    (input.auditLatitude && !decimalCoordinateSchema.safeParse(input.auditLatitude).success) ||
    (input.auditLongitude && !decimalCoordinateSchema.safeParse(input.auditLongitude).success)
  ) {
    redirect(`/sites/${input.siteId}?error=check`)
  }

  await withDatabase(async (client) => {
    const member = await requireAdminMember(client)

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

  revalidatePath(`/sites/${input.siteId}`)
  revalidatePath('/admin')
  redirect(`/sites/${input.siteId}?checked=1`)
}

function parseSpeciesRows(formData: FormData): CreateSiteSpeciesInput[] | null {
  const names = formData.getAll('speciesName').map((value) => `${value}`.trim())
  const counts = formData.getAll('speciesCount').map((value) => `${value}`.trim())
  const placements = formData.getAll('speciesPlacement').map((value) => `${value}`.trim())
  const rowCount = Math.max(names.length, counts.length, placements.length)
  const rows: CreateSiteSpeciesInput[] = []

  for (let index = 0; index < rowCount; index += 1) {
    const speciesName = names[index] ?? ''
    const countValue = counts[index] ?? ''
    const placement = placements[index] ?? ''

    if (!speciesName && !countValue && !placement) {
      continue
    }

    const plantedCount = Number(countValue)

    if (!speciesName || !Number.isInteger(plantedCount) || plantedCount <= 0) {
      return null
    }

    rows.push({
      speciesName,
      plantedCount,
      placement: placement || null,
    })
  }

  return rows.length > 0 ? rows : null
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

function parseBoundaryPoints(formData: FormData): BoundaryPointInput[] | null {
  const latitudes = formData.getAll('boundaryLatitude').map((value) => `${value}`.trim())
  const longitudes = formData.getAll('boundaryLongitude').map((value) => `${value}`.trim())
  const rowCount = Math.max(latitudes.length, longitudes.length)
  const rows: BoundaryPointInput[] = []

  for (let index = 0; index < rowCount; index += 1) {
    const latitude = latitudes[index] ?? ''
    const longitude = longitudes[index] ?? ''

    if (!latitude && !longitude) {
      continue
    }

    if (!decimalCoordinateSchema.safeParse(latitude).success || !decimalCoordinateSchema.safeParse(longitude).success) {
      return null
    }

    rows.push({ latitude, longitude })
  }

  return rows.length >= 3 ? rows : null
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

const decimalCoordinateSchema = z.string().trim().regex(/^-?\d+(\.\d+)?$/)
