import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import { getRingChainConfig } from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'

export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const chains = getRingChainConfig()

  if (!chains.enabled?.includes('solana')) {
    return NextResponse.json({
      chain: 'solana',
      enabled: false,
      message: 'Solana chain not enabled in ring-config',
    })
  }

  try {
    const reserve = await getFeePayerSolBalance()
    return NextResponse.json({
      chain: 'solana',
      network: chains.solana?.network ?? 'devnet',
      feePayer: reserve,
      sponsorAllRingTransfers: chains.solana?.sponsorAllRingTransfers ?? false,
      mintAddress: chains.solana?.mintAddress ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read gas reserve'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
