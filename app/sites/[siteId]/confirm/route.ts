import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlantationMember } from '@/lib/auth-member'
import { withDatabase } from '@/lib/db'
import { confirmPlantationCounts } from '@/lib/plantation-registration'

const confirmSchema = z.object({
  monitoringStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const formData = await request.formData()
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData))

  if (!z.string().uuid().safeParse(siteId).success || !parsed.success) {
    return redirectToSite(request, siteId, 'confirm')
  }

  try {
    await withDatabase(async (client) => {
      const member = await requirePlantationMember(client, ['admin'])

      return confirmPlantationCounts(client, {
        siteId,
        monitoringStart: parsed.data.monitoringStart,
        actor: member.id,
      })
    })
  } catch (error) {
    console.error('Failed to confirm planting counts', error)
    return redirectToSite(request, siteId, 'confirm')
  }

  revalidatePath('/admin')
  revalidatePath(`/sites/${siteId}`)

  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&confirmed=1`, request.url), 303)
}

function redirectToSite(request: Request, siteId: string, error: string) {
  return NextResponse.redirect(new URL(`/sites/${siteId}?console=1&error=${error}`, request.url), 303)
}
