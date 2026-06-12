import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailAnalyticsService } from '@/features/email-crm/services/email-analytics-service'

export async function GET(req: NextRequest) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const range = (url.searchParams.get('range') ?? '7d') as '7d' | '30d' | '90d'
  const analytics = await EmailAnalyticsService.getDashboard(range)
  return NextResponse.json(analytics)
}
