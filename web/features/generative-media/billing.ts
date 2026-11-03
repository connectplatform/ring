import 'server-only'

import { db } from '@/lib/database'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  getCreditUnitPerNativeToken,
  getNativeTokenDecimals,
  getNativeTokenSymbol,
  getNativeTokenTreasuryAddress,
} from '@/lib/ring-config-chain'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import {
  getNativeTokenBalanceForUser,
  transferNativeTokenForUser,
} from '@/features/wallet/chains/native-token-transfer-service'

export type GenerativeBillAction = 'ghost_write' | 'image_gen' | 'video_gen' | 'product_research'

function priceForAction(action: GenerativeBillAction): string {
  const envKey =
    action === 'ghost_write'
      ? 'GENERATIVE_CREDIT_GHOST_WRITE'
      : action === 'video_gen'
        ? 'GENERATIVE_CREDIT_VIDEO'
        : action === 'product_research'
          ? 'GENERATIVE_CREDIT_PRODUCT_RESEARCH'
          : 'GENERATIVE_CREDIT_IMAGE'
  const raw = process.env[envKey]?.trim()
  if (raw && /^\d+(\.\d+)?$/.test(raw)) return raw
  // Defaults in credit units
  if (action === 'ghost_write') return '5'
  if (action === 'product_research') return '0.10'
  if (action === 'video_gen') return '50'
  return '15'
}

function creditsToNativeUi(credits: string): string | null {
  const creditAmount = Number(credits)
  const perToken = getCreditUnitPerNativeToken()
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return null
  if (!Number.isFinite(perToken) || perToken <= 0) return null
  const ui = creditAmount / perToken
  if (!Number.isFinite(ui) || ui <= 0) return null
  return ui.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

/** Charge the platform native token when the credit balance cannot cover the turn. */
async function billNativeTokenFallback(params: {
  userId: string
  creditAmount: string
  referenceId: string
  action: GenerativeBillAction
}): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  const uiAmount = creditsToNativeUi(params.creditAmount)
  const treasury = getNativeTokenTreasuryAddress()
  if (!uiAmount || !treasury || treasury === 'RING' || treasury.length < 32) {
    return { success: false, error: 'Insufficient credit balance for generative action' }
  }

  try {
    const balance = await getNativeTokenBalanceForUser(params.userId)
    if (Number(balance.balance) + 1e-9 < Number(uiAmount)) {
      return {
        success: false,
        error: 'Insufficient credit balance and native token balance for generative action',
      }
    }
    const raw = nativeTokenUiToRaw(uiAmount, getNativeTokenDecimals() ?? 8)
    const transfer = await transferNativeTokenForUser({
      userId: params.userId,
      toAddress: treasury,
      amount: raw.toString(),
    })
    return { success: true, transactionId: transfer.txHash }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Native token payment failed'
    if (/wallet not found|insufficient/i.test(message)) {
      return {
        success: false,
        error: 'Insufficient credit balance and native token balance for generative action',
      }
    }
    return { success: false, error: message }
  }
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
  let transactionId: string | undefined
  let paidWith: 'credit' | 'native_token' = 'credit'

  if (hasBalance) {
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
    transactionId = spend.transactionId
  } else {
    const nativeBill = await billNativeTokenFallback({
      userId: params.userId,
      creditAmount: amount,
      referenceId: params.referenceId,
      action: params.action,
    })
    if (!nativeBill.success) {
      return { success: false, error: nativeBill.error || 'Insufficient credit balance for generative action', amount }
    }
    transactionId = nativeBill.transactionId
    paidWith = 'native_token'
  }

  const row: UsageLedgerRow = {
    userId: params.userId,
    action: params.action,
    conversationId: params.conversationId,
    messageId: params.messageId,
    referenceId: params.referenceId,
    creditAmount: amount,
    transactionId,
    inputTokens: params.usage?.inputTokens,
    outputTokens: params.usage?.outputTokens,
    totalTokens: params.usage?.totalTokens,
    model: params.model,
    provider: params.provider,
    metadata: { ...(params.metadata || {}), paidWith, tokenSymbol: getNativeTokenSymbol() },
    createdAt: new Date().toISOString(),
  }

  try {
    await db().createDoc('generative_usage', row, { id: params.referenceId.slice(0, 120) })
  } catch (error) {
    console.warn('generative_usage ledger write failed', error)
  }

  return { success: true, transactionId, amount }
}

export function getGenerativeCreditPrice(action: GenerativeBillAction): string {
  return priceForAction(action)
}
