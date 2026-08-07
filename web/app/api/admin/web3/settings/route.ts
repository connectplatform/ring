import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import {
  getOracleAuditLog,
  getNativeTokenPerMainCurrencyRate,
  setNativeTokenPerMainCurrencyRate,
} from '@/lib/ring-oracle'
import { getNativeTokenDecimals, getRewardCreditRules, getTokenDeskConfig } from '@/lib/ring-config-chain'
import { getMainCurrencySymbol, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { getNativeTokenAddress, getNativeTokenName } from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { readJsonBody } from '@/lib/server/request'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

const rateSchema = z.object({
  nativePerMainCurrency: z.string().min(1),
})

/**
 * GET handler for web3 settings.
 */
export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [rate, audit, gasReserve] = await Promise.all([
    getNativeTokenPerMainCurrencyRate(),
    getOracleAuditLog(),
    getFeePayerSolBalance().catch(() => null),
  ])

  return NextResponse.json({
    oracle: {
      nativePerMainCurrency: rate,
      tokenSymbol: getNativeTokenSymbol(),
      tokenName: getNativeTokenName(),
      tokenDecimals: getNativeTokenDecimals(),
      tokenAddress: getNativeTokenAddress(),
      mainCurrency: getMainCurrencySymbol(),
      currency: getSystemConfigSnapshot().store?.mainCurrency ?? 'USD',
      currencySymbol: getMainCurrencySymbol(),
    },
    tokenDesk: getTokenDeskConfig(),
    tokenRewards: getRewardCreditRules(),
    audit,
    gasReserve,
  })
}

/**
 * POST handler to update the oracle rate (main currency per 1 native).
 */
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
    const result = await setNativeTokenPerMainCurrencyRate(
      parsed.data.nativePerMainCurrency,
      session.user.id,
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update oracle rate'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
