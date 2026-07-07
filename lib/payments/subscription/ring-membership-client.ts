/**
 * Membership Client — main entrypoint for on-chain invocation of the Membership program.
 *
 * Single Source of Truth (SSOT) dependencies:
 *   - getSolanaConnection / getFeePayerKeypair / getTreasuryKeypair: abstracted Solana client
 *   - assertFeePayerGasReserve: ensures feePayer wallet is funded for sponsoring
 *   - getNativeTokenAddress: platform native token mint address helper
 *   - assertMainnetSafeForSubscriptionTx: network safety check for critical ops
 *
 * This client assumes Membership is a Solang-compiled Solidity program; thus,
 * function dispatch uses a Solang ABI selector convention:
 *   - 4-byte Big-Endian selector + parameter encoding.
 *   - Instruction dispatch by selector hash.
 *
 * Method selectors used (see contract for canonical signatures):
 *   createSubscription() → 0x4d962f3a
 *   cancelSubscription() → 0xb6f1eb20
 *   renewSubscription() → 0x84a15da1
 *   processBatchPayments(uint256) → 0xc1cf1f87
 *   getSubscription(address) → 0x5b0ec24b
 *   hasActiveMembership(address) → 0x2cb5f4d8
 *   getDuePayments(uint256) → 0x91e9f76b
 *   suspendSubscription(address) → 0x6b1a3c3f
 *   reactivateSubscription(address) → 0x4f3a3e2c
 *
 * @see contracts/Membership.sol
 * @see AI-LEGIOX/legiox-truth-lens/solana-anchor-program-security.nodus.json
 */

import 'server-only'

import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { logger } from '@/lib/logger'
import {
  getSolanaConnection,
  getFeePayerKeypair,
  getTreasuryKeypair,
} from '@/features/wallet/chains/solana/solana-client'
import { assertFeePayerGasReserve } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { decryptSolanaWalletSecretKey } from '@/lib/wallet/decrypt-user-wallet'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { getNativeTokenAddress } from '@/lib/ring-config-chain'
import type { Wallet } from '@/features/auth/types'
import {
  getMembershipProgramId,
  assertMainnetSafeForSubscriptionTx,
  logMembershipOp,
} from './ring-membership-config'

// ---------------------------------------------------------------------------
// Solang ABI method selectors (4-byte Big-Endian, mapped from function sigs)
// ---------------------------------------------------------------------------
const SELECTORS = {
  createSubscription: 0x4d962f3a,
  cancelSubscription: 0xb6f1eb20,
  renewSubscription: 0x84a15da1,
  processBatchPayments: 0xc1cf1f87,
  getSubscription: 0x5b0ec24b,
  hasActiveMembership: 0x2cb5f4d8,
  getDuePayments: 0x91e9f76b,
  suspendSubscription: 0x6b1a3c3f,
  reactivateSubscription: 0x4f3a3e2c,
} as const

// ---------------------------------------------------------------------------
// ABI encoders (Solang-compatible: types to 32-bytes Big-Endian Buffer)
// ---------------------------------------------------------------------------

/**
 * Encodes a uint256 as a 32-byte Big-Endian Buffer.
 */
function encodeUint256(value: bigint): Buffer {
  const buf = Buffer.alloc(32)
  let v = value
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}

/**
 * Encodes a Solana PublicKey as a Solidity address (32 bytes left-padded by 12 zeroes).
 */
function encodeAddress(pubkey: PublicKey): Buffer {
  // First 12 bytes zero, then 20 bytes (public key)
  return Buffer.concat([Buffer.alloc(12), pubkey.toBuffer()])
}

/**
 * Encodes the 4-byte method selector for the provided method name.
 */
function encodeSelector(name: keyof typeof SELECTORS): Buffer {
  return Buffer.from(Uint8Array.from([
    (SELECTORS[name] >> 24) & 0xff,
    (SELECTORS[name] >> 16) & 0xff,
    (SELECTORS[name] >> 8) & 0xff,
    SELECTORS[name] & 0xff,
  ]))
}

/**
 * Builds a TransactionInstruction with encoded selector and params.
 */
