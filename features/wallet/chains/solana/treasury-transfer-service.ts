import 'server-only' // Enforce this file only runs on Next.js server (Next 13+ feature).

import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction, // For creating/updating ATA safely
  createBurnCheckedInstruction, // To burn SPL tokens with checked decimals/mint
  createTransferCheckedInstruction, // To transfer SPL tokens with checked decimals/mint
  getAssociatedTokenAddressSync, // Synchronously get an Account Address for Mint/Owner
  getMint, // Get mint info (decimals, etc.)
} from '@solana/spl-token'
import type { Wallet } from '@/features/auth/types'
import {
  assertMainnetHotKeyAllowed, // For gating sensitive operations on mainnet
  getNativeChainConfig, // Fetch platform-supported native chain configs
  getNativeTokenAddress, // Helper for fetching RING token mint public key (Solana)
  getNativeTokenDecimals, // Helper to get token decimals (fallback/default)
  getNativeTokenSymbol,
} from '@/lib/ring-config-chain'
import { decryptSolanaWalletSecretKey } from '@/lib/wallet/decrypt-user-wallet'
import { assertFeePayerGasReserve } from './solana-gas-reserve'
import {
  getFeePayerKeypair, // Keypair that pays for transaction fee, for sponsored txs
  getMintPublicKey, // Mint address conversion utility
  getSolanaConnection, // Get the RPC connection to Solana
  getTreasuryKeypair, // House wallet for treasury ops
} from './solana-client'
import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'

/**
 * Helper to derive a Solana user Keypair from the encrypted Wallet.
 * Throws if not Solana or if env/config missing.
 */
function getUserKeypair(wallet: Wallet): Keypair {
  // Make sure the wallet is for Solana chain, fallback to default chain if not specified
  if ((wallet.chain ?? DEFAULT_WALLET_CHAIN) !== 'solana') {
    throw new Error('Wallet is not a Solana wallet')
  }
  // Require encryption key in the environment for user secret keys decryption
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }
  // Decrypt user's secret key and construct Solana Keypair
  const secretKey = decryptSolanaWalletSecretKey(wallet.encryptedPrivateKey, encryptionKey)
  return Keypair.fromSecretKey(secretKey)
}

/**
 * Helper to retrieve and assert that the Solana treasury keypair is configured.
 * Throws if keypair is not present or not permitted by environment toggle.
 */
function requireTreasuryKeypair(): Keypair {
  assertMainnetHotKeyAllowed('treasury_transfer') // Ensure mainnet usage allowed in env
  const treasury = getTreasuryKeypair()
  if (!treasury) {
    throw new Error('SOLANA_TREASURY_PRIVATE_KEY not configured')
  }
  return treasury
}

/**
 * Generic utility to build and submit a Solana transaction with sponsored gas.
 * - Prepares and partially signs transaction with provided signers + fee payer.
 * - Adds all instructions (ATA create, transfers, etc).
 * - Checks gas reserve before processing.
 * Returns the transaction hash on success.
 */
async function buildSponsoredTx(
  instructions: Parameters<Transaction['add']>[0][], // Solana ix array
  signers: Keypair[], // Keypairs to sign (e.g., treasury or user)
): Promise<string> {
  const chains = getNativeChainConfig()
  // Ensure sponsoring is enabled before proceeding.
  if (!chains.solana?.sponsorAllNativeTokenTransfers) {
    throw new Error('Solana sponsored transfers are disabled')
  }

  // Ensure gas/funding available for off-chain fee payer. Throws if insufficient.
  await assertFeePayerGasReserve(getNativeTokenSymbol())
  const connection = getSolanaConnection()
  const feePayer = getFeePayerKeypair()
  const tx = new Transaction()
  tx.feePayer = feePayer.publicKey
  // Add all prepared Solana instructions to the transaction
  for (const ix of instructions) {
    tx.add(ix)
  }

  // Set blockhash & expiry for tx validity
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight

  // Unique signers: fee payer + all distinct explicit signers.
  const uniqueSigners: Keypair[] = [feePayer]
  for (const signer of signers) {
    // Only add a signer if their public key is not already included (prevents duplicate sigs)
    if (!uniqueSigners.some((s) => s.publicKey.equals(signer.publicKey))) {
      uniqueSigners.push(signer)
    }
  }
  // Partial sign with all required signers so client can send fully signed transaction
  for (const signer of uniqueSigners) {
    tx.partialSign(signer)
  }

  // Actually submit and await confirmation of transaction
  return sendAndConfirmTransaction(connection, tx, uniqueSigners, { commitment: 'confirmed' })
}

