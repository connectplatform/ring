import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { auth } from "@/auth"
import { FieldValue } from 'firebase-admin/firestore'

/**
 * Global declaration for the wallet list cache
 * This cache is used to store wallet lists for quick access
 */
declare global {
  var walletListCache: Map<string, any> | undefined
}

/**
 * POST handler for setting a new primary wallet
 * 
 * This API route handles the process of changing a user's primary wallet.
 * It performs the following steps:
 * 1. Authenticates the user
 * 2. Validates the request body
 * 3. Retrieves the user's data from Firestore
 * 4. Checks if the requested wallet exists and is not already the primary
 * 5. Swaps the primary wallet with the selected additional wallet
 * 6. Updates the user's document in Firestore
 * 7. Clears the cache for this user in the wallet list endpoint
 * 
 * User steps:
 * 1. User must be authenticated before calling this endpoint
 * 2. User sends a POST request to /api/wallet/set-primary with the wallet address in the request body
 * 3. If successful, the user's primary wallet is updated
 * 
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('API: /api/wallet/set-primary - Starting POST request')

  try {
    // Step 1: Authenticate the user
    const session = await auth()
    if (!session || !session.user) {
      console.log('API: /api/wallet/set-primary - Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log(`API: /api/wallet/set-primary - User authenticated with ID: ${userId}`)

    // Step 2: Validate the request body
    const { address } = await request.json()
    if (!address) {
      console.log('API: /api/wallet/set-primary - Missing address in request body')
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    console.log(`API: /api/wallet/set-primary - Requested to set primary wallet: ${address}`)

    // Step 3: Retrieve user data from Firestore
    const adminDb = await getAdminDb()
    const userDoc = await adminDb.collection('users').doc(userId)
    const userData = (await userDoc.get()).data()

    if (!userData) {
      console.log(`API: /api/wallet/set-primary - User not found: ${userId}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Step 4: Check if the requested wallet is already the primary
    if (userData.walletAddress === address) {
      console.log('API: /api/wallet/set-primary - Requested wallet is already the primary wallet')
      return NextResponse.json({ message: 'This wallet is already the primary wallet' })
    }

    // Step 5: Find the requested wallet in the additional wallets list
    const additionalWallet = userData.additionalWallets?.find((w: any) => w.address === address)

    if (!additionalWallet) {
      console.log(`API: /api/wallet/set-primary - Requested wallet not found: ${address}`)
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Step 6: Swap the primary and the selected additional wallet
    const oldPrimary = {
      address: userData.walletAddress,
      encryptedPrivateKey: userData.encryptedPrivateKey,
      createdAt: userData.createdAt
    }

    // Update the user document with the new primary wallet
    await userDoc.update({
      walletAddress: address,
      encryptedPrivateKey: additionalWallet.encryptedPrivateKey,
      additionalWallets: userData.additionalWallets.filter((w: any) => w.address !== address)
    })

    // Add the old primary wallet to the additional wallets list
    await userDoc.update({
      additionalWallets: FieldValue.arrayUnion(oldPrimary)
    })

    console.log(`API: /api/wallet/set-primary - Primary wallet updated to: ${address}`)

    // Step 7: Clear the cache for this user in the wallet list endpoint
    if (global.walletListCache) {
      global.walletListCache.delete(userId)
      console.log(`API: /api/wallet/set-primary - Cleared cache for user: ${userId}`)
    }

    return NextResponse.json({ message: 'Primary wallet updated successfully' })
  } catch (error) {
    console.error('API: /api/wallet/set-primary - Error setting primary wallet:', error)
    return NextResponse.json({ error: 'Failed to set primary wallet' }, { status: 500 })
  }
}

