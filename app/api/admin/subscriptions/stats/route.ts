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
      pagination: { limit: 1000 },
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscription stats' },
        { status: 500 }
      )
    }

    const stats = {
      total: 0,
      active: 0,
      grace_period: 0,
      expired: 0,
      cancelled: 0,
      suspended: 0,
      byProvider: {
        stripe: 0,
        wayforpay: 0,
        credit_balance: 0,
        native_token: 0,
        nft_gate: 0,
        paypal: 0,
      },
      byMethod: {
        card: 0,
        credit_balance: 0,
        crypto: 0,
        nft: 0,
      },
      totalRevenue: 0,
    }

    for (const row of result.data) {
      const parsed = subscriptionLedgerSchema.safeParse(row)
      if (!parsed.success) continue

      const sub = parsed.data
      stats.total++
      stats[sub.status]++
      stats.byProvider[sub.provider]++
      stats.byMethod[sub.method]++

      // Calculate net revenue
      const feePercent = sub.gateway_fee_percent || 0
      const feeFixed = sub.gateway_fee_fixed || 0
      const netRevenue = sub.amount * (1 - feePercent / 100) - feeFixed
      stats.totalRevenue += netRevenue
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
