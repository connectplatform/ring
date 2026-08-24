import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'
import { runEmailCrmOsint } from '@/features/email-crm/services/email-osint-service'

function readForce(request: NextRequest): boolean {
  const q = request.nextUrl.searchParams.get('force')
  return q === '1' || q === 'true'
}

export async function POST(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const handler = getPipelineDefinition('email-crm-osint')?.handler
  if (!handler) {
    return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
  }

  const force = readForce(request)
  const { result, run } = await ProcessConductor.recordRun('email-crm-osint', 'cron', () =>
    runEmailCrmOsint({ limit: 20, force })
  )

  if (run.status === 'error') {
    return NextResponse.json({ success: false, error: run.error, runId: run.id }, { status: 500 })
  }

  return NextResponse.json({ success: true, summary: result, runId: run.id })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
