import 'server-only' // Ensures this file is only used on the server side

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getFeePayerKeypair, getSolanaConnection } from './solana-client'

// Custom error for problems with the gas (SOL) reserve on the fee payer account
export class GasReserveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GasReserveError'
  }
}

// The minimum amount of SOL (as decimal) to be kept for the fee payer
const DEFAULT_MIN_SOL = 0.05

/**
 * Gets the minimum SOL reserve value.
 * Priority:
 *   1. Uses the environment variable SOLANA_FEE_PAYER_MIN_SOL if set and valid
 *   2. Falls back to the DEFAULT_MIN_SOL constant
 */
export function getMinSolReserve(): number {
  const raw = process.env.SOLANA_FEE_PAYER_MIN_SOL
  if (!raw) return DEFAULT_MIN_SOL // No env: use default
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_SOL // Invalid env: use default
}

/**
 * Gets the fee payer SOL balance and reserve status.
 * Returns:
 *   - address (string): base58 pubkey
 *   - lamports (number): raw lamport value
 *   - sol (number): lamports divided by LAMPORTS_PER_SOL
 *   - minSol (number): min threshold value
 *   - healthy (boolean): true if sol >= minSol
 */
export async function getFeePayerSolBalance(): Promise<{
  address: string
  lamports: number
  sol: number
  minSol: number
  healthy: boolean
}> {
  // Get the keypair to sign/identify the fee payer
  const feePayer = getFeePayerKeypair()
  const connection = getSolanaConnection()
  // Query lamport (base unit) balance
  const lamports = await connection.getBalance(feePayer.publicKey)
  // Convert to SOL
  const sol = lamports / LAMPORTS_PER_SOL
  // Get minimal threshold
  const minSol = getMinSolReserve()

  return {
    address: feePayer.publicKey.toBase58(),
    lamports,
    sol,
    minSol,
    // Healthy: meets or exceeds the minSol threshold
    healthy: sol >= minSol,
  }
}

/**
 * Throws GasReserveError if the fee payer has insufficient SOL balance.
 * Allows specifying which token is being sent for clearer error messages.
 * @param tokenSymbol - The token intended for transfer
 * @throws GasReserveError if not enough SOL or if misconfigured
 */
export async function assertFeePayerGasReserve(tokenSymbol: string): Promise<void> {
  try {
    // Check the reserve status
    const reserve = await getFeePayerSolBalance()
    if (!reserve.healthy) {
      // Not enough SOL, throw specific error with refill instructions
      throw new GasReserveError(
        `No more gas. Add SOL to fee payer wallet to enable ${tokenSymbol} transfers.`,
      )
    }
  } catch (error) {
    // If the error is already a GasReserveError, rethrow as-is
    if (error instanceof GasReserveError) {
      throw error
    }
    // If error message is likely from missing config (private key), provide operator advice
    if (error instanceof Error && error.message.includes('SOLANA_FEE_PAYER')) {
      throw new GasReserveError(
        `Add SOLANA_FEE_PAYER_PRIVATE_KEY to enable ${tokenSymbol} transfers.`,
      )
    }
    // Unknown error, rethrow original for diagnostics
    throw error
  }
}
