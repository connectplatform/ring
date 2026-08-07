/**
 * Cron: detect inventory_levels vs store_products.stock drift.
 * Fail-closed: requires CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const handler = getPipelineDefinition('inventory-drift')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('inventory-drift', 'cron', handler)
    if (run.status === 'error') {
      return NextResponse.json(
        { success: false, error: run.error, runId: run.id, timestamp: new Date().toISOString() },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron: inventory drift failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
