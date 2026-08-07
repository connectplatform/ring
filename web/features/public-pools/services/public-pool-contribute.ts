import 'server-only'

import { getNativeChain } from '@/lib/ring-config-chain'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { transferTokenToTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import {
  findContributionByIdempotency,
  createContribution,
  updateContribution,
} from '@/features/public-pools/lib/public-pool-db'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { publicPoolEscrowNotReadyMessage } from '@/features/public-pools/lib/public-pool-escrow-gate'

export class PublicPoolEscrowNotAvailableError extends Error {
  constructor(message?: string) {
    super(message ?? publicPoolEscrowNotReadyMessage())
    this.name = 'PublicPoolEscrowNotAvailableError'
  }
}

export async function executeNativePoolContribution(params: {
  userId: string
  pool: PublicPoolDoc
  amountNativeToken: string
  idempotencyKey: string
  fundingMode: 'donation' | 'escrow'
}): Promise<{ txHash: string; contributionId: string; toAddress: string }> {
  const cloneId = params.pool.clone_id

  if (params.fundingMode === 'escrow') {
    const { canExecuteOnChainEscrow } = await import(
      '@/features/public-pools/lib/public-pool-program'
    )
    if (!canExecuteOnChainEscrow()) {
      throw new PublicPoolEscrowNotAvailableError()
    }
    // On-chain contribute requires pool.on_chain.{pool_pda,vault_ata} after init_pool.
    // Instruction encoding lands with Anchor IDL post-deploy; until then refuse safely.
    const onChain = (params.pool as PublicPoolDoc & {
      on_chain?: { pool_pda?: string; vault_ata?: string }
    }).on_chain
    if (!onChain?.pool_pda || !onChain?.vault_ata) {
      throw new PublicPoolEscrowNotAvailableError(
        'Escrow pool missing on_chain.pool_pda/vault_ata — run init_pool after deploy.',
      )
    }
    throw new PublicPoolEscrowNotAvailableError(
      'PublicPool program deployed; wire Anchor IDL client for contribute (see solana/programs/public-pool).',
    )
  }

  if (getNativeChain() !== 'solana') {
    throw new Error('Native RING chip-ins require Solana as the clone native chain')
  }

  const existing = await findContributionByIdempotency(cloneId, params.idempotencyKey)
  if (existing?.status === 'confirmed' && existing.tx_hash) {
    return {
      txHash: existing.tx_hash,
      contributionId: existing.id,
      toAddress: existing.to_address ?? '',
    }
  }

  let contributionId = existing?.id
  if (!existing) {
    const created = await createContribution({
      clone_id: cloneId,
      pool_id: params.pool.id,
      user_id: params.userId,
      amount_native: params.amountNativeToken,
      funding_mode: params.fundingMode,
      status: 'pending',
      idempotency_key: params.idempotencyKey,
      chain: 'solana',
      rail: 'native_token',
    })
    contributionId = created.id
  } else if (existing.status === 'pending') {
    contributionId = existing.id
  }

  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet) {
    throw new Error('User wallet not found — call POST /api/wallet/ensure first')
  }

  const amountRaw = nativeTokenUiToRaw(params.amountNativeToken)
  if (amountRaw <= 0n) {
    throw new Error('Invalid contribution amount')
  }

  const { txHash, toAddress } = await transferTokenToTreasury(wallet, amountRaw)

  await updateContribution(contributionId!, {
    status: 'confirmed',
    tx_hash: txHash,
    from_address: wallet.address,
    to_address: toAddress,
  })

  await createWalletTransaction({
    kind: 'public_pool_contribution',
    txHash,
    userId: params.userId,
    fromAddress: wallet.address,
    toAddress,
    amount: params.amountNativeToken,
    tokenSymbol: getNativeTokenSymbol(),
    chain: getNativeChain(),
    notes: `pool:${params.pool.id}`,
  })

  return { txHash, contributionId: contributionId!, toAddress }
}
