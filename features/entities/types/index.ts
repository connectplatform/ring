import { Timestamp } from 'firebase-admin/firestore';
import { 
  StoreStatus, 
  StoreTier, 
  StoreVisibility,
  PaymentProcessor 
} from '@/constants/store';

// Professional networking industry categories (ring-platform.org SSOT — see entity-management-system.json)
export type EntityType =
  | 'technologySoftware'
  | 'manufacturingIndustry'
  | 'financialServices'
  | 'healthcareMedical'
  | 'educationTraining'
  | 'realEstateConstruction'
  | 'retailEcommerce'
  | 'professionalServices'
  | 'mediaEntertainment'
  | 'transportationLogistics'
  | 'energyUtilities'
  | 'agricultureFood'
  | 'governmentPublicSector'
  | 'nonProfitNgo'
  | 'researchDevelopment'
  | 'consultingAdvisory'
  | 'legalServices'
  | 'marketingAdvertising'
  | 'hospitalityTourism'
  | 'sportsRecreation'
  | 'artsCulture'
  | 'environmentalServices'
  | 'telecommunications'
  | 'aerospaceDefense'
  | 'pharmaceuticals'
  | 'other';

// Store Verification Status
export interface StoreVerification {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  businessVerified: boolean;
  bankAccountVerified: boolean;
  verificationDate?: string;
}

// Store Performance Metrics
export interface StoreMetrics {
  trustScore: number;
  totalSales: number;
  totalOrders: number;
  averageRating: number;
  returnRate: number;
  disputeRate: number;
  responseTime: number; // in hours
  lastActiveDate?: string;
}

// Store Settings
export interface StoreSettings {
  autoApproveProducts: boolean;
  allowGuestCheckout: boolean;
  requireInventoryTracking: boolean;
  enableInstantPayouts: boolean;
}

// Payment Processor Configuration
export interface PaymentProcessorConfig {
  configSetID: string;
  provider: PaymentProcessor;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  supportedMethods: string[];
  supportedCurrencies: string[];
  fees?: {
    fixed: number;
    percentage: number;
  };
  webhookEndpoint?: string;
  testMode: boolean;
  uiComponents?: Record<string, any>;
}

export interface Entity {
  addedBy: string;
  certifications?: string[];
  contactEmail?: string;
  dateAdded: Timestamp;
  employeeCount?: number;
  foundedYear?: number;
  fullDescription?: string;
  gallery?: { description: string; url: string }[];
  id: string;
  industries?: string[];
  isConfidential: boolean;
  lastUpdated: Timestamp;
  locale: string;
  location: string;
  logo?: string;
  memberSince?: Timestamp;
  name: string;
  partnerships?: string[];
  phoneNumber?: string;
  services?: string[];
  shortDescription: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  tags?: string[];
  type: EntityType;
  upcomingEvents?: {
    date: string;
    description: string;
    name: string;
  }[];
  visibility: 'public' | 'subscriber' | 'member' | 'confidential';
  website?: string;
  members: string[];
  opportunities: string[];

  /** Platform moderation — excluded from discovery when `blocked`. */
  moderationStatus?: 'active' | 'reported' | 'under_review' | 'blocked';
  reportCount?: number;
  lastReportedAt?: Timestamp;
  blockedAt?: Timestamp;
  blockedReason?: string;

  /** Platform verification queue (`POST /api/entities/{id}/verify`). */
  verificationStatus?: 'none' | 'pending' | 'under_review' | 'verified' | 'rejected';
  verificationRequestedAt?: Timestamp;
  verificationCompletedAt?: Timestamp;
  
  // Multi-vendor Store Fields
  storeActivated?: boolean;
  storeID?: string;
  storeName?: string;
  storeSlug?: string;
  storeWallet?: string; // userWalletID reference
  storeStatus?: StoreStatus;
  storeTier?: StoreTier;
  storeVisibility?: StoreVisibility;
  storeMerchantConfigID?: string;
  storeVerification?: StoreVerification;
  storeMetrics?: StoreMetrics;
  storeSettings?: StoreSettings;
  storeFiatPaymentProcessors?: PaymentProcessorConfig[];
}

// Serialized version for client components (dates as ISO strings)
export interface SerializedEntity {
  addedBy: string;
  certifications?: string[];
  contactEmail?: string;
  dateAdded: string;
  employeeCount?: number;
  foundedYear?: number;
  fullDescription?: string;
  gallery?: { description: string; url: string }[];
  id: string;
  industries?: string[];
  isConfidential: boolean;
  lastUpdated: string;
  locale: string;
  location: string;
  logo?: string;
  memberSince?: string;
  name: string;
  partnerships?: string[];
  phoneNumber?: string;
  services?: string[];
  shortDescription: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  tags?: string[];
  type: EntityType;
  upcomingEvents?: {
    date: string;
    description: string;
    name: string;
  }[];
  visibility: 'public' | 'subscriber' | 'member' | 'confidential';
  website?: string;
  members: string[];
  opportunities: string[];

  /** Platform moderation — excluded from discovery when `blocked`. */
  moderationStatus?: 'active' | 'reported' | 'under_review' | 'blocked';
  reportCount?: number;
  lastReportedAt?: string;
  blockedAt?: string;
  blockedReason?: string;

  /** Platform verification queue (`POST /api/entities/{id}/verify`). */
  verificationStatus?: 'none' | 'pending' | 'under_review' | 'verified' | 'rejected';
  verificationRequestedAt?: string;
  verificationCompletedAt?: string;
  
  // Multi-vendor Store Fields (serialized)
  storeActivated?: boolean;
  storeID?: string;
  storeName?: string;
  storeSlug?: string;
  storeWallet?: string;
  storeStatus?: StoreStatus;
  storeTier?: StoreTier;
  storeVisibility?: StoreVisibility;
  storeMerchantConfigID?: string;
  storeVerification?: StoreVerification;
  storeMetrics?: StoreMetrics;
  storeSettings?: StoreSettings;
  storeFiatPaymentProcessors?: PaymentProcessorConfig[];
}

