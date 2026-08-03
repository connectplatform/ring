/**
 * Cron: sweep orphan Forgejo order-src-* robots.
 * Auth: Authorization: Bearer $CRON_SECRET (fail-closed when secret set).
 * Query: ?dryRun=1 to classify without deleting.
 */
import { NextRequest, NextResponse, connection } from 'next/server'
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

    const result = await runForgejoRobotGc({ dryRun })
    return NextResponse.json({
      ...result,
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
