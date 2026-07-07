import 'server-only' // Ensures this module is only imported server-side (utilizes Next.js functionality)

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { getNativeChainConfig } from '@/lib/ring-config-chain'

/**
 * Initializes and returns a Solana network connection.
 * - Fetches chain config using getNativeChainConfig().
 * - Determines RPC node URL, using env variables or default devnet endpoint as fallback.
 * - Uses the desired commitment level from chain config, or defaults to 'confirmed'.
 * - Returns a new Connection object for interacting with the Solana network.
 * 
 * TODO: Optimize reading config variables at build time with Next.js 16's 'app' directory conventions if possible.
 */
export function getSolanaConnection(): Connection {
  const chains = getNativeChainConfig() // Loads chain config (reads from config file or env)
  // Prefer explicit env var, then config key, then fallback to devnet
  const rpc =
    process.env.SOLANA_RPC_URL ||
    process.env[chains.solana?.rpcUrlEnv ?? 'SOLANA_RPC_URL'] ||
    'https://api.devnet.solana.com'
  const commitment = chains.solana?.commitment ?? 'confirmed'
  return new Connection(rpc, commitment)
}

/**
 * Returns a Keypair for the configured Solana fee payer.
 * - Reads the private key from environment variable.
 * - Throws if not defined (fee payer is required).
 * - Supports both base58 and array-of-bytes JSON encodings.
 * - Returns a Keypair object instantiated from the decoded secret.
 */
export function getFeePayerKeypair(): Keypair {
  const key = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY
  if (!key) {
    throw new Error('SOLANA_FEE_PAYER_PRIVATE_KEY not configured')
  }

  // If key starts with '[', assume it's a JSON array (Uint8Array), else assume base58 string encoding.
  const secret = key.startsWith('[')
    ? Uint8Array.from(JSON.parse(key) as number[])
    : bs58.decode(key)

  return Keypair.fromSecretKey(secret)
}

/**
 * Returns a Keypair for the configured Solana treasury, or null if not set.
 * - Reads the treasury key from environment. If not present, returns null (optional).
 * - Supports both array-of-bytes JSON and base58 encodings.
 * - Returns a Keypair object or null.
 * 
 * TODO: Consider stricter validation/error reporting in production for treasury key.
 */
export function getTreasuryKeypair(): Keypair | null {
  const key = process.env.SOLANA_TREASURY_PRIVATE_KEY
  if (!key) return null

  // Choose decoding method as in getFeePayerKeypair.
  const secret = key.startsWith('[')
    ? Uint8Array.from(JSON.parse(key) as number[])
    : bs58.decode(key)

  return Keypair.fromSecretKey(secret)
}

/**
 * Returns a Solana PublicKey object from a string representation.
 * - Accepts a base58 address string.
 * - Wraps with web3.js PublicKey type for API compatibility.
 */
export function getMintPublicKey(mintAddress: string): PublicKey {
  return new PublicKey(mintAddress)
}
