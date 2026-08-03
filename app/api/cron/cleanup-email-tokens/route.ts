/**
 * Cron Job: Cleanup Expired Email Login Tokens
 *
 * Deletes email_login_tokens rows past expires_at + 24h grace
 * (see cleanupExpiredEmailTokens).
 *
 * Schedule: daily (or hourly). Hit with Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Fail-closed: require CRON_SECRET (aligned with email-processor)
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const handler = getPipelineDefinition('cleanup-email-tokens')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun(
      'cleanup-email-tokens',
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

    const payload = result as { cleaned?: number; duration?: number }
    console.log(
      `Cron: Cleaned ${payload.cleaned ?? 0} expired email login tokens in ${payload.duration ?? 0}ms`,
    )

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron: Email login token cleanup failed:', error)
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
