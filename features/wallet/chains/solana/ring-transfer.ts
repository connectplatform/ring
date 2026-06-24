import 'server-only'

import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token'
import type { Wallet } from '@/features/auth/types'
import { getRingChainConfig, getRingTokenDecimals, getRingTokenMintOrAddress } from '@/lib/ring-config-chain'
import { decryptSolanaWalletSecretKey } from '@/lib/wallet/decrypt-user-wallet'
import { assertFeePayerGasReserve, GasReserveError } from './solana-gas-reserve'
import { getFeePayerKeypair, getMintPublicKey, getSolanaConnection } from './solana-client'

export { GasReserveError } from './solana-gas-reserve'

function getSenderKeypair(wallet: Wallet): Keypair {
  if ((wallet.chain ?? 'evm') !== 'solana') {
    throw new Error('Sender wallet is not a Solana wallet')
  }

  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  const secretKey = decryptSolanaWalletSecretKey(wallet.encryptedPrivateKey, encryptionKey)
  return Keypair.fromSecretKey(secretKey)
}

export async function getSolanaRingBalance(walletAddress: string): Promise<string> {
  const mintAddress = getRingTokenMintOrAddress('solana')
  if (!mintAddress) {
    return '0'
  }

  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const owner = new PublicKey(walletAddress)
  const ata = getAssociatedTokenAddressSync(mint, owner)

  try {
    const account = await connection.getTokenAccountBalance(ata)
    return account.value.uiAmountString ?? '0'
  } catch {
    return '0'
  }
}

export async function transferSolanaRing(params: {
  senderWallet: Wallet
  toAddress: string
  amount: string
}): Promise<{ txHash: string; fromAddress: string }> {
  const chains = getRingChainConfig()
  if (!chains.solana?.sponsorAllRingTransfers) {
    throw new Error('Solana sponsored transfers are disabled in ring-config')
  }

  await assertFeePayerGasReserve('RING')

  const mintAddress = getRingTokenMintOrAddress('solana')
  if (!mintAddress) {
    throw new Error('Solana RING mint address not configured')
  }

  const connection = getSolanaConnection()
  const mint = getMintPublicKey(mintAddress)
  const decimals = getRingTokenDecimals('solana')
  const feePayer = getFeePayerKeypair()
  const sender = getSenderKeypair(params.senderWallet)
  const recipient = new PublicKey(params.toAddress)

  const mintInfo = await getMint(connection, mint)
  const amountRaw = BigInt(
    Math.round(parseFloat(params.amount) * 10 ** (mintInfo.decimals ?? decimals)),
  )

  const senderAta = getAssociatedTokenAddressSync(mint, sender.publicKey)
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient)

  const tx = new Transaction()
  tx.feePayer = feePayer.publicKey

  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      feePayer.publicKey,
      recipientAta,
      recipient,
      mint,
    ),
    createTransferCheckedInstruction(
      senderAta,
      mint,
      recipientAta,
      sender.publicKey,
      amountRaw,
      mintInfo.decimals ?? decimals,
    ),
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight

  tx.partialSign(sender)
  tx.partialSign(feePayer)

  const signature = await sendAndConfirmTransaction(connection, tx, [feePayer, sender], {
    commitment: 'confirmed',
  })

  return {
    txHash: signature,
    fromAddress: params.senderWallet.address,
  }
}
