import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  deviceTelemetryBodySchema,
  extractTelemetryServerContext,
  upsertUserDeviceTelemetry,
} from '@/features/analytics/lib/device-telemetry-db'
import { publishToUserTunnel } from '@/lib/tunnel/publisher'
import { telemetryChannelForDomain } from '@/lib/tunnel/realtime-data-types'

/**
 * POST /api/tunnel/telemetry
 * Tunnel-aligned ingest — delegates to Ring Analytics device-telemetry-db (upsert).
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = deviceTelemetryBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid telemetry payload', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const userId = session.user.id
    const serverContext = extractTelemetryServerContext(request)
    const { success, skipped, docId } = await upsertUserDeviceTelemetry(
      userId,
      parsed.data,
      serverContext,
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to persist telemetry' }, { status: 500 })
    }

    const { domain, deviceId, ts, payload } = parsed.data
    await publishToUserTunnel(userId, telemetryChannelForDomain(domain), {
      domain,
      deviceId,
      ts: ts ?? Date.now(),
      payload,
    })

    return NextResponse.json({
      success: true,
      docId,
      domain,
      deviceId,
      ts: ts ?? Date.now(),
      storageSkipped: skipped,
    })
  } catch (error) {
    console.error('POST /api/tunnel/telemetry failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Telemetry ingest failed' },
      { status: 500 },
    )
  }
}
