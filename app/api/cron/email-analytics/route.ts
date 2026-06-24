import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function POST(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const handler = getPipelineDefinition('email-analytics')?.handler
  if (!handler) {
    return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
  }

  const { result, run } = await ProcessConductor.recordRun('email-analytics', 'cron', handler)
  if (run.status === 'error') {
    return NextResponse.json({ success: false, error: run.error, runId: run.id }, { status: 500 })
  }

  return NextResponse.json({ success: true, summary: result, runId: run.id })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
