import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

// Allow caching for individual NFT listings with moderate revalidation for marketplace data
export const dynamic = 'auto'
export const revalidate = 120 // 2 minutes for marketplace data

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(() => ({}))

  await initializeDatabase()
  const db = getDatabaseService()

  const result = await db.update('nft_listings', id, { ...body, updatedAt: new Date() })
  if (!result.success) {
    throw result.error || new Error('Failed to update nft_listing')
  }

  return NextResponse.json({ success: true })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await initializeDatabase()
  const db = getDatabaseService()

  const result = await db.findById('nft_listings', params.id)
  if (!result.success) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: result.data })
}


