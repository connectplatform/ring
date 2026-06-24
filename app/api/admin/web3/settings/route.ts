import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import {
  getOracleAuditLog,
  getRingPerUsdRate,
  setRingPerUsdRate,
} from '@/features/wallet/services/ring-token-oracle'
import { getRingCreditFiatCurrency, getRingDeskConfig } from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { readJsonBody } from '@/lib/server/request'

const rateSchema = z.object({
  ringPerUsd: z.string().min(1),
})

export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [rate, audit, gasReserve] = await Promise.all([
    getRingPerUsdRate(),
    getOracleAuditLog(),
    getFeePayerSolBalance().catch(() => null),
  ])

  return NextResponse.json({
    oracle: {
      ringPerUsd: rate,
      creditFiatCurrency: getRingCreditFiatCurrency(),
    },
    desk: getRingDeskConfig(),
    audit,
    gasReserve,
  })
}

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await readJsonBody(request)
  const parsed = rateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  try {
    const result = await setRingPerUsdRate(parsed.data.ringPerUsd, session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update oracle rate'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
