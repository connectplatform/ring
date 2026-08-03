/**
 * Cron Job: Sweep orphan Forgejo order-src-* robots.
 *
 * ProcessConductor pipeline: forgejo-robot-gc
 * Schedule: weekly (ops / external CronJob) — see admin processes locale.
 * Query: ?dryRun=1 classifies without deleting (bypasses recordRun).
 */
import { NextRequest, NextResponse, connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'
import { runForgejoRobotGc } from '@/features/crm/lab/forgejo-robot-gc-service'

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dryRun =
      request.nextUrl.searchParams.get('dryRun') === '1' ||
      request.nextUrl.searchParams.get('dry_run') === '1'

    // Dry-run is ops probe only — do not pollute process_runs history
    if (dryRun) {
      const result = await runForgejoRobotGc({ dryRun: true })
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString(),
      })
    }

    const handler = getPipelineDefinition('forgejo-robot-gc')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun(
      'forgejo-robot-gc',
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
