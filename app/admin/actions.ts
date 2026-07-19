'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  type BoundaryPointInput,
  createPlantationProgram,
  createPlantationSite,
  type CreateSiteSpeciesInput,
} from '@/lib/plantation-registration'
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
