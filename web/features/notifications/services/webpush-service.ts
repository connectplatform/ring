/**
 * RFC Web Push send via `web-push` + dedicated VAPID_* keypair.
 * Never use NEXT_PUBLIC_FIREBASE_VAPID_KEY / Console cert here or in getToken.
 */

import 'server-only'

import webpush from 'web-push'
import {
  deactivatePushSubscription,
  listActivePushSubscriptionsForUser,
  type PushSubscriptionRecord,
} from '@/lib/notifications/push-subscription-db'
import { getFcmVapidKey } from '@/lib/firebase-public-env'
import {
  DEFAULT_WEBPUSH_TTL_SECONDS,
  webPushUrgencyForType,
} from '@/features/notifications/lib/push-ttl'

export type WebPushPayload = {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, string>
  clickAction?: string
  ttlSeconds?: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

function getVapidConfig(): {
  publicKey: string
  privateKey: string
  subject: string
} | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  // Guard: never accidentally feed Firebase Console public into send path alone
  const firebaseVapid = getFcmVapidKey()
  if (firebaseVapid && publicKey === firebaseVapid) {
    console.warn(
      '[webpush] VAPID_PUBLIC_KEY equals NEXT_PUBLIC_FIREBASE_VAPID_KEY — use a dedicated RFC keypair (private required). Continuing only if private is set.',
    )
  }
  return { publicKey, privateKey, subject }
}

let configured = false

function ensureVapid(): boolean {
  if (configured) return true
  const cfg = getVapidConfig()
  if (!cfg) return false
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  configured = true
  return true
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidConfig())
}

export class WebPushService {
  async sendToUser(userId: string, payload: WebPushPayload): Promise<{
    attempted: number
    sent: number
    failed: number
  }> {
    if (!ensureVapid()) {
      return { attempted: 0, sent: 0, failed: 0 }
    }

    const subs = await listActivePushSubscriptionsForUser(userId)
    if (subs.length === 0) {
      return { attempted: 0, sent: 0, failed: 0 }
    }

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/notification-icon.png',
      badge: payload.badge || '/icons/badge-icon.png',
      tag: payload.tag,
      data: {
        ...(payload.data || {}),
        ...(payload.clickAction ? { clickAction: payload.clickAction } : {}),
      },
    })

    let sent = 0
    let failed = 0

    const ttl = payload.ttlSeconds ?? DEFAULT_WEBPUSH_TTL_SECONDS
    const urgency = payload.urgency ?? webPushUrgencyForType(payload.data?.type)

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await this.sendOne(sub, body, ttl, urgency)
          sent += 1
        } catch {
          failed += 1
        }
      }),
    )

    return { attempted: subs.length, sent, failed }
  }

  private async sendOne(
    sub: PushSubscriptionRecord,
    body: string,
    ttl: number,
    urgency: 'very-low' | 'low' | 'normal' | 'high',
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
          expirationTime: sub.expirationTime ?? undefined,
        },
        body,
        {
          TTL: ttl,
          urgency,
        },
      )
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 0
      if (statusCode === 404 || statusCode === 410) {
        await deactivatePushSubscription(sub.id)
      }
      throw err
    }
  }
}

export const webPushService = new WebPushService()
