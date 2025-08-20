import { NextRequest, NextResponse } from 'next/server'
import { ensureWallet } from '@/features/wallet/services/ensure-wallet'

/**
 * POST handler for ensuring a user has a wallet
 * 
 * This API route uses the ensureWallet service to check if a user has a wallet and create one if it doesn't exist.
 * 
 * User steps:
 * 1. User must be authenticated before calling this endpoint
 * 2. Frontend sends a POST request to /api/wallet/ensure
 * 3. If successful, frontend receives the wallet address (existing or new)
 * 4. If an error occurs, frontend receives an error message
 * 
 * @param request The incoming NextRequest object
 * @returns NextResponse with the wallet address or an error message
 */
export async function POST(request: NextRequest) {
  console.log('API: /api/wallet/ensure - Starting POST request')

  try {
    const address = await ensureWallet()
    console.log(`API: /api/wallet/ensure - Wallet ensured successfully: ${address}`)
    return NextResponse.json({ address })
  } catch (error) {
    console.error('API: /api/wallet/ensure - Error ensuring user wallet:', error)
    
    if (error instanceof Error) {
      switch (error.message) {
        case 'Unauthorized: Please log in to ensure a wallet':
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        case 'Access denied: Visitors cannot have wallets':
          return NextResponse.json({ error: 'Visitors cannot have wallets' }, { status: 403 })
        case 'User document not found in Firestore':
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to ensure user wallet' }, { status: 500 })
  }
}

/**
 * Handles OPTIONS requests for CORS preflight
 * 
 * @param request The incoming NextRequest object
 * @returns NextResponse with appropriate CORS headers
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

/**
 * Prevent caching for this route
 * This is important for wallet operations which should always be fresh
 */
export const dynamic = 'force-dynamic'