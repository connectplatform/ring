import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/auth"
import { 
  getWalletHistory, 
  getUserWalletAddress, 
  TransactionFilter 
} from '@/features/wallet/services/wallet-history'

/**
 * GET handler for fetching wallet transaction history
 * 
 * This function handles GET requests to retrieve a user's wallet transaction history.
 * It performs the following steps:
 * 1. Authenticates the user
 * 2. Retrieves and validates query parameters
 * 3. Fetches the user's wallet address from Firestore
 * 4. Retrieves transaction history using the wallet-history service
 * 5. Applies pagination to the results
 * 6. Returns the paginated transaction history
 * 
 * @param request - The incoming NextRequest object
 * @returns A NextResponse object with the transaction history or an error message
 */
export async function GET(request: NextRequest) {
  console.log('API: /api/wallet/history - Starting GET request');

  try {
    // Step 1: Authenticate the user
    const session = await auth()
    if (!session || !session.user) {
      console.log('API: /api/wallet/history - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log(`API: /api/wallet/history - User authenticated with ID: ${userId}`);

    // Step 2: Retrieve and validate query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
    const filter: TransactionFilter = {
      startBlock: searchParams.get('startBlock') ? parseInt(searchParams.get('startBlock')!, 10) : undefined,
      endBlock: searchParams.get('endBlock') ? parseInt(searchParams.get('endBlock')!, 10) : undefined,
      type: searchParams.get('type') || undefined,
      minAmount: searchParams.get('minAmount') || undefined,
      maxAmount: searchParams.get('maxAmount') || undefined,
    }

    console.log('API: /api/wallet/history - Query parameters:', { page, pageSize, filter });

    // Step 3: Fetch user's wallet address
    const walletAddress = await getUserWalletAddress(userId)
    if (!walletAddress) {
      console.log('API: /api/wallet/history - User wallet not found');
      return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
    }

    console.log(`API: /api/wallet/history - User wallet address: ${walletAddress}`);

    // Step 4: Get wallet transaction history
    const transactions = await getWalletHistory(walletAddress, filter)

    // Step 5: Apply pagination
    const paginatedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize)

    console.log(`API: /api/wallet/history - Returning ${paginatedTransactions.length} transactions`);

    // Step 6: Return the paginated transaction history
    return NextResponse.json({
      history: paginatedTransactions,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(transactions.length / pageSize),
        totalItems: transactions.length
      }
    })
  } catch (error) {
    console.error('API: /api/wallet/history - Error:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction history' }, { status: 500 })
  }
}

/**
 * Prevent caching for this route
 * This is important for wallet operations which should always be fresh
 */
export const dynamic = 'force-dynamic'