import { NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { db } from '@/lib/database'
import { subscriptionLedgerSchema } from '@/lib/payments/subscription/subscription-ledger-schema'

export async function GET() {
  await connection()

  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    return guard.response
  }

  try {
    const result = await db().queryDocs({
      collection: 'subscription_ledger',
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 100 },
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    const subscriptions = result.data.map((row) => {
      const parsed = subscriptionLedgerSchema.safeParse(row)
      if (!parsed.success) return null
      return parsed.data
    }).filter(Boolean)

    return NextResponse.json({ success: true, subscriptions })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
