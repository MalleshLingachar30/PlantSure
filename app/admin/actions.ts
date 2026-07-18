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

const registrationSchema = z.object({
  programName: z.string().trim().min(2),
  escalationEmail: z.string().trim().email(),
  siteName: z.string().trim().min(2),
  district: z.string().trim().min(2),
  taluk: z.string().trim().min(2),
  village: z.string().trim().min(2),
  districtCode: z.string().trim().length(3),
  villageCode: z.string().trim().length(3),
  latitude: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  longitude: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  plantedCount: z.coerce.number().int().positive(),
  plantingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  const site = await withDatabase(async (client) => {
    const member = await requireAdminMember(client)
    const program = await createPlantationProgram(client, {
      organizationId: randomUUID(),
      name: input.programName,
      escalationEmail: input.escalationEmail,
    })

    return createPlantationSite(client, {
      programId: program.id,
      stateCode: 'KA',
      districtCode: input.districtCode,
      villageCode: input.villageCode,
      name: input.siteName,
      district: input.district,
      taluk: input.taluk,
      village: input.village,
      latitude: input.latitude,
      longitude: input.longitude,
      plantedCount: input.plantedCount,
      plantingDate: input.plantingDate,
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
