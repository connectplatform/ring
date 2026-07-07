import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import {
  getOracleAuditLog,
  getRingPerUsdRate,
  setRingPerUsdRate,
} from '@/features/wallet/services/ring-token-oracle'
import { getNativeTokenDecimals, getRewardCreditRules, getTokenDeskConfig } from '@/lib/ring-config-chain'
import { getDefaultStoreCurrencySymbol, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { getNativeTokenAddress, getNativeTokenName } from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { readJsonBody } from '@/lib/server/request'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

// Zod schema for validating the incoming rate for ringPerUsd
const rateSchema = z.object({
  ringPerUsd: z.string().min(1),
})

/**
 * GET handler for web3 settings.
 * - Ensures user is superadmin.
 * - Fetches current oracle rate, audit log, and Solana gas reserve.
 * - Responds with relevant config and state.
 */
export async function GET() {
  // TODO: Use Next.js 16 middleware or advanced route handlers if structure evolves.
  await connection() // Ensure DB connection

  // Check user authentication and superadmin role
  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    // Return 403 if user is not a superadmin
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch the oracle rate, audit logs, and gas reserve in parallel
  const [rate, audit, gasReserve] = await Promise.all([
    getRingPerUsdRate(),
    getOracleAuditLog(),
    // If fetching Solana gas reserve fails, gracefully fallback to null
    getFeePayerSolBalance().catch(() => null),
  ])

  // Combine and return relevant info
  return NextResponse.json({
    oracle: {
      tokenPerUsd: rate,
      tokenSymbol: getNativeTokenSymbol(),
      tokenName: getNativeTokenName(),
      tokenDecimals: getNativeTokenDecimals(),
      tokenAddress: getNativeTokenAddress(),

      currency: getSystemConfigSnapshot().store.defaultCurrency,
      currencySymbol: getDefaultStoreCurrencySymbol(),
    },
    tokenDesk: getTokenDeskConfig(),
    tokenRewards: getRewardCreditRules(),
    audit,
    gasReserve,
  })
}

/**
 * POST handler to update the oracle rate.
 * - Ensures user is superadmin.
 * - Validates input body with zod schema.
 * - Calls service to update rate, then returns result or error.
 */
export async function POST(request: NextRequest) {
  // TODO: Switch to Next.js 16 advanced request handling (if available) for validation and auth.
  await connection() // Ensure DB connection

  // Check user authentication and superadmin role
  const session = await auth()
  if (!session?.user?.id || !isSuperadmin(session.user.role)) {
    // Return 403 if user is not a superadmin
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse and validate the incoming request body
  const body = await readJsonBody(request)
  const parsed = rateSchema.safeParse(body)
  if (!parsed.success) {
    // Return 400 if body does not match schema
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Try to update the oracle rate, respond accordingly
  try {
    const result = await setRingPerUsdRate(parsed.data.ringPerUsd, session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update oracle rate'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
