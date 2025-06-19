import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { auth } from "@/auth"

/**
 * POST handler for transferring funds from user's wallet
 * 
 * This API route handles the transfer of funds from a user's wallet to another address.
 * It performs the following steps:
 * 1. Authenticates the user
 * 2. Validates the request parameters
 * 3. Retrieves the user's wallet information
 * 4. Initializes the Ethereum provider and wallet
 * 5. Executes the transfer transaction
 * 6. Returns the transaction hash or an error response
 * 
 * User steps:
 * 1. User must be authenticated before calling this endpoint
 * 2. User sends a POST request to /api/wallet/transfer with toAddress and amount in the request body
 * 3. If successful, user receives the transaction hash
 * 4. If an error occurs, user receives an error message
 * 
 * @param request The incoming NextRequest object
 * @returns NextResponse with the transaction hash or an error message
 */
export async function POST(request: NextRequest) {
  console.log('API: /api/wallet/transfer - Starting POST request')

  try {
    // Step 1: Authenticate the user
    const session = await auth()
    if (!session || !session.user) {
      console.log('API: /api/wallet/transfer - Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`API: /api/wallet/transfer - User authenticated with ID: ${session.user.id}`)

    // Step 2: Parse and validate the request body
    const { toAddress, amount } = await request.json()

    if (!toAddress || !amount) {
      console.log('API: /api/wallet/transfer - Missing required parameters')
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    console.log('API: /api/wallet/transfer - Request parameters', { toAddress, amount })

    // Step 3: Retrieve user's wallet information
    const adminDb = await getAdminDb()
    const userDoc = await adminDb.collection('users').doc(session.user.id).get()
    const userData = userDoc.data()

    if (!userData?.encryptedPrivateKey) {
      console.log('API: /api/wallet/transfer - User wallet not found')
      return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
    }

    // Step 4: Initialize Ethereum provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
    if (!provider) {
      throw new Error('Failed to initialize Ethereum provider')
    }

    // SECURITY NOTE: In a production environment, you should use a secure key management system
    // to store and retrieve private keys, rather than storing them directly in the database.
    const wallet = new ethers.Wallet(userData.encryptedPrivateKey, provider)

    // Step 5: Execute the transfer transaction
    console.log('API: /api/wallet/transfer - Initiating transfer')
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount)
    })

    // Wait for the transaction to be mined
    await tx.wait()

    console.log('API: /api/wallet/transfer - Transfer successful', { txHash: tx.hash })

    // Step 6: Return the transaction hash
    return NextResponse.json({ txHash: tx.hash })

  } catch (error) {
    console.error('API: /api/wallet/transfer - Error transferring funds:', error)

    // Error handling
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        return NextResponse.json({ error: 'Insufficient funds for transfer' }, { status: 400 })
      }
      if (error.message.includes('nonce too low')) {
        return NextResponse.json({ error: 'Transaction nonce error. Please try again.' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Failed to transfer funds' }, { status: 500 })
  }
}

/**
 * @param toAddress - The Ethereum address to send funds to
 * @param amount - The amount of Ether to send, as a string (e.g., "0.1" for 0.1 ETH)
 */

