import 'server-only'

import { db } from '@/lib/database'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'

export type GenerativeBillAction = 'ghost_write' | 'image_gen' | 'video_gen'

function priceForAction(action: GenerativeBillAction): string {
  const envKey =
    action === 'ghost_write'
      ? 'GENERATIVE_CREDIT_GHOST_WRITE'
      : action === 'video_gen'
        ? 'GENERATIVE_CREDIT_VIDEO'
        : 'GENERATIVE_CREDIT_IMAGE'
  const raw = process.env[envKey]?.trim()
  if (raw && /^\d+(\.\d+)?$/.test(raw)) return raw
  // Defaults in credit units
  if (action === 'ghost_write') return '5'
  if (action === 'video_gen') return '50'
  return '15'
}

export type UsageLedgerRow = {
  userId: string
  action: GenerativeBillAction
  conversationId?: string
  messageId?: string
  referenceId: string
  creditAmount: string
  transactionId?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  model?: string
  provider?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

/**
 * Bill platform credit before a generative turn; write generative_usage ledger row.
 * Idempotent when the same referenceId was already billed.
 */
export async function billGenerativeTurn(params: {
  userId: string
  action: GenerativeBillAction
  conversationId?: string
  messageId?: string
  referenceId: string
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  model?: string
  provider?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string; transactionId?: string; amount?: string }> {
  const amount = priceForAction(params.action)

  // Soft idempotency: skip if ledger already has this reference
  try {
    const existing = await db().queryDocs<UsageLedgerRow>({
      collection: 'generative_usage',
      filters: [{ field: 'referenceId', operator: '==', value: params.referenceId }],
      pagination: { limit: 1 },
    })
    if (existing.success && existing.data?.length) {
      return { success: true, transactionId: existing.data[0].transactionId, amount }
    }
  } catch {
    // collection may not exist yet — continue
  }

  const hasBalance = await creditBalanceService.hasSufficientBalance(params.userId, amount)
  if (!hasBalance) {
    return { success: false, error: 'Insufficient credit balance for generative action', amount }
  }

  const spend = await WalletConductor.spendCredits({
    userId: params.userId,
    amount,
    description: `Generative ${params.action}`,
    referenceId: params.referenceId,
    type: 'payment',
    metadata: {
      type: 'payment',
      generative: true,
      action: params.action,
      conversationId: params.conversationId,
      messageId: params.messageId,
      ...(params.metadata || {}),
    },
  })

  if (!spend.success) {
    return { success: false, error: spend.error || 'Credit spend failed', amount }
  }

  const row: UsageLedgerRow = {
    userId: params.userId,
    action: params.action,
    conversationId: params.conversationId,
    messageId: params.messageId,
    referenceId: params.referenceId,
    creditAmount: amount,
    transactionId: spend.transactionId,
    inputTokens: params.usage?.inputTokens,
    outputTokens: params.usage?.outputTokens,
    totalTokens: params.usage?.totalTokens,
    model: params.model,
    provider: params.provider,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  }

  try {
    await db().createDoc('generative_usage', row, { id: params.referenceId.slice(0, 120) })
  } catch (error) {
    console.warn('generative_usage ledger write failed', error)
  }

  return { success: true, transactionId: spend.transactionId, amount }
}

export function getGenerativeCreditPrice(action: GenerativeBillAction): string {
  return priceForAction(action)
}
