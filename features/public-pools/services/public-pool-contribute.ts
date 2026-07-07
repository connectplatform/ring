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

export class PublicPoolEscrowNotAvailableError extends Error {
  constructor() {
    super('Escrow chip-ins require the Solana PublicPool program (not deployed yet)')
    this.name = 'PublicPoolEscrowNotAvailableError'
  }
}

export async function executeNativePoolContribution(params: {
  userId: string
  pool: PublicPoolDoc
  amountRing: string
  idempotencyKey: string
  fundingMode: 'donation' | 'escrow'
}): Promise<{ txHash: string; contributionId: string; toAddress: string }> {
  const cloneId = params.pool.clone_id

  if (params.fundingMode === 'escrow') {
    throw new PublicPoolEscrowNotAvailableError()
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
      amount_ring: params.amountRing,
      funding_mode: params.fundingMode,
      status: 'pending',
      idempotency_key: params.idempotencyKey,
      chain: 'solana',
    })
    contributionId = created.id
  } else if (existing.status === 'pending') {
    contributionId = existing.id
  }

  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet) {
    throw new Error('User wallet not found — call POST /api/wallet/ensure first')
  }

  const amountRaw = nativeTokenUiToRaw(params.amountRing)
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
    amount: params.amountRing,
    tokenSymbol: getNativeTokenSymbol(),
    chain: getNativeChain(),
    notes: `pool:${params.pool.id}`,
  })

  return { txHash, contributionId: contributionId!, toAddress }
}
