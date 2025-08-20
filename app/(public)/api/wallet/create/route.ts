import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { createWallet } from "@/features/wallet/services/create-wallet";
import { Wallet } from '@/features/auth/types';

/**
 * API route handler for creating a new wallet
 * 
 * This function handles POST requests to create a new wallet for authenticated users.
 * It performs the following steps:
 * 1. Authenticates the user using Auth.js
 * 2. Extracts the optional label from the request body
 * 3. Calls the createWallet service to create a new wallet
 * 4. Returns the new wallet information or an error response
 * 
 * User steps:
 * 1. User must be authenticated before calling this endpoint
 * 2. Frontend sends a POST request to /api/wallet/create with an optional label in the body
 * 3. If successful, frontend receives the new wallet information
 * 4. If an error occurs, frontend receives an error message
 * 
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object
 * 
 * Request body:
 * {
 *   label?: string // Optional label for the new wallet
 * }
 * 
 * Successful response body:
 * {
 *   wallet: Wallet // The newly created wallet object
 * }
 * 
 * Error response body:
 * {
 *   error: string // Error message
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('API: /api/wallet/create - Starting POST request');

  try {
    // Step 1: Authenticate the user
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/wallet/create - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`API: /api/wallet/create - User authenticated with ID: ${session.user.id}`);

    // Step 2: Extract the optional label from the request body
    const { label } = await request.json();

    // Step 3: Call the createWallet service
    console.log('API: /api/wallet/create - Calling createWallet service');
    const newWallet: Wallet = await createWallet(label);

    // Step 4: Return the new wallet information
    console.log(`API: /api/wallet/create - Wallet created successfully for user ${session.user.id}`);
    return NextResponse.json({ wallet: newWallet });

  } catch (error) {
    console.error('API: /api/wallet/create - Error creating wallet:', error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message === 'Unauthorized: Please log in to create a wallet') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      } else if (error.message === 'Access denied: Visitors cannot create wallets') {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      } else if (error.message === 'Wallet encryption key is not set') {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
    }

    // Generic error response
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';