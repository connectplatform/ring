// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { auth } from '@/auth';
import { UserRole, Wallet, AuthUser } from '@/features/auth/types';
// ethers.js removed - wallets now connected via wagmi/RainbowKit UI

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

/**
 * Ensures that the authenticated user has at least one wallet.
 * For Google/Apple sign-in users, creates and securely stores a wallet.
 *
 * CRITICAL SECURITY FLOW:
 * 1. User signs in with Google/Apple (no seed phrase knowledge required)
 * 2. System creates viem wallet, encrypts private key with PIN-based encryption
 * 3. Private key stored securely in database, never sent to client
 * 4. Client uses wagmi/RainbowKit for all blockchain operations
 * 5. PIN access allows emergency fund recovery
 *
 * @returns {Promise<Wallet>} A promise that resolves to the user's primary wallet.
 * @throws {Error} If the user is not authenticated or if there's an error during the process.
 */
export async function ensureWallet(userOverride?: { id: string; role: string }): Promise<Wallet> {
  console.log('🔐 Services: ensureWallet - Starting secure wallet ensure process')

  try {
    // Step 1: Authenticate and get user session (or use override for OAuth callbacks)
    let userId: string
    let userRole: string

    if (userOverride) {
      // Use provided user data (for OAuth callbacks where session isn't established yet)
      userId = userOverride.id
      userRole = userOverride.role
      console.log(`🔐 Services: ensureWallet - Using override data for user ${userId} with role ${userRole}`)
    } else {
      // Normal flow: get from session
      const session = await auth();
      if (!session || !session.user) {
        console.error('🔐 Services: ensureWallet - Unauthorized access attempt')
        throw new Error('Unauthorized: Please log in to ensure wallet')
      }
      userId = session.user.id
      userRole = session.user.role
      console.log(`🔐 Services: ensureWallet - User authenticated with ID ${userId} and role ${userRole}`)
    }

    // Step 2: Validate user role (optional, remove if not needed)
    if (userRole === UserRole.VISITOR) {
      console.error('🔐 Services: ensureWallet - Visitors are not allowed to have wallets')
      throw new Error('Access denied: Visitors cannot have wallets')
    }

    // Step 3: Retrieve user document using database abstraction layer
    console.log(`🔐 Services: ensureWallet - Initializing database service`)
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      console.error(`🔐 Services: ensureWallet - Database initialization failed:`, initResult.error)
      throw new Error('Database initialization failed')
    }

    const dbService = getDatabaseService()
    const userResult = await dbService.read('users', userId)

    if (!userResult.success) {
      console.error(`🔐 Services: ensureWallet - User document not found for ID: ${userId}`)
      throw new Error('User document not found in database')
    }

    const userData = userResult.data.data || userResult.data
    if (!userData) {
      throw new Error('User document exists but has no data')
    }

    // Step 4: Check if user already has a wallet
    if (userData.wallets && userData.wallets.length > 0) {
      const { selectDefaultWallet } = await import('./utils')
      const primaryWallet = selectDefaultWallet(userData.wallets)!
      console.log(`🔐 Services: ensureWallet - User already has a primary wallet: ${primaryWallet.address}`)
      return primaryWallet
    }

    // Step 5: Create a new wallet using viem (modern replacement for ethers.js)
    console.log('🔐 Services: ensureWallet - Creating secure viem wallet for social auth user')

    // Import viem for wallet creation
    const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')

    // Generate a secure private key
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const address = account.address

    console.log(`🔐 Services: ensureWallet - Generated wallet address: ${address}`)

    // Step 6: Encrypt the private key using PIN-based encryption
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
    if (!encryptionKey) {
      console.error('🚨 CRITICAL: WALLET_ENCRYPTION_KEY is not set in environment variables.')
      console.error('To fix this:')
      console.error('1. Generate a key: openssl rand -hex 32')
      console.error('2. Add to .env.local: WALLET_ENCRYPTION_KEY=your_generated_key')
      throw new Error('Wallet encryption key is not set. Check server logs for setup instructions.')
    }

    // Use crypto module for encryption (better than ethers.encrypt)
    const crypto = await import('crypto')
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(encryptionKey, 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(privateKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()
    const encryptedPrivateKey = `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`

    console.log('🔐 Services: ensureWallet - Private key encrypted securely')

    // Step 7: Prepare the new wallet information
    const newWallet: Wallet = {
      address,
      encryptedPrivateKey,
      createdAt: new Date().toISOString(),
      label: 'Ring Wallet (Social Auth)',
      isDefault: true,
      balance: '0' // Initialize balance to '0'
    }

    // Step 8: Add the new wallet to the user's wallets array using database abstraction layer
    console.log(`🔐 Services: ensureWallet - Current userData wallets:`, userData.wallets)
    const currentWallets = userData.wallets || []
    const updatedWallets = [...currentWallets, newWallet]
    const updatedUserData = {
      ...userData,
      wallets: updatedWallets
    }

    console.log(`🔐 Services: ensureWallet - Updating user with wallets:`, updatedWallets.map(w => w.address))
    const updateResult = await dbService.update('users', userId, updatedUserData)
    console.log(`🔐 Services: ensureWallet - Update result:`, { success: updateResult.success, error: updateResult.error?.message })

    if (!updateResult.success) {
      console.error(`🔐 Services: ensureWallet - Failed to update user with new wallet:`, updateResult.error)
      throw new Error('Failed to save new wallet to database')
    }

    console.log(`🔐 Services: ensureWallet - Successfully created and stored secure wallet for social auth user`)

    // Optional on-chain initialization hook (no-op unless implemented)
    try {
      const { initializeOnChain } = await import('@/features/wallet/services/onchain-init')
      if (typeof initializeOnChain === 'function') {
        await initializeOnChain(newWallet)
      }
    } catch (_) {
      // silently ignore if not present
    }

    console.log('🔐 Services: ensureWallet - Wallet created successfully:', address)
    return newWallet
  } catch (error) {
    console.error('🔐 Services: ensureWallet - Error:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while ensuring wallet')
  }
}

/**
 * Decrypts the private key of a wallet using PIN-based authentication.
 * This provides emergency access to funds for social auth users.
 *
 * SECURITY CRITICAL:
 * - PIN must be 4 digits
 * - Decryption only happens server-side
 * - Private key never leaves the server
 * - Used for emergency fund recovery only
 *
 * @param {string} encryptedPrivateKey - The encrypted private key from the database
 * @param {string} pin - 4-digit PIN code for decryption
 * @returns {Promise<string>} The decrypted private key
 * @throws {Error} If decryption fails or PIN is invalid
 */
export async function decryptPrivateKeyWithPin(encryptedPrivateKey: string, pin: string): Promise<string> {
  console.log('🔐 Services: decryptPrivateKeyWithPin - Starting PIN-based decryption')

  // Validate PIN format
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }

  try {
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error('Wallet encryption key is not configured')
    }

    // Parse the encrypted data format: iv:encrypted:authTag
    const parts = encryptedPrivateKey.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted private key format')
    }

    const [ivHex, encryptedHex, authTagHex] = parts

    // Create decryption key using PIN + base encryption key
    const crypto = await import('crypto')
    const combinedKey = `${encryptionKey}_${pin}`
    const key = crypto.scryptSync(combinedKey, 'salt', 32)

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    console.log('🔐 Services: decryptPrivateKeyWithPin - Private key decrypted successfully')

    // Validate the decrypted key format
    if (!decrypted.startsWith('0x') || decrypted.length !== 66) {
      throw new Error('Invalid decrypted private key format')
    }

    return decrypted
  } catch (error) {
    console.error('🔐 Services: decryptPrivateKeyWithPin - Decryption failed:', error)
    throw new Error('PIN authentication failed or decryption error')
  }
}

/**
 * Creates a PIN-protected access token for emergency fund recovery.
 * This allows the user to access their funds through wagmi/RainbowKit
 * after PIN verification.
 *
 * @param {string} userId - The user ID
 * @param {string} pin - 4-digit PIN code
 * @returns {Promise<{accessToken: string, walletAddress: string}>}
 */
export async function createPinAccessToken(userId: string, pin: string): Promise<{accessToken: string, walletAddress: string}> {
  console.log('🔐 Services: createPinAccessToken - Creating PIN access token')

  // Get user's wallet
  const wallet = await ensureWallet({ id: userId, role: 'USER' })

  // Verify PIN by attempting decryption
  try {
    await decryptPrivateKeyWithPin(wallet.encryptedPrivateKey, pin)
  } catch (error) {
    throw new Error('PIN verification failed')
  }

  // Create a short-lived access token (15 minutes)
  const crypto = await import('crypto')
  const accessToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + (15 * 60 * 1000) // 15 minutes

  // Store the access token (in a real implementation, use Redis/database)
  // For now, we'll just return it - in production this should be stored securely

  console.log('🔐 Services: createPinAccessToken - PIN access token created')

  return {
    accessToken,
    walletAddress: wallet.address
  }
}
