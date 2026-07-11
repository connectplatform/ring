import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { publishToChannel, publishToUserTunnel } from '@/lib/tunnel/publisher'

/**
 * POST /api/conversations/[id]/call-invite
 * Fan-out call invite to conversation channel + peer user tunnel (global incoming).
 *
 * UPGRADE: Add FCM data push (fcm_specialist) when peer has no live Tunnel socket.
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

/** In-process invite dedupe — avoids double system lines on client timeout/retry. UPGRADE: Redis. */
const invitedCallIds = new Map<string, number>()
const INVITE_TTL_MS = 10 * 60 * 1000

function pruneInvites() {
  const now = Date.now()
  for (const [k, ts] of invitedCallIds) {
    if (now - ts > INVITE_TTL_MS) invitedCallIds.delete(k)
  }
}

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

    // UPGRADE: group calls — fan-out to all participants except self (LiveKit room id).
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

    pruneInvites()
    const inviteKey = `${conversationId}:${parsed.callId}`
    const already = invitedCallIds.has(inviteKey)
    invitedCallIds.set(inviteKey, Date.now())

    // Re-publish invite on retry so late joiners still hear the ring; skip duplicate system line.
    await publishToChannel(`conversation:${conversationId}`, 'call:invite', payload)
    await publishToUserTunnel(parsed.peerUserId, 'calls:incoming', payload)

    if (!already) {
      try {
        await conversationService.recordCallSystemMessage(
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
      data: { ...payload, deduped: already },
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
