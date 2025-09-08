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

// ERP Extension: Vendor Quality & Compliance Tracking
export interface VendorQualityProfile {
  certifications: Certification[]
  qualityScore: number // 0-100 scale
  complianceRating: number // 0-100 scale
  lastInspectionDate?: string
  nextInspectionDue?: string
  qualityFlags: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate?: string
  status: 'active' | 'expired' | 'pending' | 'revoked'
  certificateUrl?: string
  verificationMethod: 'self_certified' | 'third_party' | 'government'
}

// ERP Extension: Vendor Analytics & Performance
export interface VendorAnalytics {
  salesVelocity: number // Average sales per day
  customerRetention: number // Percentage of repeat customers
  orderFulfillmentTime: number // Average hours to fulfill orders
  returnRate: number // Percentage of returned items
  customerSatisfactionScore: number // 1-5 scale
  marketShare: number // Percentage of category sales
  trendingDirection: 'up' | 'down' | 'stable'
  predictedGrowth: number // Percentage growth prediction
}

// ERP Extension: Vendor Compliance Tracking
export interface VendorCompliance {
  fsmaCompliant: boolean
  euGdprCompliant: boolean
  organicCertified: boolean
  fairTradeCertified: boolean
  lastComplianceAudit?: string
  nextComplianceAudit?: string
  complianceViolations: ComplianceViolation[]
  regulatoryFilings: RegulatoryFiling[]
}

export interface ComplianceViolation {
  id: string
  type: 'fsma' | 'eu' | 'organic' | 'fair_trade' | 'other'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  dateReported: string
  dateResolved?: string
  resolution: string
  fineAmount?: number
}

export interface RegulatoryFiling {
  id: string
  type: 'fsma_report' | 'eu_declaration' | 'organic_certification' | 'tax_filing'
  filingDate: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  referenceNumber?: string
  dueDate: string
}

// ERP Extension: Extended Vendor Profile with 85+ fields
// Export the extended vendor profile
export interface ExtendedVendorProfile extends VendorProfile {
  // Quality & Compliance (15+ fields)
  qualityProfile: VendorQualityProfile
  compliance: VendorCompliance

  // Analytics & Performance (10+ fields)
  analytics: VendorAnalytics

  // Business Intelligence (15+ fields)
  businessIntelligence: {
    marketPositioning: string
    competitiveAdvantages: string[]
    targetCustomerSegments: string[]
    pricingStrategy: 'premium' | 'value' | 'competitive' | 'cost_leader'
    distributionChannels: string[]
    brandStrength: number // 0-100 scale
  }

  // Operational Excellence (10+ fields)
  operationalMetrics: {
    inventoryTurnover: number
    supplierReliability: number
    productionEfficiency: number
    qualityControlPassRate: number
    customerServiceResponseTime: number
    orderProcessingTime: number
  }

  // Supply Chain Integration (10+ fields)
  supplyChain: {
    primarySuppliers: string[]
    supplierDiversity: number // Percentage of diverse suppliers
    traceabilityLevel: 'basic' | 'intermediate' | 'advanced' | 'full'
    blockchainEnabled: boolean
    iotIntegration: boolean
    realTimeTracking: boolean
  }

  // ESG & Sustainability (10+ fields)
  sustainability: {
    carbonFootprint: number // kg CO2 per product
    waterUsage: number // liters per product
    wasteReduction: number // percentage reduction
    renewableEnergyUsage: number // percentage
    socialImpactScore: number // 0-100 scale
    communityEngagement: string[]
  }

  // AI & Automation (10+ fields)
  automationLevel: {
    orderProcessing: number // percentage automated
    inventoryManagement: number // percentage automated
    customerService: number // percentage automated
    qualityControl: number // percentage automated
    reporting: number // percentage automated
  }

  aiInsights: {
    churnProbability: number
    growthForecast: number
    recommendedActions: string[]
    marketOpportunities: string[]
    riskAlerts: string[]
  }

  // Integration Capabilities (5+ fields)
  integrations: {
    marketplaceConnections: string[]
    erpSystems: string[]
    logisticsProviders: string[]
    paymentProcessors: string[]
    analyticsPlatforms: string[]
  }

  // Advanced Metadata (5+ fields)
  metadata: {
    lastUpdatedBy: string
    updateReason: string
    dataQualityScore: number
    verificationStatus: 'unverified' | 'self_verified' | 'third_party_verified'
    lastAuditDate?: string
  }
}
