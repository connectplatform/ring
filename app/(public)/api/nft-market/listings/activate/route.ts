import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'


// Marks a draft listing as active after on-chain tx confirmation
export async function POST(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { id, txHash } = body as { id: string, txHash?: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  
  await initializeDatabase()
  const db = getDatabaseService()
  
  const result = await db.update('nft_listings', id, { 
    status: 'active', 
    txHash: txHash || null, 
    updatedAt: new Date() 
  })
  
  if (!result.success) {
    throw result.error || new Error('Failed to update listing')
  }
  
  return NextResponse.json({ success: true })
}
