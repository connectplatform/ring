import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { createPublicClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { logger } from '@/lib/logger'

type ListingRow = Record<string, unknown> & { id: string }

/** Verify the client-supplied txHash actually succeeded on-chain before activating. */
async function verifyListingTransaction(txHash: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const client = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    if (receipt.status !== 'success') return { ok: false, reason: 'Transaction reverted' }
    return { ok: true }
  } catch (error) {
    logger.warn('NFT activate: receipt lookup failed', { txHash, error })
    return { ok: false, reason: 'Transaction not found on chain' }
  }
}

// Marks a draft listing as active after on-chain tx confirmation
export async function POST(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { id, txHash } = body as { id: string, txHash?: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Ownership guard: only the listing creator may activate it
  const listing = await db().readDoc<ListingRow>('nft_listings', id)
  if (!listing.success || !listing.data) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  const listingData = listing.data
  if (listingData.sellerId && listingData.sellerId !== session.user.id) {
    return NextResponse.json({ error: 'Listing access denied' }, { status: 403 })
  }

  // On-chain verification — never trust a client-supplied hash blindly.
  if (txHash) {
    const verification = await verifyListingTransaction(txHash)
    if (!verification.ok) {
      return NextResponse.json(
        { error: `Activation transaction verification failed: ${verification.reason}` },
        { status: 400 }
      )
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'txHash is required to activate a listing' }, { status: 400 })
  }

  const result = await db().updateDoc('nft_listings', id, {
    status: 'active',
    txHash: txHash || null,
    updatedAt: new Date()
  })

  if (!result.success) {
    throw result.error || new Error('Failed to update listing')
  }

  return NextResponse.json({ success: true })
}
