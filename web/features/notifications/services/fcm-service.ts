// Token storage: Server Action + API route via fcm-token-db.ts
// Push delivery: Firebase Admin SDK (FCM infrastructure)

import { getMessaging, type BatchResponse, type Message } from 'firebase-admin/messaging'
import { db } from '@/lib/database'

export interface FCMNotification {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: Record<string, string>
  clickAction?: string
  tag?: string
}

type FcmTokenRow = Record<string, unknown> & {
  id: string
  token?: string
}

const INVALID_FCM_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
])

function extractToken(row: FcmTokenRow): string | null {
  return typeof row.token === 'string' && row.token.length > 0 ? row.token : null
}

export class FCMService {
  private messaging: ReturnType<typeof getMessaging> | null = null

  private getMessagingInstance() {
    if (!this.messaging) {
      this.messaging = getMessaging()
    }
    return this.messaging
  }

  private async fetchActiveTokenRows(userId: string): Promise<FcmTokenRow[]> {
    const tokensResult = await db().queryDocs<FcmTokenRow>({
      collection: 'fcm_tokens',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'status', operator: '==', value: 'active' },
      ],
    })

    if (!tokensResult.success) {
      throw tokensResult.error ?? new Error('Failed to fetch FCM tokens')
    }

    return tokensResult.data
  }

  async sendToUser(userId: string, notification: FCMNotification): Promise<void> {
    try {
      const rows = await this.fetchActiveTokenRows(userId)
      if (rows.length === 0) {
        console.log(`No active FCM tokens found for user ${userId}`)
        return
      }

      await this.sendToTokenRows(rows, notification)
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error)
      throw new Error('Failed to send notification to user')
    }
  }

  async sendToUsers(userIds: string[], notification: FCMNotification): Promise<void> {
    try {
      const tokensResult = await db().queryDocs<FcmTokenRow>({
        collection: 'fcm_tokens',
        filters: [
          { field: 'userId', operator: 'in', value: userIds },
          { field: 'status', operator: '==', value: 'active' },
        ],
      })

      if (!tokensResult.success || tokensResult.data.length === 0) {
        console.log('No active FCM tokens found for specified users')
        return
      }

      await this.sendToTokenRows(tokensResult.data, notification)
    } catch (error) {
      console.error('Error sending notification to users:', error)
      throw new Error('Failed to send notification to users')
    }
  }

  async sendToAllUsers(notification: FCMNotification): Promise<void> {
    try {
      const tokensResult = await db().queryDocs<FcmTokenRow>({
        collection: 'fcm_tokens',
        filters: [{ field: 'status', operator: '==', value: 'active' }],
      })

      if (!tokensResult.success || tokensResult.data.length === 0) {
        console.log('No active FCM tokens found')
        return
      }

      const batchSize = 500
      for (let i = 0; i < tokensResult.data.length; i += batchSize) {
        await this.sendToTokenRows(tokensResult.data.slice(i, i + batchSize), notification)
      }
    } catch (error) {
      console.error('Error sending broadcast notification:', error)
      throw new Error('Failed to send broadcast notification')
    }
  }

  private buildMessageForToken(token: string, notification: FCMNotification): Message {
    return {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.icon && { icon: notification.icon }),
        ...(notification.image && { image: notification.image }),
      },
      data: notification.data || {},
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/notification-icon.png',
          badge: notification.badge || '/icons/badge-icon.png',
          ...(notification.image && { image: notification.image }),
          ...(notification.clickAction && { click_action: notification.clickAction }),
          ...(notification.tag && { tag: notification.tag }),
          requireInteraction: true,
          silent: false,
        },
        fcmOptions: {
          link: notification.clickAction || '/',
        },
      },
    }
  }

  private async sendToTokenRows(rows: FcmTokenRow[], notification: FCMNotification): Promise<void> {
    const pairs = rows
      .map((row) => ({ row, token: extractToken(row) }))
      .filter((p): p is { row: FcmTokenRow; token: string } => p.token != null)

    if (pairs.length === 0) {
      return
    }

    const messages = pairs.map(({ token }) => this.buildMessageForToken(token, notification))
    const response = await this.getMessagingInstance().sendEach(messages)
    await this.handleSendResponses(pairs, response)
    console.log(`FCM notification sent to ${response.successCount}/${messages.length} tokens`)
  }

  private async handleSendResponses(
    pairs: Array<{ row: FcmTokenRow; token: string }>,
    response: BatchResponse,
  ): Promise<void> {
    const now = new Date()

    for (let index = 0; index < response.responses.length; index++) {
      const sendResponse = response.responses[index]
      const { row } = pairs[index]
      if (!row?.id) continue

      if (sendResponse.success) {
        await db().updateDoc('fcm_tokens', row.id, {
          lastSeen: now,
          updatedAt: now,
        })
        continue
      }

      const code =
        sendResponse.error?.code ??
        (sendResponse.error as { errorInfo?: { code?: string } } | undefined)?.errorInfo?.code
      if (code && INVALID_FCM_ERROR_CODES.has(code)) {
        await db().updateDoc('fcm_tokens', row.id, {
          isActive: false,
          status: 'invalid',
          invalidatedAt: now,
          updatedAt: now,
        })
      }
    }
  }

  async getUserTokensCount(userId: string): Promise<number> {
    try {
      const countResult = await db().countDocs('fcm_tokens', [
        { field: 'userId', operator: '==', value: userId },
        { field: 'status', operator: '==', value: 'active' },
      ])

      return countResult.success ? (countResult.data ?? 0) : 0
    } catch (error) {
      console.error('Error getting user tokens count:', error)
      return 0
    }
  }
}

export const fcmService = new FCMService()