function buildInstruction(
  method: keyof typeof SELECTORS,
  programId: PublicKey,
  data: Buffer,
  keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>,
): TransactionInstruction {
  // Construct instruction data: method selector (4 bytes) + parameters
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.concat([encodeSelector(method), data]),
  })
}

// ---------------------------------------------------------------------------
// Core helper for constructing and sending sponsored transactions
// ---------------------------------------------------------------------------

/**
 * Builds and broadcasts a on-chain transaction, sponsored by feePayer.
 * - Ensures fee payer funds, dedupes signers, logs the result.
 */
async function buildAndSendSponsoredTx(
  programId: PublicKey,
  method: keyof typeof SELECTORS,
  data: Buffer,
  keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>,
  signers: Keypair[],
  operation: string,
): Promise<string> {
  assertMainnetSafeForSubscriptionTx(operation) // extra safety on mainnet
  const chains = getSystemConfigSnapshot()
  if (!chains.chains.enabled.includes('solana')) {
    throw new Error('Solana sponsored subscription transactions are disabled')
  }

  await assertFeePayerGasReserve('RING') // Ensure paying wallet has enough gas

  const connection = getSolanaConnection()
  const feePayer = getFeePayerKeypair()

  const ix = buildInstruction(method, programId, data, keys)
  const tx = new Transaction()
  tx.feePayer = feePayer.publicKey
  tx.add(ix)

  // Attach recent blockhash for transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight

  // Deduplicate signers: always start with feePayer, add rest if unique
  const uniqueSigners: Keypair[] = [feePayer]
  for (const signer of signers) {
    if (!uniqueSigners.some((s) => s.publicKey.equals(signer.publicKey))) {
      uniqueSigners.push(signer)
    }
  }
  for (const signer of uniqueSigners) {
    tx.partialSign(signer)
  }

  const signature = await sendAndConfirmTransaction(connection, tx, uniqueSigners, {
    commitment: 'confirmed',
  })

  logMembershipOp('tx_confirmed', { operation, signature })
  return signature
}

// ---------------------------------------------------------------------------
// Helpers to extract keypairs and config safely
// ---------------------------------------------------------------------------

/**
 * Recovers user's Solana keypair from encrypted wallet.
 */
function getUserKeypair(wallet: Wallet): Keypair {
  if ((wallet.chain ?? 'evm') !== 'solana') {
    throw new Error('Wallet is not a Solana wallet')
  }
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }
  const secretKey = decryptSolanaWalletSecretKey(wallet.encryptedPrivateKey, encryptionKey)
  return Keypair.fromSecretKey(secretKey)
}

/**
 * Resolves the deployed membership program id, or throws if not configured.
 */
function requireProgramId(): PublicKey {
  const id = getMembershipProgramId()
  if (!id) {
    throw new Error(
      'Membership contract not deployed. Set RING_MEMBERSHIP_CONTRACT_ADDRESS or chains.solana.membershipProgramId.',
    )
  }
  return new PublicKey(id)
}

// ============================================================================
// Public API
// ============================================================================

export interface MembershipSubscription {
  status: 'inactive' | 'active' | 'expired' | 'cancelled' | 'suspended' | 'grace_period'
  startTime: number
  nextPaymentDue: number
  failedAttempts: number
  autoRenew: boolean
  totalPaid: string
  paymentsCount: number
}

/**
 * Decodes wire buffer into a strongly-typed membership subscription object.
 * Expects Solang layout: 1 u8 status (at offset 31), then 5 uint256 fields, then 1 bool.
 */
function decodeSubscription(data: Buffer | null): MembershipSubscription | null {
  if (!data || data.length < 32 * 8) return null
  // Offset 0 (status as u8 at 31); then 32, 64 ... (uint256 fields)
  const statusCode = Number(data.readUInt8(31))
  const statusMap: MembershipSubscription['status'][] = [
    'inactive',   // 0 INACTIVE
    'active',     // 1 ACTIVE
    'expired',    // 2 EXPIRED
    'cancelled',  // 3 CANCELLED
    'suspended',  // 4 SUSPENDED
  ]
  // Index may overflow: fallback to 'inactive' if contract returns unknown status
  const status = statusMap[statusCode] ?? 'inactive'

  // Helper to decode 32-byte BE uint256 at given offset
  const u256 = (offset: number): bigint => {
    let v = 0n
    for (let i = 0; i < 32; i++) {
      v = (v << 8n) | BigInt(data[offset + i])
    }
    return v
  }
  const startTime = Number(u256(32))
  const nextPaymentDue = Number(u256(64))
  const failedAttempts = Number(u256(96))
  const totalPaid = u256(128).toString()
  const paymentsCount = Number(u256(160))
  // Auto-renewal flag: bool at offset 223 (last byte in 32-byte slot starting at 192)
  const autoRenew = data.readUInt8(223) !== 0

  return { status, startTime, nextPaymentDue, failedAttempts, autoRenew, totalPaid, paymentsCount }
}

