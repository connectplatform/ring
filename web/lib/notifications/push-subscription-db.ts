/**
 * RFC Web Push subscription DB layer — server-only.
 * Separate collection from fcm_tokens (dual-stack).
 */

import { z } from 'zod'
import { db } from '@/lib/database'

const DEVICE_FINGERPRINT_MAX = 128
const DEVICE_FINGERPRINT_REGEX = /^[a-zA-Z0-9\-_]+$/

export const upsertPushSubscriptionParamsSchema = z.object({
  endpoint: z.string().url('endpoint must be a URL'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceFingerprint: z
    .string()
    .max(DEVICE_FINGERPRINT_MAX)
    .regex(DEVICE_FINGERPRINT_REGEX),
  deviceInfo: z.record(z.string(), z.unknown()).optional(),
  platform: z.string().optional(),
  expirationTime: z.number().nullable().optional(),
})

export type UpsertPushSubscriptionParams = z.infer<
  typeof upsertPushSubscriptionParamsSchema
>

export type UpsertPushSubscriptionResult =
  | { success: true }
  | { error: string }

type PushSubRow = Record<string, unknown> & { id: string }

export function isPushSchemaMismatch(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('column "data" does not exist') ||
    message.includes('relation "push_subscriptions" does not exist')
  )
}

export type PushSubscriptionRecord = {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  expirationTime?: number | null
}

function extractSubscription(row: PushSubRow): PushSubscriptionRecord | null {
  const endpoint = typeof row.endpoint === 'string' ? row.endpoint : null
  const keys = row.keys as { p256dh?: string; auth?: string } | undefined
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null
  return {
    id: row.id,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    expirationTime:
      typeof row.expirationTime === 'number' ? row.expirationTime : null,
  }
}

export async function listActivePushSubscriptionsForUser(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  try {
    const result = await db().queryDocs<PushSubRow>({
      collection: 'push_subscriptions',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'isActive', operator: '==', value: true },
      ],
    })
    if (!result.success || !result.data) {
      if (result.error && isPushSchemaMismatch(result.error)) return []
      return []
    }
    return result.data
      .map(extractSubscription)
      .filter((s): s is PushSubscriptionRecord => Boolean(s))
  } catch (err) {
    if (isPushSchemaMismatch(err)) return []
    throw err
  }
}

export async function upsertPushSubscriptionForUser(
  userId: string,
  params: UpsertPushSubscriptionParams,
): Promise<UpsertPushSubscriptionResult> {
  const parsed = upsertPushSubscriptionParamsSchema.safeParse(params)
  if (!parsed.success) {
    const first = parsed.error.issues?.[0]?.message ?? 'Validation failed'
    return { error: first }
  }

  const { endpoint, keys, deviceFingerprint, deviceInfo, platform, expirationTime } =
    parsed.data
  const lastSeen = new Date()

  try {
    const existingResult = await db().queryDocs<PushSubRow>({
      collection: 'push_subscriptions',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'deviceFingerprint', operator: '==', value: deviceFingerprint },
      ],
    })

    if (!existingResult.success) {
      const msg = existingResult.error?.message ?? 'Failed to check subscriptions'
      if (isPushSchemaMismatch(msg)) {
        console.warn(
          'push_subscriptions upsert skipped — apply data/migrations/046_push_subscriptions_jsonb.sql',
        )
        return { success: true }
      }
      return { error: msg }
    }

    const payload = {
      userId,
      endpoint,
      keys,
      deviceFingerprint,
      expirationTime: expirationTime ?? null,
      ...(platform ? { platform } : {}),
      deviceInfo: {
        ...(deviceInfo ?? {}),
        platform: platform ?? (deviceInfo as { platform?: string })?.platform ?? 'web',
        lastSeen,
      },
      isActive: true,
      status: 'active' as const,
      lastSeen,
      updatedAt: lastSeen,
      invalidatedAt: null,
    }

    if (existingResult.data.length > 0) {
      const existing = existingResult.data[0]
      const updateResult = await db().updateDoc(
        'push_subscriptions',
        existing.id,
        payload,
      )
      if (!updateResult.success) {
        return { error: updateResult.error?.message ?? 'Failed to update push subscription' }
      }
    } else {
      const createResult = await db().createDoc('push_subscriptions', {
        ...payload,
        createdAt: lastSeen,
      })
      if (!createResult.success) {
        return { error: createResult.error?.message ?? 'Failed to create push subscription' }
      }
    }

    return { success: true }
  } catch (err) {
    if (isPushSchemaMismatch(err)) {
      console.warn(
        'push_subscriptions upsert skipped — apply data/migrations/046_push_subscriptions_jsonb.sql',
      )
      return { success: true }
    }
    return { error: err instanceof Error ? err.message : 'Failed to register push subscription' }
  }
}

export async function deactivatePushSubscription(
  subscriptionId: string,
): Promise<void> {
  try {
    await db().updateDoc('push_subscriptions', subscriptionId, {
      isActive: false,
      status: 'invalid',
      invalidatedAt: new Date(),
    })
  } catch (err) {
    if (isPushSchemaMismatch(err)) return
    console.warn('deactivatePushSubscription failed', err)
  }
}

export type UnregisterPushSubscriptionParams = {
  deviceFingerprint?: string
  endpoint?: string
}

export async function unregisterPushSubscriptionForUser(
  userId: string,
  params: UnregisterPushSubscriptionParams,
): Promise<UpsertPushSubscriptionResult> {
  try {
    const filters: Array<{ field: string; operator: '=='; value: string }> = [
      { field: 'userId', operator: '==', value: userId },
    ]
    if (params.deviceFingerprint) {
      filters.push({
        field: 'deviceFingerprint',
        operator: '==',
        value: params.deviceFingerprint,
      })
    } else if (params.endpoint) {
      filters.push({ field: 'endpoint', operator: '==', value: params.endpoint })
    } else {
      return { error: 'deviceFingerprint or endpoint required' }
    }

    const result = await db().queryDocs<PushSubRow>({
      collection: 'push_subscriptions',
      filters,
    })
    if (!result.success) {
      if (result.error && isPushSchemaMismatch(result.error)) return { success: true }
      return { error: result.error?.message ?? 'query failed' }
    }
    for (const row of result.data) {
      await deactivatePushSubscription(row.id)
    }
    return { success: true }
  } catch (err) {
    if (isPushSchemaMismatch(err)) return { success: true }
    return { error: err instanceof Error ? err.message : 'unregister failed' }
  }
}
