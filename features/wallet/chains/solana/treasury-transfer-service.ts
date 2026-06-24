import 'server-only'

import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnCheckedInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token'
import type { Wallet } from '@/features/auth/types'
import {
  assertMainnetHotKeyAllowed,
  getRingChainConfig,
  getRingTokenDecimals,
  getRingTokenMintOrAddress,
} from '@/lib/ring-config-chain'
import { decryptSolanaWalletSecretKey } from '@/lib/wallet/decrypt-user-wallet'
import { assertFeePayerGasReserve } from './solana-gas-reserve'
import {
  getFeePayerKeypair,
  getMintPublicKey,
  getSolanaConnection,
  getTreasuryKeypair,
} from './solana-client'

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

function requireTreasuryKeypair(): Keypair {
  assertMainnetHotKeyAllowed('treasury_transfer')
  const treasury = getTreasuryKeypair()
  if (!treasury) {
    throw new Error('SOLANA_TREASURY_PRIVATE_KEY not configured')
  }
  return treasury
}

async function buildSponsoredTx(
  instructions: Parameters<Transaction['add']>[0][],
  signers: Keypair[],
): Promise<string> {
  const chains = getRingChainConfig()
  if (!chains.solana?.sponsorAllRingTransfers) {
    throw new Error('Solana sponsored transfers are disabled')
  }

  await assertFeePayerGasReserve('RING')
  const connection = getSolanaConnection()
  const feePayer = getFeePayerKeypair()
  const tx = new Transaction()
  tx.feePayer = feePayer.publicKey
  for (const ix of instructions) {
    tx.add(ix)
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight

  const uniqueSigners: Keypair[] = [feePayer]
  for (const signer of signers) {
    if (!uniqueSigners.some((s) => s.publicKey.equals(signer.publicKey))) {
      uniqueSigners.push(signer)
    }
  }
  for (const signer of uniqueSigners) {
    tx.partialSign(signer)
  }

  return sendAndConfirmTransaction(connection, tx, uniqueSigners, { commitment: 'confirmed' })
}

export async function transferRingFromTreasury(
  toAddress: string,
  amountRaw: bigint,
): Promise<{ txHash: string; fromAddress: string }> {
  const mintAddress = getRingTokenMintOrAddress('solana')
  if (!mintAddress) {
    throw new Error('Solana RING mint address not configured')
  }

  const treasury = requireTreasuryKeypair()
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getRingTokenDecimals('solana')
  const mintInfo = await getMint(connection, mint)
  const dec = mintInfo.decimals ?? decimals

  const recipient = new PublicKey(toAddress)
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient)
  const feePayer = getFeePayerKeypair()

  const txHash = await buildSponsoredTx(
    [
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer.publicKey,
        recipientAta,
        recipient,
        mint,
      ),
      createTransferCheckedInstruction(
        treasuryAta,
        mint,
        recipientAta,
        treasury.publicKey,
        amountRaw,
        dec,
      ),
    ],
    [treasury],
  )

  return { txHash, fromAddress: treasury.publicKey.toBase58() }
}

export async function transferRingToTreasury(
  userWallet: Wallet,
  amountRaw: bigint,
): Promise<{ txHash: string; toAddress: string }> {
  const mintAddress = getRingTokenMintOrAddress('solana')
  if (!mintAddress) {
    throw new Error('Solana RING mint address not configured')
  }

  const treasury = requireTreasuryKeypair()
  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getRingTokenDecimals('solana')
  const mintInfo = await getMint(connection, mint)
  const dec = mintInfo.decimals ?? decimals

  const user = getUserKeypair(userWallet)
  const feePayer = getFeePayerKeypair()
  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey)
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)

  const txHash = await buildSponsoredTx(
    [
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
        dec,
      ),
    ],
    [user],
  )

  return { txHash, toAddress: treasury.publicKey.toBase58() }
}

export async function burnRingFromUser(
  userWallet: Wallet,
  amountRaw: bigint,
): Promise<{ txHash: string }> {
  assertMainnetHotKeyAllowed('burn')
  const mintAddress = getRingTokenMintOrAddress('solana')
  if (!mintAddress) {
    throw new Error('Solana RING mint address not configured')
  }

  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getRingTokenDecimals('solana')
  const mintInfo = await getMint(connection, mint)
  const dec = mintInfo.decimals ?? decimals
  const user = getUserKeypair(userWallet)
  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey)

  const txHash = await buildSponsoredTx(
    [createBurnCheckedInstruction(userAta, mint, user.publicKey, amountRaw, dec)],
    [user],
  )

  return { txHash }
}
