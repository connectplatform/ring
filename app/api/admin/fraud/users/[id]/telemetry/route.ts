import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getUserDeviceTelemetrySnapshots, findSharedDeviceFingerprints } from '@/features/analytics/lib/device-telemetry-db'
import { computeAbuseProbability } from '@/features/fraud/lib/compute-abuse-score'
import { db } from '@/lib/database'

/**
 * GET /api/admin/fraud/users/[id]/telemetry
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: userId } = await params

  try {
    const [snapshots, collisions, userResult] = await Promise.all([
      getUserDeviceTelemetrySnapshots(userId, { limit: 50 }),
      findSharedDeviceFingerprints({ scanLimit: 5000 }),
      db().readDoc<Record<string, unknown>>('users', userId),
    ])

    const sharedDeviceIds = collisions
      .filter((c) => c.userIds.includes(userId))
      .map((c) => c.deviceId)

    const score = computeAbuseProbability({
      snapshots,
      sharedDeviceIds,
      accountCreatedAt:
        (userResult.data?.createdAt as string | undefined) ??
        (userResult.data?.created_at as string | undefined),
    })

    return NextResponse.json({
      success: true,
      userId,
      snapshots,
      score,
      sharedDeviceIds,
    })
  } catch (error) {
    console.error('GET /api/admin/fraud/users/[id]/telemetry:', error)
    return NextResponse.json({ error: 'Failed to load telemetry' }, { status: 500 })
  }
}
