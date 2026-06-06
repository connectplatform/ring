import { NextRequest, NextResponse, connection} from 'next/server'
import { createWalletClient, createPublicClient, http, formatEther, parseEther, isAddress } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { auth } from "@/auth"
import { decryptPrivateKey } from '@/lib/crypto'

/**
 * POST handler for transferring native tokens (POL/MATIC) from user's wallet
 *
 * Modern Web3 implementation using viem for type-safe blockchain interactions.
 * This route handles server-side transaction signing for user wallets.
 *
 * Security considerations:
 * - Private keys are encrypted at rest
 * - Transactions are signed server-side (consider user-side signing for better UX)
 * - Rate limiting and transaction monitoring should be implemented
 *
 * @param request - Contains toAddress and amount in JSON body
 * @returns Transaction hash on success, error message on failure
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const startTime = Date.now()
  console.log('🚀 API: /api/wallet/transfer - Starting native token transfer')

  try {
    // 1. Authenticate user session
    const session = await auth()
    if (!session?.user?.id) {
      console.log('❌ API: /api/wallet/transfer - Authentication failed')
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const { toAddress, amount, tokenSymbol = 'POL' } = body

    // Input validation
    if (!toAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: toAddress and amount', code: 'INVALID_PARAMS' },
        { status: 400 }
      )
    }

    if (!isAddress(toAddress)) {
      return NextResponse.json(
        { error: 'Invalid recipient address format', code: 'INVALID_ADDRESS' },
        { status: 400 }
      )
    }

    // Parse and validate amount
    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid transfer amount', code: 'INVALID_AMOUNT' },
        { status: 400 }
      )
    }

    // For now, only support native POL transfers
    if (tokenSymbol !== 'POL') {
      return NextResponse.json(
        { error: 'Only native POL transfers supported', code: 'UNSUPPORTED_TOKEN' },
        { status: 400 }
      )
    }

    console.log(`📋 API: /api/wallet/transfer - Processing transfer: ${amount} ${tokenSymbol} to ${toAddress}`)

    // 3. Retrieve and validate user wallet
    await initializeDatabase()
    const db = getDatabaseService()
    
    const userResult = await db.read('users', session.user.id)

    if (!userResult.success || !userResult.data) {
      console.log('❌ API: /api/wallet/transfer - User document not found')
      return NextResponse.json(
        { error: 'User wallet not configured', code: 'WALLET_NOT_FOUND' },
        { status: 404 }
      )
    }

    const userData = userResult.data as any
    const wallets = userData?.wallets || []

    if (!wallets.length) {
      return NextResponse.json(
        { error: 'No wallets configured for user', code: 'NO_WALLETS' },
        { status: 404 }
      )
    }

    // Find default wallet or use first available
    const wallet = wallets.find((w: any) => w.isDefault) || wallets[0]

    if (!wallet?.encryptedPrivateKey || !wallet?.address) {
      return NextResponse.json(
        { error: 'Wallet configuration incomplete', code: 'WALLET_INCOMPLETE' },
        { status: 500 }
      )
    }

    // 4. Decrypt private key following Secrets Keeper protocols
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
    if (!encryptionKey) {
      console.error('SECRETS KEEPER: WALLET_ENCRYPTION_KEY not configured - CRITICAL SECURITY BREACH')
      return NextResponse.json(
        { error: 'Server security configuration error', code: 'SECRETS_KEEPER_CONFIG_ERROR' },
        { status: 500 }
      )
    }

    let privateKey: `0x${string}`
    try {
      console.log('SECRETS KEEPER: Initiating private key decryption for wallet transfer')
      privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, encryptionKey)

      // Secrets Keeper: Audit trail - log successful decryption without exposing key
      console.log(`SECRETS KEEPER: Private key decrypted successfully for wallet ${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`)

    } catch (decryptError) {
      // Secrets Keeper: Security incident logging
      console.error(`SECRETS KEEPER: CRITICAL - Private key decryption failed for wallet ${wallet.address}:`, {
        error: decryptError.message,
        walletId: wallet.address,
        timestamp: new Date().toISOString(),
        action: 'wallet_transfer_attempt',
        severity: 'CRITICAL'
      })

      return NextResponse.json(
        { error: 'Wallet security access failed', code: 'SECRETS_KEEPER_DECRYPTION_FAILED' },
        { status: 500 }
      )
    }

    // 5. Initialize viem wallet client
    const account = privateKeyToAccount(privateKey)

    // Verify the account matches the stored address
    if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error('❌ API: /api/wallet/transfer - Address mismatch in decrypted wallet')
      return NextResponse.json(
        { error: 'Wallet integrity check failed', code: 'ADDRESS_MISMATCH' },
        { status: 500 }
      )
    }

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    // 6. Execute the transfer
    console.log('⚡ API: /api/wallet/transfer - Sending transaction...')

    const value = parseEther(amount)

    const hash = await walletClient.sendTransaction({
      to: toAddress as `0x${string}`,
      value: value,
    } as any)

    console.log(`✅ API: /api/wallet/transfer - Transaction sent: ${hash}`)

    // 7. Wait for transaction confirmation using public client
    // Create a public client for reading transaction receipts
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status === 'success') {
      const duration = Date.now() - startTime
      console.log(`🎉 API: /api/wallet/transfer - Transfer completed in ${duration}ms: ${hash}`)

      return NextResponse.json({
        success: true,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        amount: amount,
        tokenSymbol,
        toAddress,
        fromAddress: wallet.address,
        timestamp: new Date().toISOString(),
        processingTime: duration
      })
    } else {
      throw new Error('Transaction failed on-chain')
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ API: /api/wallet/transfer - Transfer failed after ${duration}ms:`, error)

    // Enhanced error handling
    if (error instanceof Error) {
      // Viem-specific errors
      if (error.message.includes('insufficient funds')) {
        return NextResponse.json(
          { error: 'Insufficient funds for transfer', code: 'INSUFFICIENT_FUNDS' },
          { status: 400 }
        )
      }

      if (error.message.includes('nonce too low') || error.message.includes('replacement transaction underpriced')) {
        return NextResponse.json(
          { error: 'Transaction conflict. Please try again.', code: 'NONCE_ERROR' },
          { status: 409 }
        )
      }

      if (error.message.includes('gas required exceeds allowance')) {
        return NextResponse.json(
          { error: 'Transaction would exceed gas limit', code: 'GAS_LIMIT_EXCEEDED' },
          { status: 400 }
        )
      }

      // Generic error fallback
      return NextResponse.json(
        { error: 'Transaction failed', details: error.message, code: 'TRANSACTION_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Unexpected error occurred', code: 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * @param toAddress - The Ethereum address to send funds to
 * @param amount - The amount of Ether to send, as a string (e.g., "0.1" for 0.1 ETH)
 */

