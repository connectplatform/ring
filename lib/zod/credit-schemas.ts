import { z } from 'zod';

/**
 * Credit transaction type enum
 */
export const CreditTransactionType = z.enum([
  'payment',        // Direct payment/purchase with RING tokens
  'airdrop',        // Free tokens given to user
  'reimbursement',  // Refund or compensation  
  'purchase',       // Store purchase using credits
  'membership_fee', // Monthly membership fee deduction
  'top_up',         // User-initiated balance top-up
  'bonus',          // Loyalty/referral bonuses
  'penalty',        // Administrative deductions
]);

export type CreditTransactionType = z.infer<typeof CreditTransactionType>;

/**
 * Credit transaction schema for individual balance changes
 */
export const CreditTransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: CreditTransactionType,
  amount: z.string().regex(/^-?\d+(\.\d+)?$/, 'Amount must be a valid number string'),
  usd_rate: z.string().regex(/^\d+(\.\d+)?$/, 'USD rate must be a positive number string'),
  usd_equivalent: z.string().regex(/^-?\d+(\.\d+)?$/, 'USD equivalent must be a valid number string'),
  balance_after: z.string().regex(/^\d+(\.\d+)?$/, 'Balance after must be a positive number string'),
  timestamp: z.number().int().positive(),
  description: z.string().min(1).max(500),
  tx_hash: z.string().optional(),
  order_id: z.string().optional(),
  reference_id: z.string().optional(), // Additional reference for external systems
  metadata: z.record(z.any(), z.any()).optional(), // Additional structured data
});

export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

/**
 * User credit balance schema - stored in user profile
 */
export const UserCreditBalanceSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number string'),
  usd_equivalent: z.string().regex(/^\d+(\.\d+)?$/, 'USD equivalent must be a positive number string'),
  last_updated: z.number().int().positive(),
  last_transaction_id: z.string().optional(),
  subscription_active: z.boolean().default(false),
  subscription_contract_address: z.string().optional(),
  subscription_next_payment: z.number().int().optional(),
});

export type UserCreditBalance = z.infer<typeof UserCreditBalanceSchema>;

/**
 * Extended user profile schema with credit balance
 */
export const UserProfileWithCreditsSchema = z.object({
  // Existing user profile fields would be here
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['VISITOR', 'SUBSCRIBER', 'MEMBER', 'CONFIDENTIAL', 'ADMIN']),
  created_at: z.number().int().positive(),
  updated_at: z.number().int().positive(),
  
  // Credit balance extension
  credit_balance: UserCreditBalanceSchema.optional(),
});

export type UserProfileWithCredits = z.infer<typeof UserProfileWithCreditsSchema>;

/**
 * Credit operation request schemas for API endpoints
 */
export const CreditTopUpRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number string'),
  description: z.string().min(1).max(200),
  tx_hash: z.string().optional(),
  metadata: z.record(z.any(), z.any()).optional(),
});

export type CreditTopUpRequest = z.infer<typeof CreditTopUpRequestSchema>;

export const CreditSpendRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number string'),
  description: z.string().min(1).max(200),
  order_id: z.string().optional(),
  reference_id: z.string().optional(),
  metadata: z.record(z.any(), z.any()).optional(),
});

export type CreditSpendRequest = z.infer<typeof CreditSpendRequestSchema>;

/**
 * Credit balance response schema
 */
export const CreditBalanceResponseSchema = z.object({
  balance: z.object({
    amount: z.string(),
    usd_equivalent: z.string(),
    last_updated: z.number(),
  }),
  subscription: z.object({
    active: z.boolean(),
    contract_address: z.string().optional(),
    next_payment: z.number().optional(),
    status: z.enum(['INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED']).optional(),
  }),
  limits: z.object({
    monthly_spend_limit: z.string(),
    remaining_monthly_limit: z.string(),
    min_balance_warning: z.string(),
  }),
});

export type CreditBalanceResponse = z.infer<typeof CreditBalanceResponseSchema>;

/**
 * Credit transaction history request schema
 */
export const CreditHistoryRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  after_id: z.string().optional(),
  type: CreditTransactionType.optional(),
  start_date: z.number().int().optional(),
  end_date: z.number().int().optional(),
});

export type CreditHistoryRequest = z.infer<typeof CreditHistoryRequestSchema>;

/**
 * Credit transaction history response schema
 */
export const CreditHistoryResponseSchema = z.object({
  transactions: z.array(CreditTransactionSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
  total_count: z.number().int().optional(),
  summary: z.object({
    total_credits: z.string(),
    total_debits: z.string(),
    net_change: z.string(),
    transaction_count: z.number().int(),
  }),
});

export type CreditHistoryResponse = z.infer<typeof CreditHistoryResponseSchema>;

/**
 * Membership subscription status schema
 */
export const SubscriptionStatusSchema = z.object({
  user_id: z.string(),
  status: z.enum(['INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED']),
  contract_address: z.string().optional(),
  start_time: z.number().int().optional(),
  next_payment_due: z.number().int().optional(),
  failed_attempts: z.number().int().default(0),
  auto_renew: z.boolean().default(true),
  total_paid: z.string().default('0'),
  payments_count: z.number().int().default(0),
});

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
