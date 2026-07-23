'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  type BoundaryPointInput,
  createPlantationProgram,
  createPlantationSite,
  type CreateSiteSpeciesInput,
} from '@/lib/plantation-registration'
import {
  findOrCreatePlantingOrganization,
  findOrCreateScientificAdvisor,
} from '@/lib/plantation-directory'
import { requireAdminMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import { getKarnatakaGeographyByKey } from '@/lib/karnataka-geography'

const registrationSchema = z.object({
  programName: z.string().trim().min(2),
  escalationEmail: z.string().trim().email(),
  scientificAdvisorId: z.string().uuid().optional().or(z.literal('')),
  scientificAdvisorName: z.string().trim().optional(),
  scientificAdvisorType: z.enum([
    'scientific_institute',
    'forest_department',
    'university',
    'independent',
    'other',
  ]).optional(),
  scientificAdvisorContactName: z.string().trim().optional(),
  scientificAdvisorContactEmail: z.string().trim().email().optional().or(z.literal('')),
  scientificAdvisorContactPhone: z.string().trim().optional(),
  organizationId: z.string().uuid().optional().or(z.literal('')),
  organizationName: z.string().trim().optional(),
  organizationType: z.enum([
    'institution',
    'corporate',
    'foundation',
    'government',
    'community',
    'other',
  ]).optional(),
  organizationContactName: z.string().trim().optional(),
  organizationContactEmail: z.string().trim().email().optional().or(z.literal('')),
  organizationContactPhone: z.string().trim().optional(),
  ownerApproverName: z.string().trim().optional(),
  ownerApproverEmail: z.string().trim().email().optional().or(z.literal('')),
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

  const needsNewAdvisor = !input.scientificAdvisorId
  const needsNewOrganization = !input.organizationId

  if (
    !geography ||
    !plantingPhotoUrls ||
    !species ||
    !boundaryPoints ||
    (needsNewAdvisor && !input.scientificAdvisorName?.trim()) ||
    (needsNewOrganization &&
      (!input.organizationName?.trim() || !input.ownerApproverEmail?.trim()))
  ) {
    redirect('/admin?error=registration')
  }

  let site

  try {
    site = await withDatabase(async (client) => {
      const member = await requireAdminMember(client)
      const scientificAdvisorId = input.scientificAdvisorId
        ? input.scientificAdvisorId
        : (
            await findOrCreateScientificAdvisor(client, {
              name: requiredValue(input.scientificAdvisorName),
              advisorType: input.scientificAdvisorType ?? 'scientific_institute',
              contactName: input.scientificAdvisorContactName || null,
              contactEmail: input.scientificAdvisorContactEmail || null,
              contactPhone: input.scientificAdvisorContactPhone || null,
            })
          ).id
      const organizationId = input.organizationId
        ? input.organizationId
        : (
            await findOrCreatePlantingOrganization(client, {
              name: requiredValue(input.organizationName),
              organizationType: input.organizationType ?? 'other',
              scientificAdvisorId,
              primaryContactName: input.organizationContactName || null,
              primaryContactEmail: input.organizationContactEmail || null,
              primaryContactPhone: input.organizationContactPhone || null,
              ownerApproverName: input.ownerApproverName || null,
              ownerApproverEmail: requiredValue(input.ownerApproverEmail),
            })
          ).id
      const program = await createPlantationProgram(client, {
        organizationId,
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
  } catch {
    redirect('/admin?error=registration')
  }

  revalidatePath('/admin')
  redirect(`/sites/${site.id}`)
}

function requiredValue(value: string | undefined): string {
  const trimmed = value?.trim()

  if (!trimmed) {
    throw new Error('Missing required registration value')
  }

  return trimmed
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
