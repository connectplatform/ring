import { z } from 'zod'

/**
 * The trigger names for Credit Reward Events.
 */
export const RewardCreditAddEventTriggerSchema = [
  'adminVerify',         // User verified by admin (KYC)
  'ringUsername',        // User set a unique username
  'profileCompleted',    // User completed profile data
  'eventParticipation',  // User participated in a platform event
  'creditAdd',           // User added credit points
  'creditSpend',         // User spent credit points
  'creditBalanceTopUp',  // User topped up credit balance
  'tokenDeskBuy',        // User bought tokens from token desk
  'tokenFirstSend',      // User sent tokens to first recipient
  'tokenFirstReceive',   // User received tokens from first sender
  'tokenFirstVote',      // User voted on first proposal
  'tokenFirstComment',   // User commented on first post
  'tokenFirstLike',      // User liked first post
  'tokenFirstShare',     // User shared first post
  'tokenFirstFollow',    // User followed first user
  'tokenFirstUnfollow',  // User unfollowed first user
  'userMembershipFirstSubscribe', // User subscribed to user membership
  'userMembershipFirstRenew',     // User renewed user membership
  'userBlogFirstPublish',         // User published first blog post
  'userBlogFirstComment',         // User commented on first blog post
  'userBlogFirstLike',            // User liked first blog post
  'userBlogFirstShare',           // User shared first blog post
  'userBlogFirstSubscribe',       // User subscribed to first blog post
  'addedBio',              // User added bio
  'addedLocation',         // User added location
  'addedWebsite',          // User added website
  'addedTwitter',          // User added Twitter
  'addedLinkedin',         // User added LinkedIn
  'addedFacebook',         // User added Facebook
  'addedInstagram',        // User added Instagram
  'addedYoutube',          // User added YouTube
  'addedTiktok',           // User added TikTok
  'addedSnapchat',         // User added Snapchat
  'addedPinterest',        // User added Pinterest
  'addedReddit',           // User added Reddit
  'addedDiscord',          // User added Discord
  'addedTelegram',         // User added Telegram
  'addedWhatsapp',         // User added WhatsApp
  'addedAlipay',           // User added Alipay
  'addedPaypal',           // User added PayPal
  'addedBankTransfer',     // User added bank transfer
  'addedCreditCard',       // User added credit card
  'addedDebitCard',        // User added debit card
  'addedApplePay',         // User added Apple Pay
  'addedGooglePay',        // User added Google Pay
  'addedSamsungPay',       // User added Samsung Pay
  'addedMicrosoftPay',     // User added Microsoft Pay
  'addedAmazonPay',        // User added Amazon Pay
  'addedPaytm',            // User added Paytm
  'addedPhonepe',          // User added Phonepe
  'addedGpay',             // User added Gpay
  'addedPayoneer',         // User added Payoneer
  'addedSkrill',           // User added Skrill
  'addedNeteller',         // User added Neteller
  'addedPaysafecard',      // User added Paysafecard
  'addedTrustly',          // User added Trustly
  'addedEcopayz',          // User added Ecopayz
  'addedPoli',             // User added Poli
  'addedBoleto',           // User added Boleto
  'addedPix',              // User added Pix
  'addedRapipago',         // User added Rapipago
  'addedOxxo',             // User added Oxxo
  'addedPagoEfectivo',     // User added Pago Efectivo
  'addedPagoFacil',        // User added Pago Facil
  'addedPagoMovil',        // User added Pago Movil
  'addedPaypal',           // User added PayPal (legacy/duplicate)
] as const

export type RewardCreditAddEventTrigger = typeof RewardCreditAddEventTriggerSchema[number]

/**
 * Rules for Credit Reward Events mapped by trigger.
 */
// type RewardCreditAddEventRule = {
//   amount: string
//   enabled?: boolean
//   requireUsername?: boolean
//   requireVerified?: boolean
// }

export const RewardCreditAddEventRuleSchema = z.object({
  amount: z.string(),
  enabled: z.boolean().optional().default(true),
  requireUsername: z.boolean().optional().default(true),
  requireVerified: z.boolean().optional(),
})

export const RewardCreditAddEventRuleMapSchema = z.record(
  z.enum(RewardCreditAddEventTriggerSchema as unknown as [string, ...string[]]),
  RewardCreditAddEventRuleSchema
)

/**
 * Reward credit add triggers for 'credit-balance add events.
 *
 * SSOT: Rewards are awarded in user credit points (see ring-config) for completed
 * user actions. On-chain native token airdrops are TODO.
 */
export const RewardCreditAddEventRuleTriggerSchema = z.enum([...RewardCreditAddEventTriggerSchema])

export const RewardCreditAddEventStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
  'skipped',
])

/**
 * Credit-balance reward credit add event — represents a credit point reward event.
 *
 * SSOT: 1 User credit point is 1 USD on ring-platform.org.
 *       This is configurable in ring-config.json.
 * Reward credit events are recorded in the `credit_add_event` collection for audit trail.
 */
export const RewardCreditAddEventConfigSchema = z.object({
  id: z.string().uuid(),
  trigger: z.enum(RewardCreditAddEventTriggerSchema as unknown as [string, ...string[]]),
  rule: RewardCreditAddEventRuleSchema,
  idempotency_key: z.string().min(8).max(200),
  user_id: z.string().uuid(),
  amount: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.any()),
  transaction_id: z.string().uuid().optional(),
  completed_at: z.string().optional(),
  failure_reason: z.string().optional(),
  status: RewardCreditAddEventStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

export const RewardCreditAddEventRuleValueSchema = z.object({
  amount: z.string(),
  enabled: z.boolean().optional().default(true),
  requireUsername: z.boolean().optional().default(true),
  requireVerified: z.boolean().optional(),
});

export type RewardCreditAddEventConfig = z.infer<typeof RewardCreditAddEventConfigSchema> & { id?: string }
export type RewardCreditAddEventRule = z.infer<typeof RewardCreditAddEventRuleSchema>
export type RewardCreditAddEventStatus = z.infer<typeof RewardCreditAddEventStatusSchema>
export type RewardCreditAddEventRuleValue = z.infer<typeof RewardCreditAddEventRuleValueSchema>