/**
 * Ring Platform - Business Subscription Types
 * 
 * TypeScript interfaces for Stripe-powered business subscription billing
 * Reverse propagated from: ring-pet-friendly (2026-02-17)
 * 
 * @description
 * Generic subscription types supporting B2B recurring revenue models:
 * - Vendor subscription tiers (premium marketplace listings)
 * - Entity promoted visibility (sponsored organizations)
 * - Opportunity featured listings (pay-to-promote jobs)
 * - Any B2B Ring clone with recurring business revenue
 * 
 * @billing_model
 * - One-time fees (listing fees, setup fees, activation fees)
 * - Recurring subscriptions (monthly, yearly billing)
 * - Tiered pricing (basic, premium, enterprise plans)
 * - Grace periods (3-7 days for failed payments)
 * - Automated visibility control (hide when subscription inactive)
 * 
 * @stripe_integration
 * - Stripe Customer API for business customers
 * - Stripe Subscriptions API for recurring billing
 * - Stripe Webhooks for status updates
 * - Payment Methods: Card, Apple Pay, Google Pay
 * 
 * @status_flow
 * pending → active → [grace_period if payment fails] → past_due → suspended/canceled
 * 
 * @see data/schema.sql for subscriptions table (commented-out, lines 567-650)
 * @see https://stripe.com/docs/billing/subscriptions/overview
 * 
 * @example Basic Usage
 * ```typescript
 * import { Subscription, SubscriptionData } from '@/types/subscription';
 * 
 * const subscription: Subscription = {
 *   id: 'sub_123',
 *   entity_id: 'ent_456',
 *   user_id: 'usr_789',
 *   stripe_customer_id: 'cus_abc',
 *   stripe_subscription_id: 'sub_def',
 *   data: {
 *     plan_type: 'premium',
 *     billing_period: 'monthly',
 *     monthly_price: 29.99,
 *     status: 'active',
 *     grace_period_days: 7
 *   },
 *   created_at: '2026-01-01T00:00:00Z',
 *   updated_at: '2026-01-01T00:00:00Z'
 * };
 * ```
 */

// ============================================================================
// SUBSCRIPTION ENUMS
// ============================================================================

/**
 * Subscription plan types
 * 
 * @example Ring Pet Friendly:
 * - basic: $10/month (standard visibility)
 * 
 * @example Multi-vendor marketplace:
 * - basic: $10/month (standard vendor)
 * - premium: $29/month (featured vendor + priority support)
 * - enterprise: $99/month (unlimited products + API access)
 */
export type SubscriptionPlanType = 'basic' | 'premium' | 'enterprise';

/**
 * Billing period frequency
 */
export type BillingPeriod = 'monthly' | 'yearly';

/**
 * Subscription payment status
 * 
 * @flow
 * pending: Subscription created, awaiting first payment
 * active: Payment successful, service active
 * grace_period: Payment failed, grace period active (entity still visible)
 * past_due: Grace period expired, payment still failed
 * canceled: User canceled subscription
 * suspended: Admin suspended subscription
 */
export type PaymentStatus = 
  | 'pending'
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'canceled'
  | 'suspended';

// ============================================================================
// SUBSCRIPTION DATA INTERFACE
// ============================================================================

/**
 * Subscription JSONB data structure
 * 
 * @description
 * Stored in subscriptions.data JSONB column for maximum flexibility.
 * Supports custom fields per Ring clone without schema migrations.
 */
export interface SubscriptionData {
  // Stripe Integration
  stripe_payment_intent_id?: string;
  
  // Plan Details
  plan_type?: SubscriptionPlanType;
  billing_period?: BillingPeriod;
  monthly_price?: number;
  yearly_price?: number;
  listing_fee?: number;
  setup_fee?: number;
  currency?: string; // ISO 4217 (USD, EUR, UAH, etc.)
  
  // Status
  status?: PaymentStatus;
  
  // Billing Periods
  trial_start_at?: string; // ISO timestamp
  trial_end_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at?: string; // Scheduled cancellation date
  canceled_at?: string; // Actual cancellation timestamp
  ended_at?: string;
  
  // Grace Period (Business Logic)
  grace_period_days?: number; // Default: 7 days
  grace_period_starts_at?: string;
  grace_period_ends_at?: string;
  grace_period_notifications_sent?: number;
  
  // Payment Tracking
  listing_fee_paid?: boolean;
  listing_fee_paid_at?: string;
  setup_fee_paid?: boolean;
  setup_fee_paid_at?: string;
  last_payment_at?: string;
  next_payment_at?: string;
  failed_payment_count?: number;
  last_payment_failure_at?: string;
  
  // Notification Flags
  renewal_reminder_sent?: boolean;
  renewal_reminder_sent_at?: string;
  payment_failure_notified?: boolean;
  payment_failure_notified_at?: string;
  cancellation_confirmed?: boolean;
  
  // Visibility Control (Automated)
  is_visible?: boolean; // Automatically set based on status
  visibility_controlled_at?: string;
  
  // Metadata (Extensible)
  metadata?: Record<string, any>;
}

/**
 * Subscription database record
 * 
 * @description
 * Complete subscription record from database with all columns.
 * 
 * @note
 * Foreign key (entity_id) should be customized per Ring clone:
 * - ring-pet-friendly: place_id (pet-friendly locations)
 * - marketplace: vendor_id (store vendors)
 * - job board: employer_id (job posters)
 * - real estate: agency_id (real estate agencies)
 */
export interface Subscription {
  id: string;
  entity_id: string; // CUSTOMIZE: place_id, vendor_id, employer_id, etc.
  user_id: string; // Business owner
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  data: SubscriptionData;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Subscription creation parameters
 */
export interface CreateSubscriptionParams {
  entity_id: string;
  user_id: string;
  plan_type: SubscriptionPlanType;
  billing_period: BillingPeriod;
  listing_fee?: number;
  monthly_price?: number;
  grace_period_days?: number;
}

/**
 * Subscription update parameters
 */
export interface UpdateSubscriptionParams {
  plan_type?: SubscriptionPlanType;
  billing_period?: BillingPeriod;
  status?: PaymentStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
}

/**
 * Subscription query filters
 */
export interface SubscriptionFilters {
  entity_id?: string;
  user_id?: string;
  status?: PaymentStatus | PaymentStatus[];
  plan_type?: SubscriptionPlanType;
  grace_period_active?: boolean; // Filter for subscriptions in grace period
  payment_due?: boolean; // Filter for next_payment_at < now
}

/**
 * Subscription with calculated fields
 */
export interface SubscriptionWithStatus extends Subscription {
  is_active: boolean;
  in_grace_period: boolean;
  is_past_due: boolean;
  days_until_expiry?: number;
  days_in_grace_period?: number;
}

// ============================================================================
// STRIPE WEBHOOK TYPES
// ============================================================================

/**
 * Stripe webhook event types relevant to subscriptions
 */
export type StripeWebhookEvent = 
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.subscription.trial_will_end'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed';

/**
 * Webhook payload structure
 */
export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: StripeWebhookEvent;
  data: {
    object: any; // Stripe subscription or invoice object
  };
  created: number;
}
