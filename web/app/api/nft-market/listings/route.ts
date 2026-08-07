import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { createListingDraft } from '@/features/nft-market/services/listing-service'
import { getNftMarketListings } from '@/features/nft-market/services/listing-query'
import type { NftListingStatus, NftMarketListingFilters } from '@/features/nft-market/types'


export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const { searchParams } = new URL(req.url)
  const filters: NftMarketListingFilters = {
    q: searchParams.get('q') || undefined,
    collection: searchParams.get('collection') || undefined,
    slug: searchParams.get('slug') || undefined,
    sellerUsername: searchParams.get('username') || undefined,
    status: (searchParams.get('status') || 'active') as NftListingStatus,
    startAfter: searchParams.get('startAfter') || searchParams.get('cursor') || undefined,
    limit: Math.max(1, Math.min(100, Number(searchParams.get('limit') || 24))),
    sort: (searchParams.get('sort') || 'newest') as NftMarketListingFilters['sort'],
  }

  const result = await getNftMarketListings(filters)

  return NextResponse.json({
    success: true,
    data: result.items,
    items: result.items,
    cursor: result.nextCursor,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  })
}

export async function POST(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  // Prefer server actions (`listGateListingAction`) for sell wizard.
  // This route accepts Solana-shaped drafts only; legacy EVM item payloads are rejected.
  if (body?.item?.standard === 'ERC721' || body?.item?.standard === 'ERC1155') {
    return NextResponse.json(
      {
        error:
          'EVM listings are quarantined. Use Solana KEYS gate listing via /nft/market/sell or listGateListingAction.',
      },
      { status: 410 },
    )
  }

  const asset = typeof body.asset === 'string' ? body.asset.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const priceRing =
    typeof body.priceRing === 'string'
      ? body.priceRing.trim()
      : typeof body.price?.amount === 'string'
        ? body.price.amount.trim()
        : ''

  if (!asset || !slug || !priceRing) {
    return NextResponse.json(
      { error: 'asset, slug and priceRing are required' },
      { status: 400 },
    )
  }

  const result = await createListingDraft({
    sellerUserId: session.user.id,
    sellerUsername: body.sellerUsername || session.user.username || '',
    asset,
    slug,
    priceRing,
    metadataUri: body.metadataUri,
    imageUri: body.imageUri,
    licenseExpiresAt: body.licenseExpiresAt,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: result.id, data: result.data })
}


