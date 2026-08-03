/**
 * Cron Job: Rotate aged per-order Forgejo Source Editor PATs.
 *
 * ProcessConductor pipeline: forgejo-token-rotate
 * Schedule: monthly (1st of month) — vercel.json + external CronJob / Admin Processes manual run.
 * Env: FORGEJO_TOKEN_ROTATE_MAX_AGE_DAYS (default 30), FORGEJO_TOKEN_ROTATE_LIMIT (default 50).
 */
import { NextRequest, NextResponse, connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const handler = getPipelineDefinition('forgejo-token-rotate')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun(
      'forgejo-token-rotate',
      'cron',
      handler,
    )
    if (run.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: run.error,
          runId: run.id,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
