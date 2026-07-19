import { NextResponse } from 'next/server'
import { markMissedAuditWindows } from '@/lib/plantation-checks'
import { hasDatabaseUrl, withDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 503 })
  }

  const secret = process.env.CRON_SECRET

  if (secret) {
    const authorization = request.headers.get('authorization')

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await withDatabase((client) => markMissedAuditWindows(client))

  return NextResponse.json({
    ok: true,
    ...result,
  })
}
