import { getServerAuthSession } from "@/auth"
import { UserRole } from '@/features/auth/types'
import { getAdminDb } from '@/lib/firebase-admin.server'

/**
 * Interface for wallet information returned by the service
 */
export interface WalletInfo {
  address: string;
  isPrimary: boolean;
  label?: string;
  createdAt?: string;
  balance?: string;
}

/**
 * Lists all wallets for the authenticated user
 * 
 * This service function retrieves all wallets associated with the authenticated user.
 * 
 * User steps:
 * 1. User must be authenticated before this function is called
 * 2. The function retrieves the user's data from Firestore
 * 3. The function formats and returns the list of wallets
 * 
 * @returns {Promise<WalletInfo[]>} A promise that resolves to an array of wallet objects
 * @throws {Error} If the user is not authenticated or if there's an error retrieving the wallets
 */
export async function listWallets(): Promise<WalletInfo[]> {
  console.log('Services: listWallets - Starting wallet listing process')

  // Step 1: Authenticate the user
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    console.log('Services: listWallets - Unauthorized access attempt')
    throw new Error('Unauthorized: Please log in to list wallets')
  }

  const userId = session.user.id
  const userRole = session.user.role as UserRole

  console.log(`Services: listWallets - User authenticated with ID: ${userId} and role: ${userRole}`)

  // Step 2: Retrieve user data from Firestore
  const adminDb = await getAdminDb()
  if (!adminDb) {
    throw new Error('Firestore instance is null')
  }

  const userDoc = await adminDb.collection('users').doc(userId).get()
  const userData = userDoc.data()

  if (!userData) {
    console.log(`Services: listWallets - User not found for ID: ${userId}`)
    throw new Error('User not found')
  }

  // Step 3: Format and return the list of wallets
  const wallets: WalletInfo[] = [
    { address: userData.walletAddress, isPrimary: true },
    ...(userData.additionalWallets || []).map((wallet: any) => ({ ...wallet, isPrimary: false }))
  ]

  console.log(`Services: listWallets - Retrieved ${wallets.length} wallets for user ${userId}`)
  return wallets
}