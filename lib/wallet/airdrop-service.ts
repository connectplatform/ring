import 'server-only'

import { getNativeChain, getRingAirdropConfig } from '@/lib/ring-config-chain'
import { ringUiToRaw } from '@/lib/wallet/ring-amount'
import { screenWalletAddress } from '@/lib/wallet/compliance-guard'
import {
  createAirdropJob,
  findAirdropJobByIdempotencyKey,
  updateAirdropJobStatus,
} from '@/lib/wallet/airdrop-job-db'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { executeAirdropTransfer } from '@/features/wallet/chains/solana/airdrop-transfer'
import type { AirdropTrigger } from '@/lib/zod/airdrop-schemas'
import { db } from '@/lib/database'

function ruleForTrigger(trigger: AirdropTrigger) {
  const config = getRingAirdropConfig()
  return trigger === 'admin_verify' ? config.adminVerify : config.ringUsername
}

export async function enqueueAirdrop(params: {
  userId: string
  trigger: AirdropTrigger
  username?: string | null
  isVerified?: boolean
}): Promise<{ status: 'skipped' | 'queued' | 'settled' | 'existing'; jobId?: string }> {
  const rule = ruleForTrigger(params.trigger)
  if (!rule?.enabled) {
    return { status: 'skipped' }
  }

  if (rule.requireUsername && !params.username?.trim()) {
    return { status: 'skipped' }
  }

  if (rule.requireVerified && !params.isVerified) {
    return { status: 'skipped' }
  }

  if (getNativeChain() !== 'solana') {
    return { status: 'skipped' }
  }

  const idempotencyKey = `airdrop:${params.trigger}:${params.userId}`
  const existing = await findAirdropJobByIdempotencyKey(idempotencyKey)
  if (existing) {
    return { status: 'existing', jobId: existing.id }
  }

  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet?.address) {
    return { status: 'skipped' }
  }

  const screen = await screenWalletAddress(wallet.address, params.userId)
  if (!screen.allowed) {
    const rejected = await createAirdropJob({
      idempotency_key: idempotencyKey,
      user_id: params.userId,
      trigger: params.trigger,
      amount_raw: ringUiToRaw(rule.amount ?? '1').toString(),
      status: 'rejected',
      compliance_status: 'reasonCode' in screen ? screen.reasonCode : 'blocked',
    })
    return { status: 'skipped', jobId: rejected.id }
  }

  const amountRaw = ringUiToRaw(rule.amount ?? '1')
  const job = await createAirdropJob({
    idempotency_key: idempotencyKey,
    user_id: params.userId,
    trigger: params.trigger,
    amount_raw: amountRaw.toString(),
    status: 'pending',
    compliance_status: 'passed',
  })

  try {
    await updateAirdropJobStatus(job.id!, 'submitted')
    const transfer = await executeAirdropTransfer({
      recipientAddress: wallet.address,
      amountRaw,
    })

    await updateAirdropJobStatus(job.id!, 'settled', {
      chain_signature: transfer.txHash,
    })

    const kind = params.trigger === 'admin_verify' ? 'airdrop_verify' : 'airdrop_username'
    const wtxId = await createWalletTransaction({
      kind,
      userId: params.userId,
      txHash: transfer.txHash,
      toAddress: wallet.address,
      amount: transfer.amountUi,
      tokenSymbol: 'RING',
      chain: 'solana',
      notes: `Airdrop: ${params.trigger}`,
    })

    await db().updateDoc('airdrop_jobs', job.id!, { wallet_transaction_id: wtxId })

    return { status: 'settled', jobId: job.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Airdrop failed'
    await updateAirdropJobStatus(job.id!, 'failed', { failure_reason: message })
    return { status: 'skipped', jobId: job.id }
  }
}
