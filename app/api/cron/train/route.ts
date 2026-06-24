import { NextRequest, NextResponse } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'


export async function POST(req: NextRequest) {
  // Fail closed: same contract as /api/cron/refcodes-mint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const handler = getPipelineDefinition('train')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('train', 'cron', handler)
    if (run.status === 'error') {
      return NextResponse.json({ ok: false, error: run.error, runId: run.id }, { status: 500 })
    }

    return NextResponse.json({ ...(result as object), runId: run.id })
  } catch (e) {
    console.error('cron/train error', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}


