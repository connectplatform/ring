import { Timestamp } from 'firebase-admin/firestore';
import { 
  StoreStatus, 
  StoreTier, 
  StoreVisibility,
  PaymentProcessor 
} from '@/constants/store';

// Entity Industry sectors 
export type EntityType =
  | '3dPrinting'
  | 'aiMachineLearning'
  | 'biotechnology'
  | 'blockchainDevelopment'
  | 'cleanEnergy'
  | 'cloudComputing'
  | 'cncMachining'
  | 'compositeManufacturing'
  | 'cybersecurity'
  | 'droneTechnology'
  | 'electronicManufacturing'
  | 'industrialDesign'
  | 'iotDevelopment'
  | 'laserCutting'
  | 'manufacturing'
  | 'metalFabrication'
  | 'other'
  | 'plasticInjectionMolding'
  | 'precisionEngineering'
  | 'quantumComputing'
  | 'robotics'
  | 'semiconductorProduction'
  | 'smartMaterials'
  | 'softwareDevelopment'
  | 'technologyCenter'
  | 'virtualReality';

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

