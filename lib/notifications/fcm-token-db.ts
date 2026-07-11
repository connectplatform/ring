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

export function isFcmSchemaMismatch(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('column "data" does not exist') ||
    message.includes('relation "fcm_tokens" does not exist')
  )
}

export type FcmTokenDeviceSummary = {
  platform: string
  browser: string
  lastSeen: Date
  createdAt: Date
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  }
  return new Date()
}

export function summarizeFcmTokenDevices(tokens: FcmTokenRow[]): FcmTokenDeviceSummary[] {
  return tokens.map((doc) => {
    const deviceInfo = doc.deviceInfo as Record<string, unknown> | undefined
    return {
      platform: (deviceInfo?.platform as string) || (doc.platform as string) || 'Unknown',
      browser: (deviceInfo?.browser as string) || (doc.browser as string) || 'Unknown',
      lastSeen: toDate(deviceInfo?.lastSeen ?? doc.lastSeen),
      createdAt: toDate(doc.createdAt),
    }
  })
}

export type ListActiveFcmTokensResult =
  | { success: true; tokens: FcmTokenRow[]; schemaReady: true }
  | { success: true; tokens: []; schemaReady: false; warning: string }

/**
 * List active FCM tokens for a user (count route, admin dashboards).
 * Returns schemaReady:false when legacy relational fcm_tokens table is still in use.
 */
export async function listActiveFcmTokensForUser(
  userId: string,
): Promise<ListActiveFcmTokensResult> {
  try {
    const result = await db().queryDocs<FcmTokenRow>({
      collection: 'fcm_tokens',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'isActive', operator: '==', value: true },
      ],
    })

    if (!result.success) {
      const msg = result.error?.message ?? 'Failed to fetch fcm_tokens'
      if (isFcmSchemaMismatch(msg)) {
        const warning =
          'FCM token query skipped — apply data/migrations/016_fcm_jsonb_schema.sql'
        console.warn(warning)
        return { success: true, tokens: [], schemaReady: false, warning }
      }
      throw result.error || new Error(msg)
    }

    return { success: true, tokens: result.data, schemaReady: true }
  } catch (err) {
    if (isFcmSchemaMismatch(err)) {
      const warning =
        'FCM token query skipped — apply data/migrations/016_fcm_jsonb_schema.sql'
      console.warn(warning)
      return { success: true, tokens: [], schemaReady: false, warning }
    }
    throw err
  }
}

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
      const msg = existingResult.error?.message ?? 'Failed to check existing tokens'
      if (isFcmSchemaMismatch(msg)) {
        console.warn('FCM token upsert skipped — apply data/migrations/016_fcm_jsonb_schema.sql')
        return { success: true }
      }
      return { error: msg }
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
    if (isFcmSchemaMismatch(err)) {
      console.warn('FCM token upsert skipped — apply data/migrations/016_fcm_jsonb_schema.sql')
      return { success: true }
    }
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
      const msg = existingResult.error?.message ?? 'Failed to find FCM token'
      if (isFcmSchemaMismatch(msg)) {
        console.warn('FCM token unregister skipped — apply data/migrations/016_fcm_jsonb_schema.sql')
        return { success: true }
      }
      return { error: msg }
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
    if (isFcmSchemaMismatch(err)) {
      console.warn('FCM token unregister skipped — apply data/migrations/016_fcm_jsonb_schema.sql')
      return { success: true }
    }
    const message = err instanceof Error ? err.message : 'Failed to unregister FCM token'
    return { error: message }
  }
}
