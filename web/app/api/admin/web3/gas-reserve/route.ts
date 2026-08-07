import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import { getNativeChainConfig, getNativeTokenConfig } from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'

// Main handler for GET requests to this endpoint
export async function GET() {
  // Step 1: Initiate a database or API connection before performing any logic
  await connection()

  // Step 2: Retrieve the current user session
  const session = await auth()

  // Step 3: Secure the endpoint so that only superadmin users can access it
  // Checks if user is not authenticated or not superadmin, and blocks access if so
  if (!session?.user || !isSuperadmin(session.user.role)) {
    // Respond with 403 Forbidden if user is unauthorized
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Step 4: Get configuration for all native chains from system config
  const chains = getNativeChainConfig()
  const token = getNativeTokenConfig()

  // Step 5: Check if Solana is enabled in configuration; restrict data if not
  if (!chains.enabled?.includes('solana')) {
    // Return early if Solana is disabled, including metadata in response
    return NextResponse.json({
      chain: 'solana',
      enabled: false,
      message: 'solana chain not enabled in ring-config',
    })
  }

  try {
    // Step 6: Retrieve Solana Fee Payer's SOL balance through wrapped API
    const reserve = await getFeePayerSolBalance()
    // Construct a consistent JSON structure with all relevant Solana info
    return NextResponse.json({
      chain: 'solana',
      feePayer: reserve, // Key result: SOL balance
      sponsorAllNativeTokenTransfers: false,
      tokenAddress: null,
      tokenTreasuryAddress: null,
    })
  } catch (error) {
    // TODO: When upgrading to Next.js 16 with stable web Response support,
    // switch from NextResponse.json to the native Response.json method for error handling.
    // See: https://nextjs.org/docs/messages/edge-api-routes-middleware-upgrade

    // Gracefully handle unexpected exceptions and prevent server crash
    // If the error is a standard Error, use its message; otherwise, use a generic message
    const message = error instanceof Error ? error.message : 'Failed to read gas reserve'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
