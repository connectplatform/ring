import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { listWallets } from '@/features/wallet/services/list-wallets'

/**
 * GET handler for listing user wallets
 * 
 * This API route handles the retrieval of a user's wallets using the listWallets service.
 * 
 * User steps:
 * 1. User must be authenticated before calling this endpoint
 * 2. Frontend sends a GET request to /api/wallet/list
 * 3. If successful, frontend receives an array of wallet objects
 * 4. If an error occurs, frontend receives an error message
 * 
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  await connection() // Next.js 16: auth()/headers() requires dynamic opt-out
  console.log('API: /api/wallet/list - Starting GET request')

  try {
    // Call the listWallets service to retrieve the user's wallets
    const wallets = await listWallets()
    
    console.log(`API: /api/wallet/list - Successfully retrieved ${wallets.length} wallets`)
    return NextResponse.json({ wallets })

  } catch (error) {
    // Error handling
    console.error('API: /api/wallet/list - Error occurred:', error)
    
    if (error instanceof Error) {
      // Handle specific error cases
      switch (error.message) {
        case 'Unauthorized: Please log in to list wallets':
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        case 'User not found':
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        case 'Firestore instance is null':
          return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Failed to fetch user wallets' }, { status: 500 })
  }
}

/**
 * Prevent caching for this route
 * This is important for wallet operations which should always return fresh data
 */
