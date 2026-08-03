import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { db } from '@/lib/database'
import { asScheduledServicesMetadata } from '@/features/opportunities/types/type-metadata'
import { syncOpportunityDiscovery } from '@/features/opportunities/lib/opportunity-mutation-sync'

const schema = z.object({
  slotStart: z.string().optional(),
  slotEnd: z.string().optional(),
  note: z.string().max(2000).optional(),
})

/**
 * Book / express interest in a scheduled_services slot (v1 interest mode).
 * Appends user to applicants and bumps applicantCount.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id: opportunityId } = await context.params
  const body = schema.parse(await request.json().catch(() => ({})))

  const result = await db().findDocById<Record<string, unknown>>('opportunities', opportunityId)
  if (!result.success || !result.data) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const opp = result.data
  if (String(opp.type) !== 'scheduled_services') {
    return NextResponse.json({ error: 'Not a scheduled_services opportunity' }, { status: 400 })
  }

  const meta = asScheduledServicesMetadata(opp.metadata) || {}
  if (meta.bookingMode === 'hold') {
    return NextResponse.json(
      {
        error:
          'Paid hold booking is not enabled yet for this listing. Contact the broker or use interest mode.',
      },
      { status: 400 },
    )
  }

  const applicants = Array.isArray(opp.applicants)
    ? (opp.applicants as string[]).map(String)
    : []
  const uid = session.user.id
  if (applicants.includes(uid)) {
    return NextResponse.json({
      success: true,
      alreadyRequested: true,
      applicantCount: typeof opp.applicantCount === 'number' ? opp.applicantCount : applicants.length,
    })
  }

  const nextApplicants = [...applicants, uid]
  const applicantCount = nextApplicants.length
  const bookings = Array.isArray((opp.metadata as { bookings?: unknown })?.bookings)
    ? ([...(opp.metadata as { bookings: unknown[] }).bookings] as unknown[])
    : []
  bookings.push({
    userId: uid,
    slotStart: body.slotStart,
    slotEnd: body.slotEnd,
    note: body.note,
    createdAt: new Date().toISOString(),
  })

  const updateResult = await db().updateDoc(
    'opportunities',
    opportunityId,
    {
      applicants: nextApplicants,
      applicantCount,
      metadata: {
        ...(typeof opp.metadata === 'object' && opp.metadata ? opp.metadata : {}),
        bookings,
      },
      dateUpdated: new Date().toISOString(),
    },
    { merge: true },
  )

  if (!updateResult.success) {
    return NextResponse.json({ error: 'Failed to book slot' }, { status: 500 })
  }

  await syncOpportunityDiscovery({
    opportunityId,
    event: 'updated',
    snippet: {
      type: 'scheduled_services',
      applicantCount,
      message: `New booking interest (${applicantCount})`,
    },
  })

  return NextResponse.json({
    success: true,
    alreadyRequested: false,
    applicantCount,
  })
}