/**
 * Transfer tokens from the treasury to a recipient address.
 * - Ensures treasury and mint info loaded.
 * - Builds ATA for treasury and user.
 * - Submits sponsored tx with transfer instruction.
 */
export async function transferTokenFromTreasury(
  toAddress: string,
  amountRaw: bigint,
): Promise<{ txHash: string; fromAddress: string }> {
  // Get native token mint address (RING SPL)
  const mintAddress = getNativeTokenAddress()
  if (!mintAddress) {
    throw new Error('Solana native token mint address not configured')
  }

  // Load up treasury and associated keys
  const treasury = requireTreasuryKeypair()
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getNativeTokenDecimals()
  // Get authoritative decimals from on-chain mint account, fallback to config decimals
  const mintInfo = await getMint(connection, mint)
  const tokenDecimals = mintInfo.decimals ?? decimals

  // Resolve Solana Account addresses for sender (treasury) and recipient ATA
  const recipient = new PublicKey(toAddress)
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient)
  const feePayer = getFeePayerKeypair() // For paying transaction gas

  // Build and send sponsored transaction
  const txHash = await buildSponsoredTx(
    [
      // Always try to create recipient's ATA in idempotent fashion
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer.publicKey,
        recipientAta,
        recipient,
        mint,
      ),
      // Transfer tokens with checked decimals and authority
      createTransferCheckedInstruction(
        treasuryAta,
        mint,
        recipientAta,
        treasury.publicKey,
        amountRaw,
        tokenDecimals,
      ),
    ],
    [treasury], // Treasury key signs as source authority
  )

  return { txHash, fromAddress: treasury.publicKey.toBase58() }
}

/**
 * Transfer tokens from a user's wallet to the treasury.
 * - Ensures user and treasury keypairs are loaded.
 * - Derives ATAs and builds transfer instructions.
 * - Transaction fees are paid by fee payer (sponsored).
 */
export async function transferTokenToTreasury(
  userWallet: Wallet,
  amountRaw: bigint,
): Promise<{ txHash: string; toAddress: string }> {
  // Get mint address for the on-chain token
  const mintAddress = getNativeTokenAddress()
  if (!mintAddress) {
    throw new Error('Solana native token mint address not configured')
  }

  // Prepare treasury and user keypairs/accounts
  const treasury = requireTreasuryKeypair()
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getNativeTokenDecimals()
  const mintInfo = await getMint(connection, mint)
  const tokenDecimals = mintInfo.decimals ?? decimals

  const user = getUserKeypair(userWallet)
  const feePayer = getFeePayerKeypair()
  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey)
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)

  // Build transaction with safe ATA creation and transfer
  const txHash = await buildSponsoredTx(
    [
      // Guarantee that treasury's ATA exists (idempotent, so safe even if already exists)
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer.publicKey,
        treasuryAta,
        treasury.publicKey,
        mint,
      ),
      createTransferCheckedInstruction(
        userAta,
        mint,
        treasuryAta,
        user.publicKey,
        amountRaw,
        tokenDecimals,
      ),
    ],
    [user], // User signs off as source
  )

  return { txHash, toAddress: treasury.publicKey.toBase58() }
}

/**
 * Burns a specified amount of SPL tokens from the user's wallet/account.
 * - Permission-gated to mainnet permission allowed (e.g. for admin or reward reduction flows).
 * - Destroys tokens from user's account with full decimal enforcement.
 */
export async function burnTokenFromUser(
  userWallet: Wallet,
  amountRaw: bigint,
): Promise<{ txHash: string }> {
  assertMainnetHotKeyAllowed('burn') // Ensure mainnet operation allowed by config
  const mintAddress = getNativeTokenAddress()
  if (!mintAddress) {
    throw new Error('Solana native token mint address not configured')
  }

  // Resolve mint and user account addresses
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const tokenDecimals = getNativeTokenDecimals()
  const mintInfo = await getMint(connection, mint)
  const user = getUserKeypair(userWallet)
  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey)

  // Only build single burn instruction
  const txHash = await buildSponsoredTx(
    [createBurnCheckedInstruction(userAta, mint, user.publicKey, amountRaw, tokenDecimals)],
    [user], // User must sign for burning from their account
  )

  return { txHash }
}

// TODO: Consider using React/Next.js Server Actions where possible, e.g. for transaction-building logic using new Next.js 13+ server action patterns to allow fine-grained server access control.
// TODO: Factor out duplicate mint/decimals/account loading between transferTokenFromTreasury and transferTokenToTreasury as a utility hook/fn to DRY up logic.
// TODO: Potential for cross-chain/generic sponsorship abstraction: provide a common sponsoredTx interface for all chains and future proof this codebase.