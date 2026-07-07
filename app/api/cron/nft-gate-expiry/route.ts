/**
 * Cron Job: NFT Gate Expiry
 *
 * Checks NFT ownership for nft_gate subscribers. Phase S7 — TBD.
 *
 * Vercel Cron:
 * { "path": "/api/cron/nft-gate-expiry", "schedule": "0 4 * * *" }
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
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const handler = getPipelineDefinition('nft-gate-expiry')?.handler
    if (!handler) return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    const { result, run } = await ProcessConductor.recordRun('nft-gate-expiry', 'cron', handler)
    if (run.status === 'error') {
      return NextResponse.json({ success: false, error: run.error, runId: run.id, timestamp: new Date().toISOString() }, { status: 500 })
    }
    return NextResponse.json({ ...(result as object), runId: run.id, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() }, { status: 500 })
  }
}
