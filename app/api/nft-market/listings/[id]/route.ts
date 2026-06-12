import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Allow caching for individual NFT listings with moderate revalidation for marketplace data

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(() => ({}))

  const result = await db().updateDoc('nft_listings', id, { ...body, updatedAt: new Date() })
  if (!result.success) {
    throw result.error || new Error('Failed to update nft_listing')
  }

  return NextResponse.json({ success: true })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await db().findDocById('nft_listings', params.id)
  if (!result.success || !result.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
