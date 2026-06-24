#!/usr/bin/env tsx
/**
 * Create RING SPL mint on Solana devnet (8 decimals).
 *
 * Usage:
 *   SOLANA_TREASURY_PRIVATE_KEY=<base58> npx tsx scripts/solana/create-ring-mint.ts
 *
 * Outputs mint pubkey — paste into ring-config.json chains.solana.mintAddress
 *
 * Mainnet: transfer mint authority to Squads multisig before public launch.
 */
import {
  Connection,
  Keypair,
  clusterApiUrl,
} from '@solana/web3.js'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'
import bs58 from 'bs58'

const DECIMALS = 8
const NETWORK = process.env.SOLANA_NETWORK ?? 'devnet'
const RPC = process.env.SOLANA_RPC_URL ?? clusterApiUrl(NETWORK as 'devnet' | 'mainnet-beta')

function loadKeypair(envName: string): Keypair {
  const raw = process.env[envName]
  if (!raw) {
    throw new Error(`${envName} is required`)
  }
  const secret = raw.startsWith('[')
    ? Uint8Array.from(JSON.parse(raw) as number[])
    : bs58.decode(raw)
  return Keypair.fromSecretKey(secret)
}

async function main() {
  const treasury = loadKeypair('SOLANA_TREASURY_PRIVATE_KEY')
  const connection = new Connection(RPC, 'confirmed')

  console.log(`Network: ${NETWORK}`)
  console.log(`Treasury: ${treasury.publicKey.toBase58()}`)

  const mint = await createMint(
    connection,
    treasury,
    treasury.publicKey,
    treasury.publicKey,
    DECIMALS,
  )

  console.log(`\n✅ RING SPL mint created: ${mint.toBase58()}`)
  console.log(`\nAdd to ring-config.json:\n  "mintAddress": "${mint.toBase58()}"`)

  // Seed treasury ATA with 1M RING for devnet testing
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey,
  )

  const seedAmount = 1_000_000n * 10n ** BigInt(DECIMALS)
  await mintTo(connection, treasury, mint, treasuryAta.address, treasury, seedAmount)
  console.log(`Treasury ATA seeded with 1,000,000 RING for devnet testing`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
