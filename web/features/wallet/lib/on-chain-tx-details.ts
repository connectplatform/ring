import 'server-only'

import { getNativeChain, getNativeChainConfig, type NativeChain } from '@/lib/ring-config-chain'
import { getSolanaConnection } from '@/features/wallet/chains/solana/solana-client'
import { logger } from '@/lib/logger'

export type OnChainTransactionDetails = {
  status: 'confirmed' | 'finalized' | 'failed' | 'unknown'
  slot?: number
  blockTime?: number | null
  feeLamports?: number
  confirmations?: number | null
  err?: string | null
  explorerUrl: string
  amountRaw?: string
  mint?: string | null
  /** Raw RPC snapshot for forensic/detail modal (JSON-safe) */
  onChainSnapshot?: Record<string, unknown>
}

/**
 * Build a public block-explorer URL for a native-chain transaction.
 */
export function getNativeChainExplorerTxUrl(
  txHash: string,
  chain: NativeChain = getNativeChain(),
): string {
  if (chain === 'solana') {
    const network = getNativeChainConfig().solana?.network ?? 'devnet'
    const base = 'https://solscan.io/tx/'
    if (network === 'mainnet-beta' || network === 'mainnet') {
      return `${base}${txHash}`
    }
    return `${base}${txHash}?cluster=${network}`
  }

  // EVM / Base — prefer Basescan when native chain is base
  if (chain === 'base') {
    return `https://basescan.org/tx/${txHash}`
  }
  return `https://polygonscan.com/tx/${txHash}`
}

/**
 * Fetch Solana (or stub EVM) confirmation details to persist alongside wallet_transactions.
 * Best-effort: never throws — returns explorer URL + unknown status on failure.
 */
export async function fetchOnChainTransactionDetails(params: {
  txHash: string
  chain?: NativeChain
  amountRaw?: string
  mint?: string | null
}): Promise<OnChainTransactionDetails> {
  const chain = params.chain ?? getNativeChain()
  const explorerUrl = getNativeChainExplorerTxUrl(params.txHash, chain)

  if (chain !== 'solana') {
    return {
      status: 'confirmed',
      explorerUrl,
      amountRaw: params.amountRaw,
      mint: params.mint ?? null,
      onChainSnapshot: {
        chain,
        txHash: params.txHash,
        note: 'EVM receipt enrichment not yet wired; explorer link is authoritative',
      },
    }
  }

  try {
    const connection = getSolanaConnection()
    const tx = await connection.getTransaction(params.txHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return {
        status: 'unknown',
        explorerUrl,
        amountRaw: params.amountRaw,
        mint: params.mint ?? null,
      }
    }

    const err = tx.meta?.err ? JSON.stringify(tx.meta.err) : null
    return {
      status: err ? 'failed' : 'confirmed',
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
      feeLamports: tx.meta?.fee,
      confirmations: null,
      err,
      explorerUrl,
      amountRaw: params.amountRaw,
      mint: params.mint ?? null,
      onChainSnapshot: {
        slot: tx.slot,
        blockTime: tx.blockTime,
        fee: tx.meta?.fee,
        err: tx.meta?.err ?? null,
        preBalances: tx.meta?.preBalances,
        postBalances: tx.meta?.postBalances,
        preTokenBalances: tx.meta?.preTokenBalances,
        postTokenBalances: tx.meta?.postTokenBalances,
        logMessages: tx.meta?.logMessages?.slice(0, 40),
      },
    }
  } catch (error) {
    logger.warn('fetchOnChainTransactionDetails failed', {
      txHash: params.txHash,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      status: 'unknown',
      explorerUrl,
      amountRaw: params.amountRaw,
      mint: params.mint ?? null,
    }
  }
}
