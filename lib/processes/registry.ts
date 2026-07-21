import 'server-only'

import { AITrainingPipeline } from '@/lib/ai/training-pipeline'
import { cleanupExpiredUsernameReservations } from '@/app/_actions/users'
import { cleanupExpiredReservations } from '@/features/store/services/inventory-sync'
import { processApprovedRewards } from '@/features/refcodes/services/reward-minter'
import { EmailAnalyticsService } from '@/features/email-crm/services/email-analytics-service'
import { getEmailProcessor } from '@/features/email-crm/pipeline/email-processor'
import { processDueSettlements } from '@/features/store/services/settlement'
import { validateEmailConfig } from '@/features/email-crm/pipeline/imap/config'
import { cleanupDeletedNews } from '@/features/news/services/cleanup-deleted-news'
import { runSubscriptionExpiryCheck } from '@/lib/processes/subscription/expiry-check'
import { runCreditBalanceMonthly } from '@/lib/processes/subscription/credit-balance-monthly'
import { runSubscriptionPaymentCheck } from '@/lib/processes/subscription/subscription-payment'
import { runSolanaBatchPayment } from '@/lib/processes/subscription/solana-nft-stubs'
import { runNftGateExpiry } from '@/lib/processes/subscription/solana-nft-stubs'
import type { PipelineDefinition } from '@/lib/processes/types'

/** Stable pipeline ids — display copy lives in locales (modules.admin.processes.pipelines.*). */
export const PIPELINE_IDS = [
  'email-processor',
  'email-analytics',
  'refcodes-mint',
  'cleanup-reservations',
  'cleanup-usernames',
  'cleanup-news-deleted',
  'train',
  'settlement-payout',
  'subscription-expiry-check',
  'credit-balance-monthly',
  'subscription-payment',
  'solana-batch-payment',
  'nft-gate-expiry',
] as const

export type PipelineId = (typeof PIPELINE_IDS)[number]

async function runEmailProcessorPoll() {
  const configCheck = validateEmailConfig()
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
