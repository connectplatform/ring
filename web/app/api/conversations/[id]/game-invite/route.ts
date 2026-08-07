import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { peerGameSlugSchema } from '@/features/peer-games/types'
import { createInvite } from '@/features/peer-games/service'

/**
 * POST /api/conversations/[id]/game-invite
 * Thin HTTP twin of createGameRequest — always calls PeerGameService.createInvite.
 * Invite dedupe (Redis SET NX + Map fallback) lives inside createInvite (SSOT).
 */
type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  slug: peerGameSlugSchema,
  peerUserId: z.string().min(1).optional(),
})

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

    const result = await createInvite({
      conversationId,
      slug: parsed.slug,
      challengerUserId: fromUserId,
      challengerName: session.user.name || session.user.email || 'User',
      challengerRole: session.user.role as string | undefined,
      peerUserId: parsed.peerUserId,
    })

    return NextResponse.json({
      success: true,
      data: {
        sessionId: result.session.id,
        messageId: result.messageId,
        invite: result.invite,
        deduped: false,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 },
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to send invite'
    if (message.includes('already sent recently')) {
      return NextResponse.json({
        success: true,
        data: { deduped: true },
      })
    }
    const status =
      message.includes('Member') || message.includes('Forbidden')
        ? 403
        : message.includes('direct') || message.includes('Unknown')
          ? 400
          : 500
    console.error('game-invite failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
