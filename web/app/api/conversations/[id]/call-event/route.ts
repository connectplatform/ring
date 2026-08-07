import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { publishToChannel } from '@/lib/tunnel/publisher'
import { setNxPx } from '@/lib/redis/set-nx'

/**
 * POST /api/conversations/[id]/call-event
 * Records call lifecycle system lines (ended / rejected / failed).
 * For `rejected`, also publishes `call:reject` so the caller tears down even when
 * the decliner has no live Tunnel (banner decline API fallback).
 * Idempotent per callId+event via setNxPx (Redis + Map fallback).
 */
type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  callId: z.string().min(8).max(128),
  event: z.enum(['ended', 'rejected', 'failed']),
  media: z.enum(['audio', 'video']).optional(),
  peerUserName: z.string().max(120).optional(),
})

const conversationService = new ConversationService()
const TTL_MS = 60 * 60 * 1000

export async function POST(request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    const parsed = bodySchema.parse(await request.json())
    const userId = session.user.id

    const conversation = await conversationService.getConversationById(
      conversationId,
      userId,
    )
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!conversation.participants.some((p) => p.userId === userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const key = `call:event:${conversationId}:${parsed.callId}:${parsed.event}`
    const { claimed } = await setNxPx(key, TTL_MS)
    if (!claimed) {
      return NextResponse.json({
        success: true,
        data: { deduped: true, message: null },
      })
    }

    if (parsed.event === 'rejected') {
      try {
        await publishToChannel(`conversation:${conversationId}`, 'call:reject', {
          callId: parsed.callId,
          fromUserId: userId,
          media: parsed.media || 'audio',
          reason: 'rejected',
        })
      } catch {
        /* non-fatal — system line still recorded */
      }
    }

    const phrase =
      parsed.event === 'ended'
        ? 'ended the call'
        : parsed.event === 'rejected'
          ? 'declined the call'
          : 'call failed'

    const systemMessage = await conversationService.recordCallSystemMessage(
      conversationId,
      userId,
      phrase,
    )

    return NextResponse.json({
      success: true,
      data: { recorded: true, message: systemMessage },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 },
      )
    }
    console.error('call-event failed:', error)
    return NextResponse.json({ error: 'Failed to record call event' }, { status: 500 })
  }
}
