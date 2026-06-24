import { z } from 'zod'

export const PUBLIC_POOL_KINDS = ['future_feature'] as const
export const PUBLIC_POOL_STATUSES = [
  'open',
  'queued',
  'in_progress',
  'completed',
  'cancelled',
] as const
export const PUBLIC_POOL_FUNDING_MODES = ['donation', 'escrow'] as const
export const PUBLIC_POOL_SIGNAL_KINDS = ['like'] as const
export const PUBLIC_POOL_CONTRIBUTION_STATUSES = [
  'pending',
  'confirmed',
  'failed',
  'refunded',
] as const

export const PublicPoolKindSchema = z.enum(PUBLIC_POOL_KINDS)
export const PublicPoolStatusSchema = z.enum(PUBLIC_POOL_STATUSES)
export const PublicPoolFundingModeSchema = z.enum(PUBLIC_POOL_FUNDING_MODES)

export const PublicPoolOnChainSchema = z.object({
  program_id: z.string().optional(),
  pool_pda: z.string().optional(),
  vault_ata: z.string().optional(),
})

export const PublicPoolSchema = z.object({
  clone_id: z.string().min(1),
  pool_kind: PublicPoolKindSchema,
  pool_slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  labels: z.array(z.string()).default([]),
  goal_hours: z.number().int().min(1),
  goal_ring: z.string().min(1),
  funding_mode: PublicPoolFundingModeSchema.default('donation'),
  status: PublicPoolStatusSchema.default('open'),
  like_count: z.number().int().min(0).default(0),
  pledged_ring: z.string().default('0'),
  queued_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
  doc_path: z.string().optional().nullable(),
  on_chain: PublicPoolOnChainSchema.optional().nullable(),
  signal_at_completion: z.number().int().min(0).optional().nullable(),
})

export const PublicPoolSignalSchema = z.object({
  clone_id: z.string().min(1),
  pool_id: z.string().min(1),
  user_id: z.string().min(1),
  kind: z.enum(PUBLIC_POOL_SIGNAL_KINDS).default('like'),
  active: z.boolean().default(true),
})

export const PublicPoolContributionSchema = z.object({
  clone_id: z.string().min(1),
  pool_id: z.string().min(1),
  user_id: z.string().min(1),
  amount_ring: z.string().min(1),
  funding_mode: PublicPoolFundingModeSchema.default('donation'),
  status: z.enum(PUBLIC_POOL_CONTRIBUTION_STATUSES).default('pending'),
  tx_hash: z.string().optional().nullable(),
  idempotency_key: z.string().uuid(),
  from_address: z.string().optional().nullable(),
  to_address: z.string().optional().nullable(),
  chain: z.literal('solana').default('solana'),
})

export const PublicPoolContributeRequestSchema = z.object({
  amount_ring: z.string().min(1),
  idempotency_key: z.string().uuid(),
  funding_mode: PublicPoolFundingModeSchema.default('donation'),
})

export const PublicPoolContributeConfirmSchema = z.object({
  idempotency_key: z.string().uuid(),
  tx_hash: z.string().min(1),
})

export const PublicPoolStatusUpdateSchema = z.object({
  status: z.enum(['queued', 'in_progress', 'completed', 'cancelled', 'open']),
})

/** Admin manual create — pool_slug optional (auto `manual:{kebab-title}`). */
export const PublicPoolAdminCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  pool_kind: PublicPoolKindSchema.default('future_feature'),
  pool_slug: z.string().min(1).optional(),
  goal_hours: z.coerce.number().int().min(1),
  labels: z.array(z.string()).default([]),
  doc_path: z.string().optional().nullable(),
  funding_mode: PublicPoolFundingModeSchema.default('donation'),
  status: PublicPoolStatusSchema.default('open'),
})

/** Admin full update — pool_slug is immutable after create. */
export const PublicPoolAdminUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  pool_kind: PublicPoolKindSchema.optional(),
  goal_hours: z.coerce.number().int().min(1).optional(),
  labels: z.array(z.string()).optional(),
  doc_path: z.string().optional().nullable(),
  funding_mode: PublicPoolFundingModeSchema.optional(),
  status: PublicPoolStatusSchema.optional(),
})

export type PublicPoolAdminCreate = z.infer<typeof PublicPoolAdminCreateSchema>
export type PublicPoolAdminUpdate = z.infer<typeof PublicPoolAdminUpdateSchema>

export type PublicPool = z.infer<typeof PublicPoolSchema>
export type PublicPoolSignal = z.infer<typeof PublicPoolSignalSchema>
export type PublicPoolContribution = z.infer<typeof PublicPoolContributionSchema>
export type PublicPoolDoc = PublicPool & { id: string }

export type PublicPoolStatsResponse = {
  pool: PublicPoolDoc
  user_has_liked: boolean
  like_threshold: number
  funding_progress_pct: number
  likes_progress_pct: number
  queue_eligible: boolean
}
