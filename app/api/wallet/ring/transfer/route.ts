import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { getCurrentRingContactsService } from '@/features/contacts/services'
import { transferRingForUser } from '@/features/wallet/chains/ring-transfer-service'
import { GasReserveError } from '@/features/wallet/chains/solana/ring-transfer'
import { readJsonBody } from '@/lib/server/request'
import { db } from '@/lib/database'
import { getNativeChain } from '@/lib/ring-config-chain'
import { isAddress } from 'viem'

const TransferSchema = z.object({
  toAddress: z.string().min(1),
  amount: z.string().min(1),
  contactUserId: z.string().uuid().optional(),
  ringContactId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

function isValidRecipientAddress(address: string, chain: 'solana' | 'evm'): boolean {
  if (chain === 'evm') {
    return isAddress(address)
  }
  try {
    // base58 length check for Solana
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  } catch {
    return false
  }
}

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
    const transferAmount = parseFloat(amount)

    if (Number.isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer amount' }, { status: 400 })
    }

    const chain = getNativeChain()
    if (!isValidRecipientAddress(toAddress, chain)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
    }

    const result = await transferRingForUser({
      userId: session.user.id,
      toAddress,
      amount,
    })

    const txId = `ring_send_${result.txHash.toLowerCase()}`
    await db().createDoc(
      'wallet_transactions',
      {
        kind: 'ring_send',
        txHash: result.txHash,
        userId: session.user.id,
        fromAddress: result.fromAddress,
        toAddress,
        amount,
        tokenSymbol: 'RING',
        chain: result.chain,
        notes: notes ?? null,
        contactUserId: contactUserId ?? null,
        createdAt: new Date().toISOString(),
      },
      { id: txId },
    )

    const contacts = getCurrentRingContactsService()
    if (ringContactId) {
      await contacts.touchLastUsed(session.user.id, ringContactId)
    } else if (contactUserId) {
      const list = await contacts.listContacts(session.user.id)
      const match = list.find((c) => c.contactUserId === contactUserId)
      if (match) {
        await contacts.touchLastUsed(session.user.id, match.id)
      }
    }

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      fromAddress: result.fromAddress,
      toAddress,
      amount,
      tokenSymbol: 'RING',
      chain: result.chain,
    })
  } catch (error) {
    if (error instanceof GasReserveError) {
      return NextResponse.json({ error: error.message, code: 'GAS_RESERVE' }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : 'Transfer failed'
    if (message.includes('insufficient') || message.includes('Insufficient')) {
      return NextResponse.json({ error: message, code: 'INSUFFICIENT_FUNDS' }, { status: 400 })
    }

    console.error('POST /api/wallet/ring/transfer failed:', error)
    return NextResponse.json({ error: 'Transfer failed', details: message }, { status: 500 })
  }
}
