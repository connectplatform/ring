import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { appendEvent } from '@/lib/events/event-log.server'

/**
 * Onboarding funnel ingestion — shown / completed / snoozed.
 * Reuses the generic `events` log (appendEvent); userId bound server-side
 * from the session (the gate only renders for authenticated users).
 */

const bodySchema = z.object({
  event: z.enum(['shown', 'completed', 'snoozed']),
  segmentId: z.string().min(1).max(64),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  try {
    await appendEvent({
      type: `onboarding_gate_${parsed.data.event}`,
      payload: { segmentId: parsed.data.segmentId },
      userId,
      meta: { source: 'user-onboarding-gate' },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[analytics] onboarding funnel event failed:', error)
    // Funnel telemetry must never break the UX — accept-and-drop on failure.
    return NextResponse.json({ success: false }, { status: 202 })
  }
}
