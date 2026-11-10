'use server'

/**
 * Admin Web3 server actions: mint and burn the project's native token.
 *
 * Mint: creates new tokens into the treasury ATA, increasing total supply.
 * Burn: destroys tokens from the treasury ATA, decreasing total supply.
 *
 * Mint authority is SOLANA_TREASURY_PRIVATE_KEY. The fee payer
 * (SOLANA_FEE_PAYER_PRIVATE_KEY) may be a separate key and only pays gas.
 * Both actions require superadmin auth. Mint attempts are written to
 * token_mint_events before send and updated after.
 */

import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import {
  getFeePayerKeypair,
  getSolanaConnection,
  getTreasuryKeypair,
} from '@/features/wallet/chains/solana/solana-client'
import { getNativeChainExplorerTxUrl } from '@/features/wallet/lib/on-chain-tx-details'
import { getSharedPgPool } from '@/lib/database/shared-pg-pool'
import { logger } from '@/lib/logger'
import {
  getNativeChainConfig,
  getNativeTokenAddress,
  getNativeTokenSymbol,
} from '@/lib/ring-config-chain'
import { getOverlayFeature, getPublicPoolConfig } from '@/lib/ring-config-core'
import { nativeTokenRawToUi, nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { getOrCreateAssociatedTokenAccount, mintTo, burn, getMint } from '@solana/spl-token'
import { PublicKey, type Keypair } from '@solana/web3.js'
import { revalidatePath } from 'next/cache'

export type TokenMintEventStatus = 'pending' | 'confirmed' | 'failed'

export type TokenMintEventRow = {
  id: string
  projectId: string
  superadminUserId: string
  superadminEmail: string | null
  amount: string
  amountRaw: string
  mintAddress: string
  destination: string
  txSignature: string | null
  note: string | null
  cluster: string | null
  status: TokenMintEventStatus
  error: string | null
  createdAt: string
  explorerUrl: string | null
}

export type AdminNativeTokenActionResult = {
  success: boolean
  txHash?: string
  newSupply?: string
  error?: string
}

async function assertSuperadmin() {
  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    throw new Error('Forbidden: superadmin only')
  }
  return session
}

function getMintAuditProjectId(): string {
  const overlay = getOverlayFeature()
  if (overlay) return overlay
  const cloneName = getPublicPoolConfig().cloneId?.trim()
  if (cloneName) return cloneName
  const fromEnv =
    process.env.NEXT_PUBLIC_PROJECT_SLUG?.trim() ||
    process.env.RING_CLONE_ID?.trim() ||
    process.env.CLONE_SLUG?.trim()
  return fromEnv || 'unknown'
}

function getSolanaCluster(): string {
  return getNativeChainConfig().solana?.network ?? 'devnet'
}

function formatSupply(raw: bigint, decimals: number): string {
  const ui = nativeTokenRawToUi(raw, decimals)
  const [whole, frac] = ui.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${grouped}.${frac}` : grouped
}

function mapMintEventRow(row: {
  id: string
  project_id: string
  superadmin_user_id: string
  superadmin_email: string | null
  amount: string | number
  amount_raw: string | number
  mint_address: string
  destination: string
  tx_signature: string | null
  note: string | null
  cluster: string | null
  status: string
  error: string | null
  created_at: Date | string
}): TokenMintEventRow {
  const txSignature = row.tx_signature
  const cluster = row.cluster
  return {
    id: row.id,
    projectId: row.project_id,
    superadminUserId: row.superadmin_user_id,
    superadminEmail: row.superadmin_email,
    amount: String(row.amount),
    amountRaw: String(row.amount_raw),
    mintAddress: row.mint_address,
    destination: row.destination,
    txSignature,
    note: row.note,
    cluster,
    status: (row.status as TokenMintEventStatus) || 'pending',
    error: row.error,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    explorerUrl: txSignature ? getNativeChainExplorerTxUrl(txSignature) : null,
  }
}

async function insertPendingMintEvent(params: {
  projectId: string
  superadminUserId: string
  superadminEmail: string | null
  amountUi: string
  amountRaw: bigint
  mintAddress: string
  destination: string
  note: string
  cluster: string
}): Promise<string> {
  const pool = await getSharedPgPool()
  const result = await pool.query<{ id: string }>(
    `INSERT INTO public.token_mint_events (
       project_id, superadmin_user_id, superadmin_email,
       amount, amount_raw, mint_address, destination, note, cluster, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING id`,
    [
      params.projectId,
      params.superadminUserId,
      params.superadminEmail,
      params.amountUi,
      params.amountRaw.toString(),
      params.mintAddress,
      params.destination,
      params.note,
      params.cluster,
    ],
  )
  const id = result.rows[0]?.id
  if (!id) throw new Error('Failed to record mint audit row')
  return id
}

async function finalizeMintEvent(
  id: string,
  update: { status: 'confirmed'; txSignature: string } | { status: 'failed'; error: string },
): Promise<void> {
  try {
    const pool = await getSharedPgPool()
    if (update.status === 'confirmed') {
      await pool.query(
        `UPDATE public.token_mint_events
            SET status = 'confirmed',
                tx_signature = $2,
                error = NULL,
                updated_at = now()
          WHERE id = $1`,
        [id, update.txSignature],
      )
    } else {
      await pool.query(
        `UPDATE public.token_mint_events
            SET status = 'failed',
                error = $2,
                updated_at = now()
          WHERE id = $1`,
        [id, update.error.slice(0, 2000)],
      )
    }
  } catch (error) {
    logger.error('Failed to update token_mint_events row', {
      id,
      status: update.status,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}

function resolveTreasuryAuthority(): Keypair {
  const treasury = getTreasuryKeypair()
  if (!treasury) {
    throw new Error('SOLANA_TREASURY_PRIVATE_KEY is not configured')
  }
  return treasury
}

function assertTreasuryIsMintAuthority(
  treasury: Keypair,
  onChainMintAuthority: PublicKey | null,
): void {
  const treasuryPk = treasury.publicKey.toBase58()
  const mintAuthority = onChainMintAuthority?.toBase58() ?? null
  if (!mintAuthority || mintAuthority !== treasuryPk) {
    throw new Error(
      `Treasury key does not match the mint's on-chain mintAuthority (treasury=${treasuryPk}, mintAuthority=${mintAuthority ?? 'none'}).`,
    )
  }
}

