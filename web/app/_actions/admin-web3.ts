'use server'

/**
 * Admin Web3 server actions — mint and burn for the native token (RING).
 *
 * Mint: creates new tokens into the treasury ATA, increasing total supply.
 * Burn: destroys tokens from the treasury ATA, decreasing total supply.
 *
 * Both actions require superadmin auth and a funded fee payer (SOL for gas).
 * Uses the existing Solana infrastructure from features/wallet/chains/solana/.
 */

import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import { getFeePayerKeypair, getSolanaConnection } from '@/features/wallet/chains/solana/solana-client'
import { getNativeTokenAddress, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { getOrCreateAssociatedTokenAccount, mintTo, burn, getMint } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { revalidatePath } from 'next/cache'

async function assertSuperadmin() {
  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    throw new Error('Forbidden: superadmin only')
  }
  return session
}

// ── Mint ─────────────────────────────────────────────────────────────────────

export async function adminMintRING(amountUi: string): Promise<{
  success: boolean
  txHash?: string
  newSupply?: string
  error?: string
}> {
  try {
    await assertSuperadmin()

    const decimals = getNativeTokenDecimals()
    if (decimals == null) throw new Error('Native token decimals not configured')

    const mintAddress = getNativeTokenAddress()
    if (!mintAddress) throw new Error('Native token address not configured')

    const amountNum = parseFloat(amountUi)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const connection = getSolanaConnection()
    const feePayer = getFeePayerKeypair()
    const mint = new PublicKey(mintAddress)
    const treasury = feePayer // treasury IS the fee payer (same key)

    // Ensure treasury ATA exists
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      mint,
      treasury.publicKey,
    )

    // Convert UI amount → raw (BigInt)
    const rawAmount = BigInt(Math.floor(amountNum * (10 ** decimals)))

    const sig = await mintTo(
      connection,
      feePayer,
      mint,
      treasuryAta.address,
      treasury, // mint authority
      rawAmount,
    )

    // Read new supply
    const mintInfo = await getMint(connection, mint)
    const newSupply = (Number(mintInfo.supply) / (10 ** decimals)).toLocaleString()

    revalidatePath('/admin/web3')
    return { success: true, txHash: sig, newSupply }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mint failed'
    return { success: false, error: message }
  }
}

// ── Burn ─────────────────────────────────────────────────────────────────────

export async function adminBurnRING(amountUi: string): Promise<{
  success: boolean
  txHash?: string
  newSupply?: string
  error?: string
}> {
  try {
    await assertSuperadmin()

    const decimals = getNativeTokenDecimals()
    if (decimals == null) throw new Error('Native token decimals not configured')

    const mintAddress = getNativeTokenAddress()
    if (!mintAddress) throw new Error('Native token address not configured')

    const amountNum = parseFloat(amountUi)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const connection = getSolanaConnection()
    const feePayer = getFeePayerKeypair()
    const mint = new PublicKey(mintAddress)
    const treasury = feePayer

    // Resolve treasury ATA
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      mint,
      treasury.publicKey,
    )

    const rawAmount = BigInt(Math.floor(amountNum * (10 ** decimals)))

    const sig = await burn(
      connection,
      feePayer,
      treasuryAta.address,
      mint,
      treasury, // owner (treasury ATA)
      rawAmount,
    )

    const mintInfo = await getMint(connection, mint)
    const newSupply = (Number(mintInfo.supply) / (10 ** decimals)).toLocaleString()

    revalidatePath('/admin/web3')
    return { success: true, txHash: sig, newSupply }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Burn failed'
    return { success: false, error: message }
  }
}
