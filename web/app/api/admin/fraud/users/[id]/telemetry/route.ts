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
  // Ensure DB connection is established before proceeding.
  await connection()

  // Authenticate the session (middleware). Only proceed for platform admins.
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    // If there is no session or the user is not a platform admin, return 401.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract userId from params. 'params' is a promise (async route params).
  // TODO: Use Next.js 16 route segment configs for param typing once available.
  const { id: userId } = await params

  try {
    // Fetch:
    // - recent device telemetry snapshots for the user (limit 50),
    // - shared device fingerprints across all users (limit scan to 5000),
    // - user record from database,
    // all concurrently for efficiency.
    const [snapshots, collisions, userResult] = await Promise.all([
      getUserDeviceTelemetrySnapshots(userId, { limit: 50 }),
      findSharedDeviceFingerprints({ scanLimit: 5000 }),
      db().readDoc<Record<string, unknown>>('users', userId),
    ])

    // Filter collisions to include only devices shared by this user
    // and collect their device IDs.
    const sharedDeviceIds = collisions
      .filter((c) => c.userIds.includes(userId))
      .map((c) => c.deviceId)

    // Compute a fraud/abuse probability score
    // Uses snapshots, shared device IDs, and user's account creation date
    const score = computeAbuseProbability({
      snapshots,
      sharedDeviceIds,
      accountCreatedAt:
        (userResult.data?.createdAt as string | undefined) ??
        (userResult.data?.created_at as string | undefined), // Support both camelCase and snake_case
    })

    // Return all gathered and computed data as JSON
    return NextResponse.json({
      success: true,
      userId,
      snapshots,
      score,
      sharedDeviceIds,
    })
  } catch (error) {
    // Log the error server-side and return generic failure message
    console.error('GET /api/admin/fraud/users/[id]/telemetry:', error)
    return NextResponse.json({ error: 'Failed to load telemetry' }, { status: 500 })
  }
}
