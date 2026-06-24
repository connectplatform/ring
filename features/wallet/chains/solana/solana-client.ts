import 'server-only'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { getRingChainConfig } from '@/lib/ring-config-chain'

export function getSolanaConnection(): Connection {
  const chains = getRingChainConfig()
  const rpc =
    process.env.SOLANA_RPC_URL ||
    process.env[chains.solana?.rpcUrlEnv ?? 'SOLANA_RPC_URL'] ||
    'https://api.devnet.solana.com'
  const commitment = chains.solana?.commitment ?? 'confirmed'
  return new Connection(rpc, commitment)
}

export function getFeePayerKeypair(): Keypair {
  const key = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY
  if (!key) {
    throw new Error('SOLANA_FEE_PAYER_PRIVATE_KEY not configured')
  }

  const secret = key.startsWith('[')
    ? Uint8Array.from(JSON.parse(key) as number[])
    : bs58.decode(key)

  return Keypair.fromSecretKey(secret)
}

export function getTreasuryKeypair(): Keypair | null {
  const key = process.env.SOLANA_TREASURY_PRIVATE_KEY
  if (!key) return null

  const secret = key.startsWith('[')
    ? Uint8Array.from(JSON.parse(key) as number[])
    : bs58.decode(key)

  return Keypair.fromSecretKey(secret)
}

export function getMintPublicKey(mintAddress: string): PublicKey {
  return new PublicKey(mintAddress)
}
