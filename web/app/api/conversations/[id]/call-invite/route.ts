import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { publishToChannel, publishToUserTunnel } from '@/lib/tunnel/publisher'
import { setNxPx } from '@/lib/redis/set-nx'

/**
 * POST /api/conversations/[id]/call-invite
 * Fan-out call invite to conversation channel + peer user tunnel (global incoming).
 * Offline: CALL_INVITE via notification dual-stack (FCM + RFC web-push) after Tunnel miss.
 *
 * UPGRADE: Ephemeral TURN credentials per call via STUNner auth service instead of static.
 */
type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  callId: z.string().min(8).max(128),
  media: z.enum(['audio', 'video']),
  peerUserId: z.string().min(1),
  fromUserName: z.string().max(120).optional(),
})

const conversationService = new ConversationService()
const INVITE_TTL_MS = 10 * 60 * 1000

export async function POST(request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    const parsed = bodySchema.parse(await request.json())
    const fromUserId = session.user.id

    if (parsed.peerUserId === fromUserId) {
      return NextResponse.json({ error: 'Invalid peer' }, { status: 400 })
    }

    const conversation = await conversationService.getConversationById(
      conversationId,
      fromUserId,
    )
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isParticipant = conversation.participants.some((p) => p.userId === fromUserId)
    const peerOk = conversation.participants.some((p) => p.userId === parsed.peerUserId)
    if (!isParticipant || !peerOk) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (conversation.type !== 'direct') {
      return NextResponse.json(
        { error: 'Only direct calls are supported' },
        { status: 400 },
      )
    }

    const payload = {
      callId: parsed.callId,
      conversationId,
      fromUserId,
      fromUserName: parsed.fromUserName || session.user.name || 'User',
      media: parsed.media,
      peerUserId: parsed.peerUserId,
    }

    const inviteKey = `call:invite:${conversationId}:${parsed.callId}`
    const { claimed } = await setNxPx(inviteKey, INVITE_TTL_MS)
    const already = !claimed

    // Re-publish invite on retry so late joiners still hear the ring; skip duplicate system line.
    await publishToChannel(`conversation:${conversationId}`, 'call:invite', payload)
    const tunnelDelivery = await publishToUserTunnel(
      parsed.peerUserId,
      'calls:incoming',
      payload,
    )

    // Offline fallback: CALL_INVITE on NotificationChannel.PUSH (FCM tokens + RFC
    // push_subscriptions). Chrome stays FCM-primary; RFC is empty-PushManager only.
    if (!tunnelDelivery.deliveredLive) {
      await new Promise((r) => setTimeout(r, 500))
      const { getTunnelHub } = await import('@/lib/tunnel/hub')
      const stillOffline = !getTunnelHub().isUserConnected(parsed.peerUserId)
      if (stillOffline) {
        try {
          const { createNotification } = await import(
            '@/features/notifications/services/notification-service'
          )
          const {
            NotificationType,
            NotificationChannel,
            NotificationPriority,
          } = await import('@/features/notifications/types')
          const actionUrl = `/messages?c=${conversationId}&call=${parsed.callId}`
          await createNotification({
            userId: parsed.peerUserId,
            type: NotificationType.CALL_INVITE,
            priority: NotificationPriority.HIGH,
            title: `${payload.fromUserName} is calling`,
            body:
              parsed.media === 'video'
                ? 'Incoming video call — open Messages to answer'
                : 'Incoming audio call — open Messages to answer',
            data: {
              actionUrl,
              metadata: {
                kind: 'call_invite',
                callId: parsed.callId,
                conversationId,
                fromUserId,
                media: parsed.media,
              },
            },
            channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
            actionText: 'Answer',
            actionUrl,
          })
        } catch (err) {
          console.warn('call-invite: CALL_INVITE push fallback failed', err)
        }
      }
    }

    let systemMessage = null
    if (!already) {
      try {
        systemMessage = await conversationService.recordCallSystemMessage(
          conversationId,
          fromUserId,
          parsed.media === 'video' ? 'started a video call' : 'started an audio call',
        )
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...payload,
        deduped: already,
        message: already ? null : systemMessage,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 },
      )
    }
    console.error('call-invite failed:', error)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
