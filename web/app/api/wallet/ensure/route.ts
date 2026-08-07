import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'

/**
 * POST /api/wallet/ensure — provision native (+ enabled) wallets via WalletConductor.
 */
export async function POST(_request: NextRequest) {
  await connection()
  console.log('API: /api/wallet/ensure - Starting POST request')

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ensured = await WalletConductor.ensureNativeWallet({
      id: session.user.id,
      role: session.user.role,
    })

    if (!ensured.ok || !ensured.native) {
      const message = ensured.error || 'Failed to ensure user wallet'
      if (message.includes('Unauthorized') || message.includes('log in')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (message.includes('Visitors')) {
        return NextResponse.json({ error: 'Visitors cannot have wallets' }, { status: 403 })
      }
      if (message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({ error: message }, { status: 500 })
    }

    console.log(`API: /api/wallet/ensure - Wallet ensured successfully: ${ensured.native.address}`)
    return NextResponse.json({
      address: ensured.native.address,
      chain: ensured.native.chain ?? 'solana',
      wallets: (ensured.wallets ?? []).map((w) => ({
        address: w.address,
        chain: w.chain ?? 'evm',
        isDefault: w.isDefault,
        label: w.label,
      })),
    })
  } catch (error) {
    console.error('API: /api/wallet/ensure - Error ensuring user wallet:', error)
    return NextResponse.json({ error: 'Failed to ensure user wallet' }, { status: 500 })
  }
}

export async function OPTIONS(_request: NextRequest) {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
  )
}
