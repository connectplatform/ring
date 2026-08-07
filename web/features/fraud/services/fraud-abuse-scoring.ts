import 'server-only'

import { db } from '@/lib/database'
import {
  findSharedDeviceFingerprints,
  getUserDeviceTelemetrySnapshots,
} from '@/features/analytics/lib/device-telemetry-db'
import { computeAbuseProbability } from '@/features/fraud/lib/compute-abuse-score'
import type { AbuseCandidate } from '@/features/fraud/types/abuse-candidate'
import { normalizeAccountStatus } from '@/features/auth/lib/account-status'

export interface ListAbuseCandidatesOptions {
  limit?: number
  minScore?: number
}

function buildSharedDeviceMap(
  collisions: Awaited<ReturnType<typeof findSharedDeviceFingerprints>>,
): Map<string, string[]> {
  const userToDevices = new Map<string, string[]>()
  for (const c of collisions) {
    for (const userId of c.userIds) {
      const list = userToDevices.get(userId) ?? []
      if (!list.includes(c.deviceId)) {
        list.push(c.deviceId)
      }
      userToDevices.set(userId, list)
    }
  }
  return userToDevices
}

export async function listAbuseCandidates(
  options: ListAbuseCandidatesOptions = {},
): Promise<AbuseCandidate[]> {
  const limit = options.limit ?? 50
  const minScore = options.minScore ?? 1

  const [collisions, usersResult, telemetryScan] = await Promise.all([
    findSharedDeviceFingerprints({ scanLimit: 5000 }),
    db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 500 },
    }),
    db().queryDocs<Record<string, unknown>>({
      collection: 'user_device_telemetry',
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit: 3000 },
    }),
  ])

  const sharedByUser = buildSharedDeviceMap(collisions)
  const telemetryUserIds = new Set<string>()
  if (telemetryScan.success && telemetryScan.data) {
    for (const row of telemetryScan.data) {
      const uid = String(row.userId ?? '')
      if (uid) telemetryUserIds.add(uid)
    }
  }

  const candidateUserIds = new Set<string>([...sharedByUser.keys(), ...telemetryUserIds])

  const users = usersResult.success && usersResult.data ? usersResult.data : []
  for (const row of users) {
    const status = normalizeAccountStatus(
      (row.account_status as string | undefined) ?? (row.accountStatus as string | undefined),
    )
    if (status === 'ACTIVE') {
      candidateUserIds.add(String(row.id))
    }
  }

  const userById = new Map(users.map((u) => [String(u.id), u]))
  const scored: AbuseCandidate[] = []

  for (const userId of candidateUserIds) {
    const userRow = userById.get(userId)
    const status = normalizeAccountStatus(
      (userRow?.account_status as string | undefined) ??
        (userRow?.accountStatus as string | undefined),
    )
    if (status !== 'ACTIVE') continue

    const snapshots = await getUserDeviceTelemetrySnapshots(userId, { limit: 50 })
    const sharedDeviceIds = sharedByUser.get(userId) ?? []
    const { score, level, signals } = computeAbuseProbability({
      snapshots,
      sharedDeviceIds,
      accountCreatedAt:
        (userRow?.createdAt as string | undefined) ??
        (userRow?.created_at as string | undefined),
    })

    if (score < minScore) continue

    const deviceIds = new Set(snapshots.map((s) => String(s.deviceId ?? '')).filter(Boolean))
    const lastTelemetryAt = snapshots[0]
      ? String(snapshots[0].updated_at ?? snapshots[0].ts ?? '')
      : undefined

    scored.push({
      userId,
      email: userRow?.email as string | undefined,
      name: (userRow?.name as string | null | undefined) ?? null,
      accountStatus: status,
      createdAt:
        (userRow?.createdAt as string | undefined) ??
        (userRow?.created_at as string | undefined),
      score,
      level,
      signals,
      deviceCount: deviceIds.size,
      lastTelemetryAt,
      sharedDeviceIds: sharedDeviceIds.length ? sharedDeviceIds : undefined,
    })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.sharedDeviceIds?.length ?? 0) - (a.sharedDeviceIds?.length ?? 0)
  })

  return scored.slice(0, limit)
}
