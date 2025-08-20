import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthSession } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'

export const dynamic = 'force-dynamic'

// Marks a draft listing as active after on-chain tx confirmation
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { id, txHash } = body as { id: string, txHash?: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const db = await getAdminDb()
  const ref = db.collection('nft_listings').doc(id)
  await ref.set({ status: 'active', txHash: txHash || null, updatedAt: new Date() }, { merge: true })
  return NextResponse.json({ success: true })
}


