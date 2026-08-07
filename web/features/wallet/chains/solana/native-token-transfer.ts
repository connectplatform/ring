import 'server-only'

// Solana and SPL token utilities.
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token'
import type { Wallet } from '@/features/auth/types'
import { getNativeChainConfig, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { getNativeTokenAddress, getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { decryptSolanaWalletSecretKey } from '@/lib/wallet/decrypt-user-wallet'
import { assertFeePayerGasReserve } from './solana-gas-reserve'
import { getFeePayerKeypair, getMintPublicKey, getSolanaConnection } from './solana-client'
import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'

/**
 * Returns the Solana Keypair for the given wallet after decrypting its private key.
 * 
 * @param wallet - The wallet (should be on 'solana' chain, must have encryptedPrivateKey)
 * @returns Keypair instance for the wallet
 * @throws {Error} If wallet is not Solana, or encryption key is missing
 */
function getSenderKeypair(wallet: Wallet): Keypair {
  // Check the chain type for the wallet. If chain is null/undefined, default to
  // DEFAULT_WALLET_CHAIN (SSOT — features/wallet/types/wallet.ts).
  if ((wallet.chain ?? DEFAULT_WALLET_CHAIN) !== 'solana') {
    // Only Solana wallets are allowed
    throw new Error('Sender wallet is not a Solana wallet')
  }

  // Retrieve encryption key from the environment. Ensures sensitive material is not hard-coded.
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  // Decrypt private key using configured encryptionKey, returns Buffer/Uint8Array secretKey.
  const secretKey = decryptSolanaWalletSecretKey(wallet.encryptedPrivateKey, encryptionKey)
  return Keypair.fromSecretKey(secretKey)
}

/**
 * Queries and returns the native token balance for a wallet.
 * 
 * @param walletAddress - String public key of user's wallet.
 * @returns String RING token balance (uiAmountString format, default '0' if unavailable)
 */
export async function getNativeTokenBalance(walletAddress: string): Promise<string> {
  // Retrieve the native token mint address from the config.
  const mintAddress = getNativeTokenAddress()
  if (!mintAddress) {
    // If not configured, the wallet holds 0 RING.
    return '0'
  }

  // Get blockchain connection and public key constructions.
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const owner = new PublicKey(walletAddress)
  // Derive the user's associated token address for the mint.
  const ata = getAssociatedTokenAddressSync(mint, owner)

  try {
    // Query balance for user's associated token account.
    const account = await connection.getTokenAccountBalance(ata)
    // Return as UI string. Might be undefined if account not found.
    return account.value.uiAmountString ?? '0'
  } catch (e) {
    // Fail softly, 0 if ATA does not exist yet or account not found.
    return '0'
  }
}

/**
 * Transfers RING tokens on Solana from an authenticated user wallet to a destination address.
 * 
 * Preconditions:
 *  - The Solana ring-config allows sponsored transfers.
 *  - The fee payer has enough gas for the transaction.
 * 
 * @param params - { senderWallet, toAddress, amount }
 *   senderWallet: Wallet - wallet to send from (must have chain = 'solana' and valid key)
 *   toAddress: string - public key recipient
 *   amount: string — raw integer in token smallest units (convert UI via nativeTokenUiToRaw first)
 * @returns { txHash, fromAddress }
 */
export async function transferNativeToken(params: {
  senderWallet: Wallet
  toAddress: string
  /** Raw token amount as decimal integer string (not UI units). */
  amount: string
}): Promise<{ txHash: string; fromAddress: string }> {
  // Get chain config, check if sponsored transfers are enabled for Solana.
  const chains = getNativeChainConfig()
  if (!chains.solana?.sponsorAllNativeTokenTransfers) {
    throw new Error('Solana sponsored transfers are disabled in ring-config')
  }

  // Ensure fee payer account reserves enough gas for a token transfer.
  await assertFeePayerGasReserve(getNativeTokenSymbol())

  // Construct core transaction entities and parameters.
  // mintAddress: new PublicKey instance for RING SPL token
  const mintAddress = new PublicKey(getNativeTokenAddress())
  // Get RPC connection
  const connection = getSolanaConnection()
  // Number of decimals for the token (for the transfer)
  const decimals = getNativeTokenDecimals()
  // The gas-sponsoring fee payer Keypair
  const feePayer = getFeePayerKeypair()
  // The sending user Keypair (decrypted from wallet)
  const sender = getSenderKeypair(params.senderWallet)
  // The recipient public key
  const recipient = new PublicKey(params.toAddress)

  // Derive sender and recipient Associated Token Accounts (ATA) for this mint.
  const senderAta = getAssociatedTokenAddressSync(mintAddress, sender.publicKey)
  const recipientAta = getAssociatedTokenAddressSync(mintAddress, recipient)

  // Construct transaction object and set who pays for fees (the feePayer).
  const tx = new Transaction()
  tx.feePayer = feePayer.publicKey

  // Only create ATA when missing — idempotent create still costs CU when present.
  const recipientAtaInfo = await connection.getAccountInfo(recipientAta, 'confirmed')
  if (!recipientAtaInfo) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer.publicKey,
        recipientAta,
        recipient,
        mintAddress,
      ),
    )
  }

  tx.add(
    createTransferCheckedInstruction(
      senderAta,
      mintAddress,
      recipientAta,
      sender.publicKey,
      BigInt(params.amount),
      decimals,
    ),
  )

  // Fetch latest blockhash and validity for transaction lifetime.
  // TODO: Instead of two awaits, cache/reuse return value if possible
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight

  // Partially sign the transaction with both sender and fee payer.
  tx.partialSign(sender)
  tx.partialSign(feePayer)

  // Actually send transaction to Solana and wait for confirmation.
  const signature = await sendAndConfirmTransaction(connection, tx, [feePayer, sender], {
    commitment: 'confirmed',
  })

  // Return transaction hash and the sender wallet's address.
  return {
    txHash: signature,
    fromAddress: params.senderWallet.address,
  }
}

export class GasReserveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GasReserveError'
  }
}