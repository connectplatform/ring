/**
 * Store Constants for Multi-Vendor Marketplace
 * 
 * This file contains all constants related to the Ring Store multi-vendor marketplace functionality.
 * The main store (id: '1') serves as the central marketplace where all products can be listed.
 */

// Main Store Configuration
export const MAIN_STORE_ID = '1'
export const MAIN_STORE_NAME = 'Ring Marketplace'
export const MAIN_STORE_SLUG = 'marketplace'

// Vendor Configuration
export const DEFAULT_COMMISSION_PCT = 15
export const MIN_VENDOR_TRUST_SCORE = 50
export const MAX_PENDING_VENDORS = 100
export const VENDOR_REVIEW_PERIOD_DAYS = 30

// Store Status Values
export enum StoreStatus {
  PENDING = 'pending',
  TEST = 'test',
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended'
}

// Store Tier Levels
export enum StoreTier {
  STARTER = 'starter',
  GROWTH = 'growth',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

// Store Visibility (aligns with Entity.visibility pattern)
export enum StoreVisibility {
  PUBLIC = 'public',
  SUBSCRIBER = 'subscriber',
  MEMBER = 'member',
  CONFIDENTIAL = 'confidential'
}

// Vendor Trust Levels
export enum VendorTrustLevel {
  NEW = 'new',
  BASIC = 'basic',
  VERIFIED = 'verified',
  TRUSTED = 'trusted',
  PREMIUM = 'premium'
}

// Vendor Onboarding Status
export enum VendorOnboardingStatus {
  STARTED = 'started',
  DOCUMENTS_PENDING = 'documents_pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// Product Listing Types
export enum ProductListingType {
  OWNED = 'owned',
  CONSIGNMENT = 'consignment',
  DROPSHIP = 'dropship',
  AFFILIATE = 'affiliate'
}

// Product Status
export enum ProductStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  FLAGGED = 'flagged'
}

// Inventory Sync Strategies
export enum InventorySyncStrategy {
  MASTER = 'master',
  DISTRIBUTED = 'distributed',
  RESERVED = 'reserved'
}

// Settlement Frequency
export enum SettlementFrequency {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

// Fulfillment Status
export enum FulfillmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned'
}

// Payment Processors
export enum PaymentProcessor {
  STRIPE = 'stripe',
  SQUARE = 'square',
  PAYPAL = 'paypal',
  ADYEN = 'adyen',
  BRAINTREE = 'braintree',
  PAYNOW = 'paynow',
  WAYFORPAY = 'wayforpay',
  PAYU = 'payu',
  PAYWAY = 'payway',
  PAYEER = 'payeer'
}

// Commission Structure Defaults
export const DEFAULT_COMMISSION_STRUCTURE = {
  platformCommission: DEFAULT_COMMISSION_PCT,
  referralCommission: 5,
  customSplits: []
}

// Performance Metric Thresholds
export const VENDOR_PERFORMANCE_THRESHOLDS = {
  orderFulfillmentRate: 95, // %
  onTimeShipmentRate: 90, // %
  customerSatisfactionScore: 4.0, // out of 5
  maxReturnRate: 5, // %
  maxDisputeRate: 2, // %
  minResponseTime: 24 // hours
}

// Trust Score Calculation Weights
export const TRUST_SCORE_WEIGHTS = {
  orderFulfillmentRate: 0.25,
  onTimeShipmentRate: 0.20,
  customerSatisfactionScore: 0.25,
  returnRate: 0.15,
  disputeRate: 0.15
}

// Store Events for Event-Driven Architecture
export enum StoreEvent {
  STORE_CREATED = 'store.created',
  STORE_VERIFIED = 'store.verified',
  STORE_SUSPENDED = 'store.suspended',
  PRODUCT_LISTED = 'product.listed',
  PRODUCT_DELISTED = 'product.delisted',
  INVENTORY_UPDATED = 'inventory.updated',
  ORDER_PLACED = 'order.placed',
  ORDER_SPLIT = 'order.split',
  PAYOUT_INITIATED = 'payout.initiated',
  VENDOR_TIER_CHANGED = 'vendor.tier_changed'
}

// Tier Benefits Configuration
export const TIER_BENEFITS = {
  [StoreTier.STARTER]: {
    maxProducts: 50,
    commissionRate: 20,
    settlementFrequency: SettlementFrequency.WEEKLY,
    supportLevel: 'basic',
    analyticsAccess: 'basic'
  },
  [StoreTier.GROWTH]: {
    maxProducts: 200,
    commissionRate: 17,
    settlementFrequency: SettlementFrequency.DAILY,
    supportLevel: 'priority',
    analyticsAccess: 'advanced'
  },
  [StoreTier.PROFESSIONAL]: {
    maxProducts: 1000,
    commissionRate: 15,
    settlementFrequency: SettlementFrequency.DAILY,
    supportLevel: 'dedicated',
    analyticsAccess: 'professional'
  },
  [StoreTier.ENTERPRISE]: {
    maxProducts: -1, // unlimited
    commissionRate: 12,
    settlementFrequency: SettlementFrequency.INSTANT,
    supportLevel: 'white-glove',
    analyticsAccess: 'enterprise'
  }
}

// Supported Currencies for Multi-Vendor
export const SUPPORTED_CURRENCIES = [
  'RING',
  'DAAR',
  'DAARION',
  'USD',
  'EUR',
  'UAH',
  'GBP',
  'CAD',
  'AUD'
]

// Default Store Settings
export const DEFAULT_STORE_SETTINGS = {
  autoApproveProducts: false,
  allowGuestCheckout: true,
  requireInventoryTracking: true,
  enableInstantPayouts: false
}
