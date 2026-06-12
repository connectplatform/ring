import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { EmailAnalyticsService } from '@/features/email-crm/services/email-analytics-service'

export async function POST(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = await EmailAnalyticsService.getDashboard('7d')
  return NextResponse.json({ success: true, summary })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
