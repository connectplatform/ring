#!/usr/bin/env node

/**
 * deploy-ring-token.mjs — One-shot Solana SPL token deployment script.
 *
 * Sources token economics from DAAR.sol (daarion/daarion-token/contracts/DAAR.sol)
 * adapted for Solana SPL:
 *   Name:     RING
 *   Symbol:   RING
 *   Decimals: 8 (per ring-config.json chains.solana.tokenDecimals)
 *   Supply:   1,000,000 RING (100_000_000_000_000 raw units)
 *
 * Pre-requisites (set in environment before running):
 *   SOLANA_RPC_URL=https://api.devnet.solana.com
 *   SOLANA_FEE_PAYER_PRIVATE_KEY=<base58 secret key>
 *   SOLANA_TREASURY_PRIVATE_KEY=<base58 secret key, can be same as fee payer>
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | sed 's/^export //' | xargs)
 *   node scripts/solana/deploy-ring-token.mjs
 *
 * Outputs the deployed mint address to stdout — copy into ring-config.json:
 *   tokens.native.address = <mint>
 *   chains.solana.tokenAddress = <mint>
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from '@solana/spl-token'
import bs58 from 'bs58'

// ── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
const FEE_PAYER_KEY = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY
const TREASURY_KEY = process.env.SOLANA_TREASURY_PRIVATE_KEY

if (!FEE_PAYER_KEY) {
  console.error('❌ SOLANA_FEE_PAYER_PRIVATE_KEY not set in environment')
  console.error('   Run: export $(grep -v "^#" .env.local | sed "s/^export //" | xargs)')
  process.exit(1)
}

const treasurySecret = TREASURY_KEY || FEE_PAYER_KEY

function keypairFromSecret(secret) {
  const s = secret.trim()
  // Support both base58 and JSON Uint8Array formats (matching solana-client.ts)
  if (s.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)))
  }
  return Keypair.fromSecretKey(bs58.decode(s))
}

const feePayer = keypairFromSecret(FEE_PAYER_KEY)
const treasury = keypairFromSecret(treasurySecret)

// Token parameters (sourced from DAAR.sol + ring-config.json)
const TOKEN_DECIMALS = 8
const INITIAL_SUPPLY_UI = 1_000_000 // 1 million RING
const INITIAL_SUPPLY_RAW = BigInt(INITIAL_SUPPLY_UI) * (10n ** BigInt(TOKEN_DECIMALS))

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('⚔️  LegioX Commander — RING Token Deployment on Solana Devnet')
  console.log('──────────────────────────────────────────────────────────')
  console.log(`   Fee payer: ${feePayer.publicKey.toBase58()}`)
  console.log(`   Treasury:  ${treasury.publicKey.toBase58()}`)
  console.log(`   RPC:       ${RPC_URL}`)
  console.log('')

  const connection = new Connection(RPC_URL, 'confirmed')

  // Balance check
  const balance = await connection.getBalance(feePayer.publicKey)
  const solBalance = balance / 1_000_000_000
  console.log(`💰 Fee payer balance: ${solBalance.toFixed(4)} SOL`)
  if (balance < 50_000_000) {
    console.error('❌ Insufficient SOL balance — fund wallet first (solana airdrop 2)')
    process.exit(1)
  }

  // ── Step 1: Create SPL Mint ───────────────────────────────────────────────
  console.log('\n🔨 Step 1: Creating SPL mint...')
  const mint = await createMint(
    connection,
    feePayer,
    treasury.publicKey, // mint authority
    null,               // freeze authority (none)
    TOKEN_DECIMALS,
  )
  const mintAddress = mint.toBase58()
  console.log(`   ✅ Mint created: ${mintAddress}`)

  const mintInfo = await getMint(connection, mint)
  console.log(`   → Decimals:       ${mintInfo.decimals}`)
  console.log(`   → Supply:         ${mintInfo.supply}`)
  console.log(`   → Mint authority: ${mintInfo.mintAuthority?.toBase58() || '(none)'}`)
  console.log(`   → Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`)

  // ── Step 2: Create Treasury ATA ───────────────────────────────────────────
  console.log('\n🔨 Step 2: Creating Treasury Associated Token Account...')
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    feePayer,
    mint,
    treasury.publicKey,
  )
  console.log(`   ✅ Treasury ATA: ${treasuryAta.address.toBase58()}`)

  // ── Step 3: Mint Initial Supply ───────────────────────────────────────────
  console.log('\n🔨 Step 3: Minting initial supply...')
  console.log(`   Amount: ${INITIAL_SUPPLY_UI.toLocaleString()} RING (${INITIAL_SUPPLY_RAW} raw units)`)

  const mintSig = await mintTo(
    connection,
    feePayer,
    mint,
    treasuryAta.address,
    treasury, // mint authority
    INITIAL_SUPPLY_RAW,
  )
  console.log(`   ✅ Minted! Tx: ${mintSig}`)

  const finalMint = await getMint(connection, mint)
  const finalSupplyUi = Number(finalMint.supply) / (10 ** TOKEN_DECIMALS)
  console.log(`   → Final supply: ${finalSupplyUi.toLocaleString()} RING`)

  // ── Step 4: Output config snippet ─────────────────────────────────────────
  console.log('')
  console.log('📋 ── ring-config.json UPDATE ──')
  console.log('   Copy these values into ring-config.json:')
  console.log('')
  console.log(`   tokens.native.address    = "${mintAddress}"`)
  console.log(`   chains.solana.tokenAddress  = "${mintAddress}"`)
  console.log(`   chains.solana.treasuryAddress = "${treasury.publicKey.toBase58()}"`)
  console.log('')
  console.log('⚔️  FLAWLESS VICTORY — RING deployed on Solana devnet!')
  console.log(`   Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`)
}

main().catch((err) => {
  console.error('❌ Deployment failed:', err)
  process.exit(1)
})
