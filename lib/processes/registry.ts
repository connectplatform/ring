import 'server-only'

import { AITrainingPipeline } from '@/lib/ai/training-pipeline'
import { cleanupExpiredUsernameReservations } from '@/app/_actions/users'
import { cleanupExpiredReservations, detectInventoryDrift } from '@/features/store/services/inventory-sync'
import { processApprovedRewards } from '@/features/refcodes/services/reward-minter'
import { EmailAnalyticsService } from '@/features/email-crm/services/email-analytics-service'
import { getEmailProcessor } from '@/features/email-crm/pipeline/email-processor'
import { processDueSettlements } from '@/features/store/services/settlement'
import { loadCrmChannels, validateCrmChannels } from '@/features/email-crm/pipeline/imap/config'
import { cleanupDeletedNews } from '@/features/news/services/cleanup-deleted-news'
import { cleanupExpiredEmailTokens } from '@/features/auth/services/email-login-tokens'
import { runSubscriptionExpiryCheck } from '@/lib/processes/subscription/expiry-check'
import { runCreditBalanceMonthly } from '@/lib/processes/subscription/credit-balance-monthly'
import { runSubscriptionPaymentCheck } from '@/lib/processes/subscription/subscription-payment'
import { runSolanaBatchPayment } from '@/lib/processes/subscription/solana-nft-stubs'
import { runNftGateExpiry } from '@/lib/processes/subscription/solana-nft-stubs'
import { closeExpiredPolls } from '@/features/chat/lib/close-expired-polls'
import { expirePeerGameSessions } from '@/features/peer-games/session-expiry'
import type { PipelineDefinition } from '@/lib/processes/types'

/** Stable pipeline ids — display copy lives in locales (modules.admin.processes.pipelines.*). */
export const PIPELINE_IDS = [
  'email-processor',
  'email-analytics',
  'refcodes-mint',
  'cleanup-reservations',
  'cleanup-usernames',
  'cleanup-news-deleted',
  'cleanup-email-tokens',
  'train',
  'settlement-payout',
  'inventory-drift',
  'subscription-expiry-check',
  'credit-balance-monthly',
  'subscription-payment',
  'solana-batch-payment',
  'nft-gate-expiry',
  'close-expired-polls',
  'peer-game-session-expiry',
] as const

export type PipelineId = (typeof PIPELINE_IDS)[number]

async function runEmailProcessorPoll() {
  const channels = loadCrmChannels()
  const configCheck = validateCrmChannels(channels)
  if (!configCheck.valid) {
    throw new Error(`Invalid email config: ${configCheck.errors.join(', ')}`)
  }
  const processor = getEmailProcessor()
  const result = await processor.pollInboundBatch()
  return { ...result, stats: processor.getStats() }
}

async function runTrainPipeline() {
  const pipeline = new AITrainingPipeline()
  const data = await pipeline.collectTrainingData()
  const patterns = await pipeline.extractPatterns(data)
  await pipeline.updateModels(patterns)
  await pipeline.deployUpdates()
  return { ok: true, examples: data.length, patterns: patterns.patterns.length }
}

export const PIPELINE_REGISTRY: PipelineDefinition[] = [
  {
    id: 'email-processor',
    category: 'email',
    cronPath: '/api/cron/email-processor',
    handler: runEmailProcessorPoll,
  },
  {
    id: 'email-analytics',
    category: 'email',
    cronPath: '/api/cron/email-analytics',
    handler: async () => EmailAnalyticsService.getDashboard('7d'),
  },
  {
    id: 'refcodes-mint',
    category: 'rewards',
    cronPath: '/api/cron/refcodes-mint',
    handler: async () => processApprovedRewards(20),
  },
  {
    id: 'cleanup-reservations',
    category: 'cleanup',
    cronPath: '/api/cron/cleanup-reservations',
    handler: async () => {
      const startTime = Date.now()
      await cleanupExpiredReservations()
      return { success: true, duration: Date.now() - startTime }
    },
  },
  {
    id: 'cleanup-usernames',
    category: 'cleanup',
    cronPath: '/api/cron/cleanup-usernames',
    handler: async () => {
      const startTime = Date.now()
      const result = await cleanupExpiredUsernameReservations()
      return { success: true, cleaned: result.cleaned, duration: Date.now() - startTime }
    },
  },
  {
    id: 'cleanup-news-deleted',
    category: 'cleanup',
    cronPath: '/api/cron/cleanup-news-deleted',
    handler: async () => {
      const startTime = Date.now()
      const result = await cleanupDeletedNews()
      return { ...result, success: true, duration: Date.now() - startTime }
    },
  },
  {
    id: 'cleanup-email-tokens',
    category: 'cleanup',
    cronPath: '/api/cron/cleanup-email-tokens',
    handler: async () => {
      const startTime = Date.now()
      const cleaned = await cleanupExpiredEmailTokens()
      return { success: true, cleaned, duration: Date.now() - startTime }
    },
  },
  {
    id: 'train',
    category: 'ai',
    cronPath: '/api/cron/train',
    handler: runTrainPipeline,
  },
  {
    id: 'settlement-payout',
    category: 'commerce',
    cronPath: '/api/cron/settlement-payout',
    handler: async () => processDueSettlements(),
  },
  {
    id: 'inventory-drift',
    category: 'commerce',
    cronPath: '/api/cron/inventory-drift',
    handler: async () => {
      const startTime = Date.now()
      const report = await detectInventoryDrift(500)
      return { success: true, ...report, duration: Date.now() - startTime }
    },
  },
  // ---- Membership subscription cron pipelines (Phase S4) ----
  {
    id: 'subscription-expiry-check',
    category: 'membership',
    cronPath: '/api/cron/subscription-expiry',
    handler: runSubscriptionExpiryCheck,
  },
  {
    id: 'credit-balance-monthly',
    category: 'membership',
    cronPath: '/api/cron/credit-balance-monthly',
    handler: runCreditBalanceMonthly,
  },
  {
    id: 'subscription-payment',
    category: 'membership',
    cronPath: '/api/cron/subscription-payment',
    handler: runSubscriptionPaymentCheck,
  },
  {
    id: 'solana-batch-payment',
    category: 'membership',
    cronPath: '/api/cron/solana-batch-payment',
    handler: runSolanaBatchPayment,
  },
  {
    id: 'nft-gate-expiry',
    category: 'membership',
    cronPath: '/api/cron/nft-gate-expiry',
    handler: runNftGateExpiry,
  },
  {
    id: 'close-expired-polls',
    category: 'cleanup',
    cronPath: '/api/cron/close-expired-polls',
    handler: async () => closeExpiredPolls(),
  },
  {
    id: 'peer-game-session-expiry',
    category: 'cleanup',
    cronPath: '/api/cron/peer-game-session-expiry',
    handler: async () => expirePeerGameSessions(),
  },
]

const registryById = new Map(PIPELINE_REGISTRY.map((p) => [p.id, p]))

export function getPipelineDefinition(id: string): PipelineDefinition | undefined {
  return registryById.get(id)
}

export function listPipelineDefinitions(): PipelineDefinition[] {
  return [...PIPELINE_REGISTRY]
}

export function isPipelineId(id: string): id is PipelineId {
  return (PIPELINE_IDS as readonly string[]).includes(id)
}
