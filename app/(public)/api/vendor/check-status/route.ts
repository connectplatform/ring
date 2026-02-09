import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Check if user is already a vendor
    const vendorResult = await db.query({
      collection: 'entities',
      filters: [
        { field: 'data.addedby', operator: '==', value: session.user.id },
        { field: 'data.entityType', operator: '==', value: 'vendor' }
      ]
    })

    if (!vendorResult.success) {
      console.error('Error checking vendor status:', vendorResult.error)
      return NextResponse.json(
        { error: 'Failed to check vendor status' },
        { status: 500 }
      )
    }

    const isVendor = vendorResult.data.length > 0

    return NextResponse.json({
      isVendor,
      vendorCount: vendorResult.data.length,
      canBecomeVendor: !isVendor
    })

  } catch (error) {
    console.error('Error in vendor check-status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