export async function listTokenMintEvents(limit = 25): Promise<{
  events: TokenMintEventRow[]
  unavailable?: boolean
}> {
  try {
    const pool = await getSharedPgPool()
    const result = await pool.query<{
      id: string
      project_id: string
      superadmin_user_id: string
      superadmin_email: string | null
      amount: string | number
      amount_raw: string | number
      mint_address: string
      destination: string
      tx_signature: string | null
      note: string | null
      cluster: string | null
      status: string
      error: string | null
      created_at: Date | string
    }>(
      `SELECT id, project_id, superadmin_user_id, superadmin_email,
              amount, amount_raw, mint_address, destination, tx_signature,
              note, cluster, status, error, created_at
         FROM public.token_mint_events
        ORDER BY created_at DESC
        LIMIT $1`,
      [Math.min(Math.max(limit, 1), 100)],
    )
    return { events: result.rows.map(mapMintEventRow) }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/token_mint_events/i.test(message) && /does not exist|undefined table/i.test(message)) {
      return { events: [], unavailable: true }
    }
    logger.error('Failed to list token_mint_events', {
      error: message || 'unknown',
    })
    return { events: [], unavailable: true }
  }
}

export async function adminMintNativeToken(
  amountUi: string,
  note?: string,
): Promise<AdminNativeTokenActionResult> {
  let auditId: string | null = null
  try {
    const session = await assertSuperadmin()

    const trimmedNote = note?.trim() ?? ''
    if (!trimmedNote) {
      return { success: false, error: 'A note is required' }
    }

    const mintAddress = getNativeTokenAddress()
    if (!mintAddress) throw new Error('Native token address not configured')

    const amountNum = Number(amountUi)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const connection = getSolanaConnection()
    const feePayer = getFeePayerKeypair()
    const treasury = resolveTreasuryAuthority()
    const mint = new PublicKey(mintAddress)
    const mintInfo = await getMint(connection, mint)
    assertTreasuryIsMintAuthority(treasury, mintInfo.mintAuthority)

    const decimals = mintInfo.decimals
    const rawAmount = nativeTokenUiToRaw(amountUi.trim(), decimals)
    if (rawAmount <= 0n) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      mint,
      treasury.publicKey,
    )

    const projectId = getMintAuditProjectId()
    const cluster = getSolanaCluster()
    const amountUiNormalized = nativeTokenRawToUi(rawAmount, decimals)
    auditId = await insertPendingMintEvent({
      projectId,
      superadminUserId: session.user.id,
      superadminEmail: session.user.email ?? null,
      amountUi: amountUiNormalized,
      amountRaw: rawAmount,
      mintAddress,
      destination: treasuryAta.address.toBase58(),
      note: trimmedNote,
      cluster,
    })

    const sig = await mintTo(
      connection,
      feePayer,
      mint,
      treasuryAta.address,
      treasury,
      rawAmount,
    )

    await finalizeMintEvent(auditId, { status: 'confirmed', txSignature: sig })

    const supplyInfo = await getMint(connection, mint)
    const newSupply = formatSupply(supplyInfo.supply, supplyInfo.decimals)

    revalidatePath('/admin/web3')
    return { success: true, txHash: sig, newSupply }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mint failed'
    if (auditId) {
      await finalizeMintEvent(auditId, { status: 'failed', error: message })
    }
    return { success: false, error: message }
  }
}

/**
 * @deprecated Use adminMintNativeToken. Kept so existing callers keep working.
 */
export async function adminMintRING(
  amountUi: string,
  note?: string,
): Promise<AdminNativeTokenActionResult> {
  const fallbackNote = note?.trim() || `Admin mint of ${getNativeTokenSymbol()} via ${getMintAuditProjectId()}`
  return adminMintNativeToken(amountUi, fallbackNote)
}

export async function adminBurnRING(amountUi: string): Promise<AdminNativeTokenActionResult> {
  try {
    await assertSuperadmin()

    const mintAddress = getNativeTokenAddress()
    if (!mintAddress) throw new Error('Native token address not configured')

    const amountNum = Number(amountUi)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const connection = getSolanaConnection()
    const feePayer = getFeePayerKeypair()
    const treasury = resolveTreasuryAuthority()
    const mint = new PublicKey(mintAddress)
    const mintInfo = await getMint(connection, mint)

    const decimals = mintInfo.decimals
    const rawAmount = nativeTokenUiToRaw(amountUi.trim(), decimals)
    if (rawAmount <= 0n) {
      return { success: false, error: 'Amount must be a positive number' }
    }

    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      mint,
      treasury.publicKey,
    )

    const sig = await burn(
      connection,
      feePayer,
      treasuryAta.address,
      mint,
      treasury,
      rawAmount,
    )

    const supplyInfo = await getMint(connection, mint)
    const newSupply = formatSupply(supplyInfo.supply, supplyInfo.decimals)

    revalidatePath('/admin/web3')
    return { success: true, txHash: sig, newSupply }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Burn failed'
    return { success: false, error: message }
  }
}
