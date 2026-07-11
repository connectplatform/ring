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
 * POST /api/analytics/device
 * HTTP ingest endpoint for device telemetry events.
 * Accepts telemetry submissions from authorized users,
 * validates payload, persists telemetry, and fans out
 * to user tunnel channel if possible.
 */
export async function POST(request: NextRequest) {
  // Establish DB connection for each request. (Could be optimized if supported by framework)
  await connection()

  try {
    // Authenticate user session. Reject request if unauthenticated.
    const session = await auth()
    if (!session?.user?.id) {
      // If user is not authenticated, respond with 401 Unauthorized.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse incoming JSON body from the request.
    // TODO: Consider implementing streaming body parsing if body can be large (supported in Next.js 13+ edge API routes).
    const raw = await request.json()

    // Validate the payload against the telemetry schema.
    // If invalid, return details in 400 response.
    const parsed = deviceTelemetryBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid device telemetry payload', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // Extract userId and server context for telemetry record (e.g., IP, userAgent).
    const userId = session.user.id
    const serverContext = extractTelemetryServerContext(request)

    // Persist or upsert device telemetry for this user/device/payload.
    // Returns: success (boolean if write was ok), skipped (if change was already present), docId (database id)
    const { success, skipped, docId } = await upsertUserDeviceTelemetry(
      userId,
      parsed.data,
      serverContext,
    )

    // If DB write/upsert fails, respond with 500.
    if (!success) {
      return NextResponse.json({ error: 'Failed to persist telemetry' }, { status: 500 })
    }

    // Fan-out only when persistence actually changed — avoids offline-queue flooding during reload bursts.
    if (!skipped) {
      const { domain, deviceId, ts, payload } = parsed.data
      await publishToUserTunnel(userId, telemetryChannelForDomain(domain), {
        domain,
        deviceId,
        ts: ts ?? Date.now(),
        payload,
      }).catch(() => {
        // Fan-out is best-effort when no live tunnel session; intentionally ignore failure here
      })
    }

    // Respond with success, returning persistent id and whether DB write was skipped.
    return NextResponse.json({ success: true, docId, storageSkipped: skipped })
  } catch (error) {
    // Log & mask errors for security; send generic error message.
    console.error('POST /api/analytics/device failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Device telemetry ingest failed' },
      { status: 500 },
    )
  }
}
