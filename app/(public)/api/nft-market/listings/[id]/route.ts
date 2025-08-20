import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin.server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(() => ({}))
  const db = await getAdminDb()
  const ref = db.collection('nft_listings').doc(id)
  await ref.set({ ...body, updatedAt: new Date() }, { merge: true })
  return NextResponse.json({ success: true })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getAdminDb()
  const snap = await db.collection('nft_listings').doc(params.id).get()
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { id: snap.id, ...(snap.data() as any) } })
}


