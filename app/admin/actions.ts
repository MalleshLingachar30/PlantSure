'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  confirmPlantationCounts,
  createPlantationProgram,
  createPlantationSite,
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
  latitude: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  longitude: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  plantedCount: z.coerce.number().int().positive(),
  plantingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  plantingPhotoUrls: z.string().trim().optional(),
  speciesNotes: z.string().trim().optional(),
})

const confirmSchema = z.object({
  siteId: z.string().uuid(),
  monitoringStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function registerPilotSite(formData: FormData): Promise<void> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    redirect('/admin?error=registration')
  }

  const input = parsed.data
  const geography = getKarnatakaGeographyByKey(input.geographyKey)
  const plantingPhotoUrls = parsePhotoUrls(input.plantingPhotoUrls)

  if (!geography || !plantingPhotoUrls) {
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
      latitude: input.latitude,
      longitude: input.longitude,
      plantedCount: input.plantedCount,
      plantingDate: input.plantingDate,
      plantingPhotoUrls,
      speciesNotes: input.speciesNotes || null,
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
