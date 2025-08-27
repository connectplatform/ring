/**
 * Vendor Profile Types for Multi-Vendor Marketplace
 * 
 * This file contains all types related to vendor profiles, lifecycle management,
 * and merchant configurations for the Ring Store multi-vendor marketplace.
 */

import { 
  VendorOnboardingStatus, 
  VendorTrustLevel,
  SettlementFrequency,
  PaymentProcessor,
  StoreTier
} from '@/constants/store'

// Vendor Performance Metrics
export interface VendorPerformanceMetrics {
  orderFulfillmentRate: number // percentage
  onTimeShipmentRate: number // percentage
  customerSatisfactionScore: number // 1-5 scale
  returnProcessingTime: number // in hours
  totalOrders?: number
  totalRevenue?: number
}

// Compliance Status
export interface VendorComplianceStatus {
  taxDocumentsSubmitted: boolean
  termsAccepted: boolean
  dataProcessingAgreementSigned: boolean
  lastComplianceCheck?: string // ISO date string
  complianceNotes?: string
}

// Suspension History Entry
export interface SuspensionHistoryEntry {
  reason: string
  date: string // ISO date string
  duration: number // in days
  resolved: boolean
  resolvedDate?: string
  resolvedBy?: string
  notes?: string
}

// Tier Progression Entry
export interface TierProgressionEntry {
  fromTier: VendorTrustLevel
  toTier: VendorTrustLevel
  date: string // ISO date string
  reason: string
  automaticProgression: boolean
}

// Main Vendor Profile
export interface VendorProfile {
  id: string
  entityId: string
  userId: string // owner user ID
  
  // Onboarding
  onboardingStatus: VendorOnboardingStatus
  onboardingStartedAt: string
  onboardingCompletedAt?: string
  
  // Trust & Performance
  trustLevel: VendorTrustLevel
  trustScore: number // 0-100
  performanceMetrics: VendorPerformanceMetrics
  
  // Store Configuration
  storeTier?: StoreTier // Add missing storeTier field
  storeMerchantConfigID?: string // Add missing merchant config reference
  
  // Compliance
  complianceStatus: VendorComplianceStatus
  
  // History
  suspensionHistory: SuspensionHistoryEntry[]
  tierProgressionHistory: TierProgressionEntry[]
  
  // Metadata
  createdAt: string
  updatedAt: string
  lastActiveAt?: string
  notes?: string
}

// Payment Methods Configuration
export interface PaymentMethods {
  acceptedCurrencies: string[]
  cryptoEnabled: boolean
  fiatEnabled: boolean
  instantPayoutEnabled: boolean
  preferredCurrency?: string
}

// Settlement Rules
export interface SettlementRules {
  frequency: SettlementFrequency
  minimumPayout: number
  holdPeriodDays: number // funds held before payout
  reservePercentage: number // percentage held as reserve
  payoutCurrency?: string
  bankDetails?: {
    accountNumber?: string
    routingNumber?: string
    swiftCode?: string
    iban?: string
  }
}

// Tax Configuration
export interface TaxConfiguration {
  taxId?: string
  vatRegistered: boolean
  automaticTaxCalculation: boolean
  taxRegions: Array<{
    region: string
    taxRate: number
    taxType: 'vat' | 'sales' | 'gst' | 'other'
  }>
  taxExemptions?: string[]
}

// Risk Profile
export interface RiskProfile {
  riskScore: number // 0-100, lower is better
  fraudCheckEnabled: boolean
  requireManualReview: boolean
  transactionLimits: {
    daily: number
    weekly: number
    monthly: number
    perTransaction: number
  }
  highRiskCategories?: string[]
  blacklistedRegions?: string[]
}

// Merchant Configuration Status
export type MerchantConfigStatus = 'pending' | 'test' | 'active' | 'suspended' | 'terminated'

// Commission Structure for Merchant Config
export interface MerchantCommissionStructure {
  platformCommission: number // percentage
  referralCommission?: number // percentage
  customSplits?: Array<{
    recipientId: string
    percentage: number
    description: string
  }>
}

// Main Merchant Configuration
export interface MerchantConfiguration {
  id: string
  ownerEntityId: string
  walletId: string // Primary RING wallet for payouts
  
  // Payment Configuration
  paymentMethods: PaymentMethods
  settlementRules: SettlementRules
  
  // Commission Configuration
  commissionStructure?: MerchantCommissionStructure
  
  // Tax & Compliance
  taxConfiguration: TaxConfiguration
  
  // Risk Management
  riskProfile: RiskProfile
  
  // Status
  status: MerchantConfigStatus
  statusReason?: string
  
  // Integration
  apiKeys?: {
    publicKey?: string
    secretKey?: string // encrypted
    webhookSecret?: string // encrypted
  }
  
  // Metadata
  createdAt: string
  updatedAt: string
  activatedAt?: string
  suspendedAt?: string
  terminatedAt?: string
}

// Vendor Application (for new vendors)
export interface VendorApplication {
  id: string
  entityId: string
  userId: string
  
  // Business Information
  businessName: string
  businessType: 'individual' | 'company' | 'partnership' | 'nonprofit'
  registrationNumber?: string
  taxId?: string
  
  // Contact Information
  primaryContact: {
    name: string
    email: string
    phone: string
    role: string
  }
  
  // Product Information
  productCategories: string[]
  estimatedMonthlyVolume: number
  averageOrderValue: number
  
  // Documents
  documents: Array<{
    type: 'business_registration' | 'tax_certificate' | 'bank_statement' | 'identity' | 'other'
    url: string
    uploadedAt: string
    verified: boolean
    verifiedAt?: string
    verifiedBy?: string
  }>
  
  // Status
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNotes?: string
  
  // Metadata
  createdAt: string
  updatedAt: string
}

// Vendor Dashboard Stats
export interface VendorDashboardStats {
  // Sales
  totalSales: number
  totalOrders: number
  averageOrderValue: number
  conversionRate: number
  
  // Performance
  trustScore: number
  fulfillmentRate: number
  customerSatisfaction: number
  
  // Financial
  pendingPayouts: number
  availableBalance: number
  totalCommissionPaid: number
  
  // Products
  totalProducts: number
  activeProducts: number
  outOfStockProducts: number
  
  // Time-based metrics
  salesThisMonth: number
  salesLastMonth: number
  growthRate: number
}

// Vendor Notification Preferences
export interface VendorNotificationPreferences {
  emailNotifications: {
    newOrder: boolean
    payoutProcessed: boolean
    productReview: boolean
    tierChange: boolean
    complianceReminder: boolean
  }
  smsNotifications?: {
    newOrder: boolean
    urgentIssues: boolean
  }
  pushNotifications?: {
    enabled: boolean
    topics: string[]
  }
}

// Vendor Settings
export interface VendorSettings {
  storeUrl?: string
  storeBanner?: string
  storeDescription?: string
  businessHours?: {
    [day: string]: {
      open: string
      close: string
      closed?: boolean
    }
  }
  vacationMode?: {
    enabled: boolean
    startDate?: string
    endDate?: string
    message?: string
  }
  notificationPreferences: VendorNotificationPreferences
  autoResponseTemplates?: {
    orderConfirmation?: string
    shippingUpdate?: string
    customerInquiry?: string
  }
}
