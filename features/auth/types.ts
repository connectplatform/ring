import { DefaultSession } from "next-auth";

/**
 * UserRole enum
 * Defines the possible roles a user can have in the system
 */
export enum UserRole {
  VISITOR = 'visitor',
  SUBSCRIBER = 'subscriber',
  MEMBER = 'member',
  CONFIDENTIAL = 'confidential',
  ADMIN = 'admin'
}

/**
 * Wallet interface
 * Defines the structure of a user's wallet
 */
export interface Wallet {
  address: string;
  encryptedPrivateKey: string;
  createdAt: string;
  label?: string;
  isDefault: boolean;
  balance: string;
}

/**
 * NotificationPreferences interface
 * Defines the structure of a user's notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  sms: boolean;
}

/**
 * AuthUser interface
 * Defines the properties of an authenticated user
 */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: Date | null;
  name?: string | null;
  username?: string;
  role: UserRole;
  photoURL?: string | null;
  wallets: Wallet[];
  authProvider: string;
  authProviderId: string;
  isVerified: boolean;
  createdAt: Date;
  lastLogin: Date;
  bio?: string;
  canPostconfidentialOpportunities: boolean;
  canViewconfidentialOpportunities: boolean;
  postedopportunities: string[];
  savedopportunities: string[];
  nonce?: string;
  nonceExpires?: number;
  notificationPreferences: NotificationPreferences;
  settings: UserSettings;
  kycVerification?: KYCVerification;
  pendingUpgradeRequest?: RoleUpgradeRequest;
}

/**
 * UserSettings interface
 * Defines the structure of a user's settings
 */
export interface UserSettings {
  language: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  notificationPreferences: NotificationPreferences;
}

/**
 * ExtendedProfile interface
 * Defines additional profile information for a user
 */
export interface ExtendedProfile {
  organization?: string;
  position?: string;
  bio?: string;
  phoneNumber?: string;
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  photoURL?: string;
  skills?: string[];
  interests?: string[];
  canPostconfidentialOpportunities: boolean;
  canViewconfidentialOpportunities: boolean;
  postedopportunities: string[];
  savedopportunities: string[];
}

/**
 * VerificationDocument type
 * Defines the structure of a verification document
 */
export type VerificationDocument = {
  fileType: 'jpg' | 'pdf' | 'docx' | 'doc' | 'pages' | 'webp' | 'png'
  blobData: Blob
}

/**
 * ProfileFormData type
 * Defines the structure of the profile form data
 */
export type ProfileFormData = Partial<ExtendedProfile> & Pick<AuthUser, 'name' | 'email' | 'role'> & {
  username?: string;
  wallets?: Wallet[];
  photoURL?: string;
  lastLogin?: Date;
  authProvider?: 'google' | 'apple' | 'metamask' | 'credentials';
  authProviderId?: string;
}

/**
 * KYC Verification Levels
 */
export enum KYCLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  ENHANCED = 'enhanced'
}

/**
 * KYC Document Types
 */
export enum KYCDocumentType {
  PASSPORT = 'passport',
  ID_CARD = 'id_card',
  DRIVERS_LICENSE = 'drivers_license',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  DIIA_CERTIFICATE = 'diia_certificate',
  BANK_ID_CERTIFICATE = 'bank_id_certificate'
}

/**
 * KYC Status
 */
export enum KYCStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * KYC Document interface
 */
export interface KYCDocument {
  id: string;
  type: KYCDocumentType;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  status: KYCStatus;
  rejectionReason?: string;
}

/**
 * KYC Verification Log Entry
 */
export interface KYCLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  status: KYCStatus;
  notes?: string;
  verifiedBy?: string;
  documentId?: string;
}

/**
 * KYC Verification Data
 */
export interface KYCVerification {
  id: string;
  userId: string;
  level: KYCLevel;
  status: KYCStatus;
  submittedAt?: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  documents: KYCDocument[];
  logs: KYCLogEntry[];
  verificationMethod?: 'manual' | 'diia' | 'bank_id' | 'automated';
  verifiedBy?: string;
  rejectionReason?: string;
  metadata?: {
    diiaVerificationId?: string;
    bankIdVerificationId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Role Upgrade Request Status
 */
export enum UpgradeRequestStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * Role Upgrade Request
 */
export interface RoleUpgradeRequest {
  id: string;
  userId: string;
  fromRole: UserRole;
  toRole: UserRole;
  status: UpgradeRequestStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reason: string;
  organization?: string;
  position?: string;
  linkedinProfile?: string;
  portfolioUrl?: string;
  additionalDocuments?: string[];
  rejectionReason?: string;
  approvalNotes?: string;
}
