import { z } from 'zod'

/**
 * Trigger names for Credit Reward Events.
 * Phase-1 curated triggers are wired in ring-config credit.rewards.events;
 * remaining legacy enums stay for forward-compat (disabled / omitted from config).
 */
export const RewardCreditAddEventTriggerSchema = [
  'adminVerify',
  'ringUsername',
  'profileCompleted',
  'eventParticipation',
  'creditAdd',
  'creditSpend',
  'creditBalanceTopUp',
  'tokenDeskBuy',
  'tokenFirstSend',
  'tokenFirstReceive',
  'tokenFirstVote',
  'tokenFirstComment',
  'tokenFirstLike',
  'tokenFirstShare',
  'tokenFirstFollow',
  'tokenFirstUnfollow',
  'userMembershipFirstSubscribe',
  'userMembershipFirstRenew',
  'userBlogFirstPublish',
  'userBlogFirstComment',
  'userBlogFirstLike',
  'userBlogFirstShare',
  'userBlogFirstSubscribe',
  'newsStoryApproved',
  'commentCreated',
  'reviewCreated',
  'requestCreated',
  'addedBio',
  'addedLocation',
  'addedWebsite',
  'addedTwitter',
  'addedLinkedin',
  'addedFacebook',
  'addedInstagram',
  'addedYoutube',
  'addedTiktok',
  'addedSnapchat',
  'addedPinterest',
  'addedReddit',
  'addedDiscord',
  'addedTelegram',
  'addedWhatsapp',
  'addedAlipay',
  'addedPaypal',
  'addedBankTransfer',
  'addedCreditCard',
  'addedDebitCard',
  'addedApplePay',
  'addedGooglePay',
  'addedSamsungPay',
  'addedMicrosoftPay',
  'addedAmazonPay',
  'addedPaytm',
  'addedPhonepe',
  'addedGpay',
  'addedPayoneer',
  'addedSkrill',
  'addedNeteller',
  'addedPaysafecard',
  'addedTrustly',
  'addedEcopayz',
  'addedPoli',
  'addedBoleto',
  'addedPix',
  'addedRapipago',
  'addedOxxo',
  'addedPagoEfectivo',
  'addedPagoFacil',
  'addedPagoMovil',
] as const

export type RewardCreditAddEventTrigger = (typeof RewardCreditAddEventTriggerSchema)[number]

export const RewardIdempotencyModeSchema = z.enum(['once_per_user', 'once_per_object'])
export type RewardIdempotencyMode = z.infer<typeof RewardIdempotencyModeSchema>

/**
 * Per-trigger rule in ring-config credit.rewards.events.
 * objectType / objectId are enqueue params when idempotencyMode is once_per_object.
 */
export const RewardCreditAddEventRuleSchema = z.object({
  amount: z.string(),
  enabled: z.boolean().optional().default(true),
  requireUsername: z.boolean().optional().default(true),
  requireVerified: z.boolean().optional(),
  idempotencyMode: RewardIdempotencyModeSchema.optional().default('once_per_user'),
})

export const RewardCreditAddEventRuleMapSchema = z.record(
  z.enum(RewardCreditAddEventTriggerSchema as unknown as [string, ...string[]]),
  RewardCreditAddEventRuleSchema
)

export const RewardCreditAddEventRuleTriggerSchema = z.enum([
  ...RewardCreditAddEventTriggerSchema,
])

export const RewardCreditAddEventStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
  'skipped',
])

/**
 * Credit-balance reward event audit row (credit_add_events).
 * Unit label / fiat accounting: ring-config credit.creditUnitLabel + unitToDefaultCurrency.
 */
export const RewardCreditAddEventConfigSchema = z.object({
  id: z.string().min(1),
  trigger: z.enum(RewardCreditAddEventTriggerSchema as unknown as [string, ...string[]]),
  rule: RewardCreditAddEventRuleSchema,
  idempotency_key: z.string().min(8).max(200),
  user_id: z.string().min(1),
  amount: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.any()),
  transaction_id: z.string().optional(),
  completed_at: z.string().optional(),
  failure_reason: z.string().optional(),
  status: RewardCreditAddEventStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

export const RewardCreditAddEventRuleValueSchema = RewardCreditAddEventRuleSchema

export const CreditRewardsConfigSchema = z.object({
  minRole: z.string().optional().default('subscriber'),
  multipliers: z.record(z.string(), z.number().positive()).optional(),
  dailyEarnCap: z.record(z.string(), z.number().nonnegative()).optional(),
  events: RewardCreditAddEventRuleMapSchema.optional(),
})

export type RewardCreditAddEventConfig = z.infer<typeof RewardCreditAddEventConfigSchema> & {
  id?: string
}
export type RewardCreditAddEventRule = z.infer<typeof RewardCreditAddEventRuleSchema>
export type RewardCreditAddEventStatus = z.infer<typeof RewardCreditAddEventStatusSchema>
export type RewardCreditAddEventRuleValue = z.infer<typeof RewardCreditAddEventRuleValueSchema>
export type CreditRewardsConfig = z.infer<typeof CreditRewardsConfigSchema>