/**
 * Submits a transaction to register membership on-chain.
 * User pays MEMBERSHIP_FEE, fee is sponsored, user & treasury sign.
 */
export async function createOnchainSubscription(
  userWallet: Wallet,
): Promise<{ txSignature: string; userAddress: string }> {
  const programId = requireProgramId()
  const userKeypair = getUserKeypair(userWallet)
  const userAddress = userKeypair.publicKey

  // Account layout: PDA/user, token mint, program/system, user ATA, treasury ATA, treasury, user.
  // TODO: Refactor seeds/keys when Solang IDL conventions stabilize.
  // Key order and layout must match contract implementation.
  const mint = new PublicKey(getNativeTokenAddress() ?? SystemProgram.programId.toBase58())
  const treasury = getTreasuryKeypair()

  const keys = [
    { pubkey: userAddress, isSigner: true, isWritable: true }, // user/main account
    { pubkey: mint, isSigner: false, isWritable: false }, // token mint
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program (for transfers)
    { pubkey: userAddress, isSigner: false, isWritable: true }, // user's associated token account (ATA)
    { pubkey: treasury.publicKey, isSigner: false, isWritable: true }, // treasury ATA
    { pubkey: treasury.publicKey, isSigner: true, isWritable: false }, // treasury account authority
    // MOCK CODE, TODO: Add correct subscription PDA as first account, and properly assign keys per Solang's IDL once finalized.
    // 1. Publish Solang IDL.
    // 2. Derive PDA as per IDL seed.
    // 3. Insert PDA as first writable account.
  ]

  // For createSubscription(): no parameters, data is empty buffer.
  const data = Buffer.alloc(0)
  const txSignature = await buildAndSendSponsoredTx(
    programId,
    'createSubscription',
    data,
    keys,
    [userKeypair, treasury],
    'createSubscription',
  )
  return { txSignature, userAddress: userAddress.toBase58() }
}

/**
 * Submits a user-initiated cancellation of a subscription. No params.
 */
export async function cancelOnchainSubscription(
  userWallet: Wallet,
): Promise<{ txSignature: string }> {
  const programId = requireProgramId()
  const userKeypair = getUserKeypair(userWallet)
  const keys = [
    { pubkey: userKeypair.publicKey, isSigner: true, isWritable: true },
    // MOCK CODE, TODO: Confirm if subscription PDA is required as separate key and add if needed; cross-check Solang contract
  ]
  const data = Buffer.alloc(0)
  const txSignature = await buildAndSendSponsoredTx(
    programId,
    'cancelSubscription',
    data,
    keys,
    [userKeypair],
    'cancelSubscription',
  )
  return { txSignature }
}

/**
 * Submits a user-initiated subscription renewal, pays MEMBERSHIP_FEE again.
 */
export async function renewOnchainSubscription(
  userWallet: Wallet,
): Promise<{ txSignature: string }> {
  const programId = requireProgramId()
  const userKeypair = getUserKeypair(userWallet)
  const mint = new PublicKey(getNativeTokenAddress() ?? SystemProgram.programId.toBase58())
  const treasury = getTreasuryKeypair()
  const userAddress = userKeypair.publicKey

  const keys = [
    { pubkey: userAddress, isSigner: true, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: userAddress, isSigner: false, isWritable: true },
    { pubkey: treasury.publicKey, isSigner: false, isWritable: true },
    { pubkey: treasury.publicKey, isSigner: true, isWritable: false },
    // MOCK CODE, TODO: Validate if PDA or other additional accounts required as per Solang contract structure.
  ]
  const data = Buffer.alloc(0)
  const txSignature = await buildAndSendSponsoredTx(
    programId,
    'renewSubscription',
    data,
    keys,
    [userKeypair, treasury],
    'renewSubscription',
  )
  return { txSignature }
}

