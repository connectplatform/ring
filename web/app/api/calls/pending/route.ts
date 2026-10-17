import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import {
  clearCallPending,
  getCallPending,
} from '@/lib/redis/call-pending'

/**
 * GET /api/calls/pending
 * Pending-invite replay for the current user (Redis registry written by the
 * call-invite route, TTL 60s). Optional ?callId= validation for ?call= deep-links.
 *
 * POST /api/calls/pending
 * {callId} — clear the pending key when callId matches (idempotent consume;
 * called by banner accept/decline and hook accept/reject).
 */

const clearSchema = z.object({
  callId: z.string().min(8).max(128),
})

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pending = await getCallPending(session.user.id)

    // Deep-link validation: ?callId= mismatch → treated as no pending invite.
    const callIdParam =
      new URL(request.url).searchParams.get('callId') ||
      new URL(request.url).searchParams.get('call')
    if (callIdParam && (!pending || pending.callId !== callIdParam)) {
      return NextResponse.json({ success: true, data: { invite: null } })
    }

    return NextResponse.json({ success: true, data: { invite: pending } })
  } catch (error) {
    console.error('calls/pending GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to read pending call' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = clearSchema.parse(await request.json())
    const cleared = await clearCallPending(session.user.id, parsed.callId)
    return NextResponse.json({ success: true, data: { cleared } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 },
      )
    }
    console.error('calls/pending POST failed:', error)
    return NextResponse.json(
      { error: 'Failed to clear pending call' },
      { status: 500 },
    )
  }
}
