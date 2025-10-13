import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getListings, createListingDraft } from '@/features/nft-market/services/listing-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') || undefined
  const status = searchParams.get('status') || 'active'
  const limit = Number(searchParams.get('limit') || 12)

  const result = await getListings({
    username,
    status,
    limit: Math.max(1, Math.min(100, limit))
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { item, price, sellerUsername } = body as any
  if (!item?.address || !item?.tokenId || !item?.standard) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
  }
  if (!price?.amount || !price?.currency) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
  }

  // Use the migrated createListingDraft service
  const result = await createListingDraft({
    sellerUsername: sellerUsername || session.user.username || '',
    item,
    price
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: result.id })
}


