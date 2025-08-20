import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance } from '@/features/wallet/services/get-wallet-balance'

/**
 * API route handler for fetching the wallet balance of the authenticated user.
 * 
 * This function handles GET requests to retrieve a user's wallet balance.
 * It uses the getWalletBalance service which handles authentication internally.
 * 
 * User steps:
 * 1. Client sends a GET request to /api/wallet/balance
 * 2. The handler calls the getWalletBalance service
 * 3. If successful, it returns the balance
 * 
 * @param request - The incoming NextRequest object
 * @returns A NextResponse object with the wallet balance or an error message
 * 
 * Error Handling:
 * - 401 Unauthorized: If the user is not authenticated
 * - 404 Not Found: If the user's wallet is not found
 * - 500 Internal Server Error: For any other errors
 */
export async function GET(request: NextRequest) {
  console.log('API: /api/wallet/balance - Starting GET request');

  try {
    const balance = await getWalletBalance();
    console.log('API: /api/wallet/balance - Balance fetched successfully');
    return NextResponse.json({ balance });
  } catch (error) {
    console.error("API: /api/wallet/balance - Error processing request:", error);
    
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Please log in to fetch wallet balance') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else if (error.message === 'User wallet not found') {
        return NextResponse.json({ error: "User wallet not found" }, { status: 404 });
      }
    }
    
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

/**
 * Prevent caching for this route to ensure fresh wallet balance data on every request
 */
export const dynamic = 'force-dynamic';