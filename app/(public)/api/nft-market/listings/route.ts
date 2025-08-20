import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { getServerAuthSession } from '@/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  const status = searchParams.get('status') || 'active'
  const limit = Number(searchParams.get('limit') || 12)
  const db = await getAdminDb()
  const col = db.collection('nft_listings')
  let q = col.where('status', '==', status)
  if (username) q = q.where('sellerUsername', '==', username)
  const snap = await q.limit(Math.max(1, Math.min(100, limit))).get()
  const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession()
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

  const db = await getAdminDb()
  const col = db.collection('nft_listings')
  const now = new Date()
  // Create draft listing
  const draft = await col.add({
    sellerUserId: session.user.id,
    sellerUsername: sellerUsername || session.user.username || null,
    item,
    price,
    status: 'draft',
    createdAt: now,
    updatedAt: now
  })

  return NextResponse.json({ success: true, id: draft.id })
}


