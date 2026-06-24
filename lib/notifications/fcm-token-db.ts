/**
 * FCM token DB layer — server-only.
 * Single upsert implementation used by Server Action and API route.
 * Uses db().*Doc methods; BackendSelector routes by DB_BACKEND_MODE.
 */

import { z } from 'zod'
import { db } from '@/lib/database'

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

type FcmTokenRow = Record<string, unknown> & { id: string }

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
    const existingResult = await db().queryDocs<FcmTokenRow>({
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
      ...(platform ? { platform } : {}),
      deviceInfo: {
        ...(deviceInfo ?? {}),
        platform: platform ?? (deviceInfo as { platform?: string })?.platform ?? 'web',
        lastSeen: (deviceInfo as { lastSeen?: unknown })?.lastSeen
          ? new Date((deviceInfo as { lastSeen: string }).lastSeen)
          : lastSeen,
      },
      isActive: true,
      status: 'active' as const,
      lastSeen,
      updatedAt: lastSeen,
      invalidatedAt: null,
    }

    if (existingResult.data.length > 0) {
      const existing = existingResult.data[0]
      const updateResult = await db().updateDoc('fcm_tokens', existing.id, payload)
      if (!updateResult.success) {
        return { error: updateResult.error?.message ?? 'Failed to update FCM token' }
      }
    } else {
      const createResult = await db().createDoc('fcm_tokens', {
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

const unregisterParamsSchema = z.object({
  deviceFingerprint: z
    .string()
    .max(DEVICE_FINGERPRINT_MAX)
    .regex(DEVICE_FINGERPRINT_REGEX)
    .optional(),
  token: z.string().min(1).optional(),
}).refine((v) => Boolean(v.deviceFingerprint || v.token), {
  message: 'deviceFingerprint or token is required',
})

export type UnregisterFcmTokenParams = z.infer<typeof unregisterParamsSchema>

/**
 * Unregister FCM token for a user (logout). Prefer deviceFingerprint; token is fallback.
 */
export async function unregisterFcmTokenForUser(
  userId: string,
  params: UnregisterFcmTokenParams,
): Promise<UpsertFcmTokenResult> {
  const parsed = unregisterParamsSchema.safeParse(params)
  if (!parsed.success) {
    const first = parsed.error.issues?.[0]?.message ?? 'Validation failed'
    return { error: first }
  }

  const { deviceFingerprint, token } = parsed.data
  const now = new Date()

  try {
    const filters =
      deviceFingerprint != null
        ? [
            { field: 'userId', operator: '==' as const, value: userId },
            { field: 'deviceFingerprint', operator: '==' as const, value: deviceFingerprint },
          ]
        : [
            { field: 'userId', operator: '==' as const, value: userId },
            { field: 'token', operator: '==' as const, value: token! },
          ]

    const existingResult = await db().queryDocs<FcmTokenRow>({
      collection: 'fcm_tokens',
      filters,
    })

    if (!existingResult.success) {
      return { error: existingResult.error?.message ?? 'Failed to find FCM token' }
    }

    if (existingResult.data.length === 0) {
      return { success: true }
    }

    for (const row of existingResult.data) {
      const updateResult = await db().updateDoc('fcm_tokens', row.id, {
        isActive: false,
        status: 'invalid',
        invalidatedAt: now,
        updatedAt: now,
      })
      if (!updateResult.success) {
        return { error: updateResult.error?.message ?? 'Failed to unregister FCM token' }
      }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unregister FCM token'
    return { error: message }
  }
}