/**
 * Submits admin transaction to process up to `batchSize` payments.
 * Only allowed for treasury account (owner).
 */
export async function processBatchPayments(
  batchSize: number,
): Promise<{ txSignature: string; processed: number }> {
  const programId = requireProgramId()
  const treasury = getTreasuryKeypair()
  if (!treasury) {
    throw new Error('Treasury keypair required for batch processing')
  }
  const mint = new PublicKey(getNativeTokenAddress() ?? SystemProgram.programId.toBase58())
  const keys = [
    { pubkey: treasury.publicKey, isSigner: true, isWritable: false }, // admin/owner
    { pubkey: mint, isSigner: false, isWritable: false }, // token mint
    // TODO: Once final IDL available: Add all program-required accounts (e.g. PDAs, program state) for batch ops.
  ]
  const data = encodeUint256(BigInt(batchSize))
  const txSignature = await buildAndSendSponsoredTx(
    programId,
    'processBatchPayments',
    data,
    keys,
    [treasury],
    'processBatchPayments',
  )
  return { txSignature, processed: batchSize }
}

/**
 * Reads an on-chain subscription (current state) for a provided address.
 *
 * Uses Solana connection.getAccountInfo to obtain on-chain buffer,
 * then decodes it to MembershipSubscription type.
 */
export async function getOnchainSubscription(
  userAddress: string,
): Promise<MembershipSubscription | null> {
  const programId = requireProgramId()
  const connection = getSolanaConnection()
  const pubkey = new PublicKey(userAddress)
  // MOCK CODE, TODO:
  // This currently reads directly from user's account.
  // Once PDA scheme is finalized, derive PDA for subscription and fetch PDA account instead.
  const account = await connection.getAccountInfo(pubkey, { commitment: 'confirmed' })
  if (!account || !account.data) return null
  return decodeSubscription(account.data)
}

/**
 * Returns true if a user has an active or grace_period on-chain membership.
 *
 * Reads account data and interprets status; does NOT invoke a true Solana view.
 */
export async function hasOnchainActiveMembership(userAddress: string): Promise<boolean> {
  const programId = requireProgramId()
  const connection = getSolanaConnection()
  const userPubkey = new PublicKey(userAddress)
  // See decodeSubscription for status mapping.
  const account = await connection.getAccountInfo(userPubkey, { commitment: 'confirmed' })
  if (!account || !account.data) return false
  const sub = decodeSubscription(account.data)
  if (!sub) return false
  return sub.status === 'active' || sub.status === 'grace_period'
  // TODO: If Solana contract gains direct view for "isActive", call it through simulate/readonly and return.
}

/**
 * Parses a confirmed transaction by signature and extracts event data if available.
 * Returns the number of processed, successful, and failed batch payments.
 */
export async function parseBatchPaymentEvent(
  signature: string,
): Promise<{ processed: number; successful: number; failed: number }> {
  const connection = getSolanaConnection()
  // getParsedTransaction returns parsed tx with decoded instructions or raw logs.
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed' })
  if (!tx) return { processed: 0, successful: 0, failed: 0 }
  // Solang programs emit events as 'log' instructions with hex data.
  // Format: data encodes (uint256, uint256, uint256) for batch stats.
  let processed = 0
  let successful = 0
  let failed = 0
  for (const ix of tx.transaction.message.instructions) {
    if ('data' in ix && typeof ix.data === 'string') {
      const data = Buffer.from(ix.data, 'base64')
      // Event Buffer: 1 type byte (usually zero), three 32-byte BE uint256 fields.
      if (data.length >= 97) {
        try {
          const proc = BigInt('0x' + data.slice(1, 33).toString('hex'))
          const succ = BigInt('0x' + data.slice(33, 65).toString('hex'))
          const fail = BigInt('0x' + data.slice(65, 97).toString('hex'))
          if (proc > 0n || succ > 0n || fail > 0n) {
            processed = Number(proc)
            successful = Number(succ)
            failed = Number(fail)
            break
          }
        } catch {
          // If not our event, ignore and move on
        }
      }
    }
  }
  return { processed, successful, failed }
}
