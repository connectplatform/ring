import 'server-only'

import { db } from '@/lib/database'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'

/** Shared credit price for soft-gate + bill (invalid env → default 25). */
export function priceForMoodMusic(): string {
  const raw = process.env.GENERATIVE_CREDIT_MOOD_MUSIC?.trim()
  if (raw && /^\d+(\.\d+)?$/.test(raw)) return raw
  return '25'
}

type MoodMusicUsageRow = {
  userId: string
  action: 'mood_music_gen'
  referenceId: string
  creditAmount: string
  transactionId?: string
  playlistId?: string
  songId?: string
  moodId?: string
  provider?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export async function billMoodMusicGeneration(params: {
  userId: string
  referenceId: string
  playlistId?: string
  songId?: string
  moodId?: string
  provider?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string; transactionId?: string; amount?: string }> {
  const amount = priceForMoodMusic()

  try {
    const existing = await db().queryDocs<MoodMusicUsageRow>({
      collection: 'generative_usage',
      filters: [{ field: 'referenceId', operator: '==', value: params.referenceId }],
      pagination: { limit: 1 },
    })
    if (existing.success && existing.data?.length) {
      return { success: true, transactionId: existing.data[0].transactionId, amount }
    }
  } catch {
    // continue
  }

  const hasBalance = await creditBalanceService.hasSufficientBalance(params.userId, amount)
  if (!hasBalance) {
    return { success: false, error: 'Insufficient credit balance for mood music generation', amount }
  }

  const spend = await WalletConductor.spendCredits({
    userId: params.userId,
    amount,
    description: 'Generative mood music',
    referenceId: params.referenceId,
    type: 'payment',
    metadata: {
      type: 'payment',
      generative: true,
      action: 'mood_music_gen',
      playlistId: params.playlistId,
      songId: params.songId,
      moodId: params.moodId,
      ...(params.metadata || {}),
    },
  })

  if (!spend.success) {
    return { success: false, error: spend.error || 'Credit spend failed', amount }
  }

  const row: MoodMusicUsageRow = {
    userId: params.userId,
    action: 'mood_music_gen',
    referenceId: params.referenceId,
    creditAmount: amount,
    transactionId: spend.transactionId,
    playlistId: params.playlistId,
    songId: params.songId,
    moodId: params.moodId,
    provider: params.provider,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  }

  try {
    await db().createDoc('generative_usage', row, { id: params.referenceId.slice(0, 120) })
  } catch (error) {
    console.warn('generative_usage mood music ledger write failed', error)
  }

  return { success: true, transactionId: spend.transactionId, amount }
}
