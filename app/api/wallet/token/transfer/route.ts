import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { GasReserveError } from '@/features/wallet/chains/solana/native-token-transfer'
import { readJsonBody } from '@/lib/server/request'
import { getNativeChain, getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { isAddress } from 'viem'

const TransferSchema = z.object({
  toAddress: z.string().min(1),
  amount: z.string().min(1),
  contactUserId: z.string().uuid().optional(),
  ringContactId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

function isValidRecipientAddress(address: string): boolean {
  const chain = getNativeChain()
  if (chain === 'evm' || chain === 'base') {
    return isAddress(address)
  }
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

/**
 * POST /api/wallet/token/transfer — custodial native-token send via WalletConductor.
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    const parsed = TransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { toAddress, amount, contactUserId, ringContactId, notes } = parsed.data
    if (!isValidRecipientAddress(toAddress)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
    }

    const result = await WalletConductor.transferNative({
      userId: session.user.id,
      toAddress,
      amount,
      notes,
      contactUserId,
      ringContactId,
    })

    if (!result.success) {
      const message = result.error || 'Transfer failed'
      if (message.includes('insufficient') || message.includes('Insufficient')) {
        return NextResponse.json({ error: message, code: 'INSUFFICIENT_FUNDS' }, { status: 400 })
      }
      if (message.includes('GAS_RESERVE') || message.includes('gas reserve')) {
        return NextResponse.json({ error: message, code: 'GAS_RESERVE' }, { status: 503 })
      }
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      fromAddress: result.fromAddress,
      toAddress: result.toAddress,
      amount: result.amount,
      tokenSymbol: result.tokenSymbol ?? getNativeTokenSymbol(),
      chain: result.chain,
    })
  } catch (error) {
    if (error instanceof GasReserveError) {
      return NextResponse.json({ error: error.message, code: 'GAS_RESERVE' }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : 'Transfer failed'
    console.error('POST /api/wallet/token/transfer failed:', error)
    return NextResponse.json({ error: 'Transfer failed', details: message }, { status: 500 })
  }
}
