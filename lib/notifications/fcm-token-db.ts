/**
 * FCM token DB layer — server-only.
 * Single upsert implementation used by Server Action and API route.
 * Uses getDatabaseService() only; BackendSelector routes by DB_BACKEND_MODE.
 */

import { z } from 'zod'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

const DEVICE_FINGERPRINT_MAX = 128
const DEVICE_FINGERPRINT_REGEX = /^[a-zA-Z0-9\-_]+$/

export const upsertFcmTokenParamsSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  deviceFingerprint: z
    .string()
    .max(DEVICE_FINGERPRINT_MAX, `deviceFingerprint must be at most ${DEVICE_FINGERPRINT_MAX} characters`)
    .regex(DEVICE_FINGERPRINT_REGEX, 'deviceFingerprint must be alphanumeric with optional dashes and underscores'),
  deviceInfo: z.record(z.string(), z.unknown()).optional(),
  platform: z.string().optional(),
})

export type UpsertFcmTokenParams = z.infer<typeof upsertFcmTokenParamsSchema>

export type UpsertFcmTokenResult =
  | { success: true }
  | { error: string }

/**
 * Upsert FCM token for a user by (userId, deviceFingerprint).
 * Caller must supply userId from server-side auth only; never from client.
 */
export async function upsertFcmTokenForUser(
  userId: string,
  params: UpsertFcmTokenParams
): Promise<UpsertFcmTokenResult> {
  const parsed = upsertFcmTokenParamsSchema.safeParse(params)
  if (!parsed.success) {
    const first =
      (typeof parsed.error.flatten === 'function'
        ? (parsed.error.flatten() as { formErrors?: string[] }).formErrors?.[0]
        : undefined) ??
      (parsed.error.issues?.[0]?.message as string | undefined) ??
      parsed.error.message
    return { error: first ?? 'Validation failed' }
  }

  const { token, deviceFingerprint, deviceInfo, platform } = parsed.data
  const lastSeen = new Date()

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const existingResult = await db.query({
      collection: 'fcm_tokens',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'deviceFingerprint', operator: '==', value: deviceFingerprint },
      ],
    })

    if (!existingResult.success) {
      return { error: existingResult.error?.message ?? 'Failed to check existing tokens' }
    }

    const payload = {
      userId,
      token,
      deviceFingerprint,
      deviceInfo: {
        ...(deviceInfo ?? {}),
        lastSeen: (deviceInfo as { lastSeen?: unknown })?.lastSeen
          ? new Date((deviceInfo as { lastSeen: string }).lastSeen)
          : lastSeen,
      },
      isActive: true,
      status: 'active' as const,
      lastSeen,
      updatedAt: lastSeen,
    }

    if (existingResult.data.length > 0) {
      const existing = existingResult.data[0]
      const updateResult = await db.update('fcm_tokens', existing.id, payload)
      if (!updateResult.success) {
        return { error: updateResult.error?.message ?? 'Failed to update FCM token' }
      }
    } else {
      const createResult = await db.create('fcm_tokens', {
        ...payload,
        createdAt: lastSeen,
      })
      if (!createResult.success) {
        return { error: createResult.error?.message ?? 'Failed to create FCM token' }
      }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register FCM token'
    return { error: message }
  }
}
