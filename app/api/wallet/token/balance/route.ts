import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getNativeTokenBalanceForUser } from '@/features/wallet/chains/native-token-transfer-service'

// Handles GET requests for user's native token balance
export async function GET() {
  // Ensure database connection is established before further operations
  await connection() // TODO: If possible, switch to next-server's built-in middleware for DB connection handling in Next16

  try {
    // Authenticate the user and retrieve session
    const session = await auth() // TODO: Replace with cookies().get('session') and Next.js 16 authentication methods if available for improved performance
    
    // If the user is not authenticated, respond with 401 Unauthorized
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Query the native token balance for the authenticated user
    const result = await getNativeTokenBalanceForUser(session.user.id) // TODO: Consider caching balance with Next16 cache API for infrequent balance changes
    return NextResponse.json(result)
  } catch (error) {
    // Parse the error message for more specific handling
    const message = error instanceof Error ? error.message : 'Failed to fetch RING balance'
    if (message.includes('not found')) {
      // Return 404 if resource not found (could mean user wallet doesn't exist, etc.)
      return NextResponse.json(
        { error: message },
        { status: 404 }
      )
    }
    // Log other errors for server-side debugging
    console.error('GET /api/wallet/ring/balance failed:', error)
    // Return generic 500 error for all other exceptions
    return NextResponse.json(
      { error: 'Failed to fetch RING balance' },
      { status: 500 }
    )
  }
}
