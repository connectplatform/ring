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
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
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
 * Enhanced User Profiling Types
 * Global user identity and ethical AI profiling
 */

// Global User Identity - Universal across all Ring projects
export interface GlobalUserIdentity {
  globalUserId: string; // Universal UUID across all projects
  legionUserId?: string; // Internal Legion tracking ID
  email: string;
  emailVerified: Date | null;
  name?: string | null;
  username?: string;
  role: UserRole;
  photoURL?: string | null;
  authProvider: string;
  authProviderId: string;
  isVerified: boolean;
  createdAt: Date;
  lastLogin: Date;
  lastActivityAt?: Date;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  deactivationReason?: string;
}

// Enhanced Communication Channels
export interface CommunicationChannels {
  phoneNumber?: string;
  telegramUsername?: string;
  whatsappNumber?: string;
  preferredContactMethod: 'email' | 'phone' | 'telegram' | 'whatsapp';
}

// Cultural & Geographic Context
export interface CulturalContext {
  country?: string;
  timezone: string;
  languages: string[];
  culturalBackground?: any; // Flexible JSON structure
}

// Ethical AI Profiling Data (Positive reinforcement only)
export interface EthicalAIProfiling {
  personalityInsights: any; // AI-observed positive behavioral patterns
  evolutionPotential: any; // Growth opportunities identified
  collaborationStyle: any; // How user collaborates with others
  valueAlignment: any; // Community contribution ethics
  growthTrajectory: any; // Evolution path and milestones
}

// Global Analytics (Ethical metrics)
export interface GlobalAnalytics {
  globalEngagementScore: number; // 0.0-1.0 engagement metric
  globalContributionScore: number; // 0.0-1.0 contribution metric
  globalTrustScore: number; // 0.0-1.0 trust metric
}

// Privacy & Consent Management (GDPR compliant)
export interface PrivacyConsent {
  dataSharingConsent: {
    analytics: boolean;
    personalization: boolean;
    notifications: boolean;
    research: boolean;
  };
  anonymizedResearchConsent: boolean;
  contactPreferences: {
    marketing: boolean;
    opportunities: boolean;
    system: boolean;
    evolution: boolean;
  };
}

// Evolution Tracking (Positive reinforcement)
export interface EvolutionTracking {
  achievementsUnlocked: any[];
  growthMilestones: any[];
  positiveFeedbackReceived: any[];
  collaborationHistory: any[];
}

// UI & Experience Preferences
export interface UIExperiencePreferences {
  opportunityPreferences: any;
  notificationSettings: {
    email: boolean;
    inApp: boolean;
    sms: boolean;
    frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  };
  uiCustomizations: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    compactView: boolean;
  };
}

// External Accounts & Integrations
export interface ExternalIntegrations {
  externalAccounts: any; // Linked external accounts
  walletAddresses: any; // Web3 wallet addresses
  socialProfiles: any; // Social media profiles
}

/**
 * Role Upgrade History interface
 * Tracks user role upgrade history
 */
export interface RoleUpgradeHistory {
  fromRole: UserRole;
  toRole: UserRole;
  upgradedAt: Date;
  paymentReference: string;
  paymentAmount: number;
  paymentCurrency: string;
}

// ============================================================================
// PROJECT-SPECIFIC USER DATA TYPES
// Data isolated per project while maintaining global user identity
// ============================================================================

// User Project Sessions - Session analytics and device tracking
export interface UserProjectSession {
  id: string;
  globalUserId: string;
  projectSlug: string;
  sessionStart: Date;
  sessionEnd?: Date;
  sessionDuration?: string;
  pagesVisited: any[];
  actionsTaken: any[];
  deviceInfo?: any;
  ipAddress?: string;
  createdAt: Date;
}

// User Product Interactions - E-commerce behavior tracking
export interface UserProductInteraction {
  id: string;
  globalUserId: string;
  projectSlug: string;
  productId: string;
  interactionType: 'view' | 'like' | 'favorite' | 'cart_add' | 'cart_remove' | 'purchase' | 'review' | 'share';
  interactionValue?: number;
  metadata?: any;
  createdAt: Date;
}

// User Favorites - Saved items across different types
export interface UserFavorite {
  id: string;
  globalUserId: string;
  projectSlug: string;
  favoriteType: 'product' | 'entity' | 'opportunity' | 'content' | 'user';
  favoriteId: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
}

// User Cart History - Shopping cart analytics
export interface UserCartHistory {
  id: string;
  globalUserId: string;
  projectSlug: string;
  sessionId?: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  currency?: string;
  addedAt: Date;
  removedAt?: Date;
  cartStatus: 'active' | 'abandoned' | 'purchased' | 'removed';
}

// User Search History - Search pattern analysis
export interface UserSearchHistory {
  id: string;
  globalUserId: string;
  projectSlug: string;
  searchQuery: string;
  searchFilters?: any;
  searchResultsCount?: number;
  clickedResults?: any[];
  searchCategory?: string;
  createdAt: Date;
}

// User Content Engagement - Content interaction metrics
export interface UserContentEngagement {
  id: string;
  globalUserId: string;
  projectSlug: string;
  contentType: 'article' | 'opportunity' | 'entity' | 'product' | 'comment' | 'review';
  contentId: string;
  engagementType: 'view' | 'like' | 'dislike' | 'comment' | 'share' | 'bookmark' | 'report';
  engagementValue?: number;
  engagementDuration?: string;
  metadata?: any;
  createdAt: Date;
}

// User Project Notifications - Per-project notification settings
export interface UserProjectNotification {
  id: string;
  globalUserId: string;
  projectSlug: string;
  notificationType: string;
  isEnabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly' | 'never';
  channels: any;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User Project Achievements - Gamification progress
export interface UserProjectAchievement {
  id: string;
  globalUserId: string;
  projectSlug: string;
  achievementId: string;
  achievementName: string;
  achievementDescription?: string;
  progressPercentage: number; // 0.0-100.0
  isCompleted: boolean;
  completedAt?: Date;
  rewardEarned?: any;
  createdAt: Date;
  updatedAt: Date;
}

// User Project Feedback - User feedback and surveys
export interface UserProjectFeedback {
  id: string;
  globalUserId: string;
  projectSlug: string;
  feedbackType: 'survey' | 'review' | 'rating' | 'bug_report' | 'feature_request' | 'general';
  feedbackTitle?: string;
  feedbackContent?: string;
  rating?: number; // 1-5
  metadata?: any;
  isAnonymous: boolean;
  responseStatus: 'pending' | 'reviewed' | 'responded' | 'closed';
  adminResponse?: string;
  respondedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// SERVICE INTERFACES FOR PROJECT-SPECIFIC DATA
// ============================================================================

export interface ProjectUserDataService {
  // Session tracking
  trackSession(session: Omit<UserProjectSession, 'id' | 'createdAt'>): Promise<UserProjectSession>;
  getUserSessions(globalUserId: string, projectSlug: string, limit?: number): Promise<UserProjectSession[]>;

  // Product interactions
  recordInteraction(interaction: Omit<UserProductInteraction, 'id' | 'createdAt'>): Promise<UserProductInteraction>;
  getUserInteractions(globalUserId: string, projectSlug: string, type?: string): Promise<UserProductInteraction[]>;

  // Favorites management
  addFavorite(favorite: Omit<UserFavorite, 'id' | 'createdAt'>): Promise<UserFavorite>;
  removeFavorite(globalUserId: string, projectSlug: string, favoriteType: string, favoriteId: string): Promise<void>;
  getUserFavorites(globalUserId: string, projectSlug: string, type?: string): Promise<UserFavorite[]>;

  // Cart analytics
  trackCartAction(action: Omit<UserCartHistory, 'id' | 'addedAt'>): Promise<UserCartHistory>;
  getCartHistory(globalUserId: string, projectSlug: string, status?: string): Promise<UserCartHistory[]>;

  // Search analytics
  recordSearch(search: Omit<UserSearchHistory, 'id' | 'createdAt'>): Promise<UserSearchHistory>;
  getSearchHistory(globalUserId: string, projectSlug: string): Promise<UserSearchHistory[]>;

  // Content engagement
  recordEngagement(engagement: Omit<UserContentEngagement, 'id' | 'createdAt'>): Promise<UserContentEngagement>;
  getEngagementHistory(globalUserId: string, projectSlug: string, contentType?: string): Promise<UserContentEngagement[]>;

  // Notifications
  updateNotificationSettings(settings: Omit<UserProjectNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProjectNotification>;
  getNotificationSettings(globalUserId: string, projectSlug: string): Promise<UserProjectNotification[]>;

  // Achievements
  unlockAchievement(achievement: Omit<UserProjectAchievement, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProjectAchievement>;
  getUserAchievements(globalUserId: string, projectSlug: string): Promise<UserProjectAchievement[]>;

  // Feedback
  submitFeedback(feedback: Omit<UserProjectFeedback, 'id' | 'createdAt'>): Promise<UserProjectFeedback>;
  getUserFeedback(globalUserId: string, projectSlug: string): Promise<UserProjectFeedback[]>;
}

// Enhanced AuthUser interface with global user identity
export interface AuthUser extends GlobalUserIdentity {
  // Backward compatibility: include both id and globalUserId
  id: string; // For backward compatibility with existing code
  // Communication channels
  communication?: CommunicationChannels;

  // Cultural context
  cultural?: CulturalContext;

  // Ethical AI profiling (positive reinforcement only)
  ethicalAI?: EthicalAIProfiling;

  // Global analytics
  analytics?: GlobalAnalytics;

  // Privacy & consent
  privacy?: PrivacyConsent;

  // Evolution tracking
  evolution?: EvolutionTracking;

  // UI preferences
  experience?: UIExperiencePreferences;

  // External integrations
  integrations?: ExternalIntegrations;

  // Legacy fields (backward compatibility)
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
  phoneNumber?: string;
  organization?: string;
  position?: string;
  lastRoleUpgrade?: RoleUpgradeHistory;

  // Metadata
  dataVersion?: number;
  lastProfileUpdate?: Date;

  // Wallets (legacy format)
  wallets: Wallet[];
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
  aiMatching?: {
    enabled: boolean;
    minMatchScore: number;
    maxMatchesPerDay: number;
    preferredCategories: string[];
    preferredWorkTypes: string[];
    autoFillSuggestions: boolean;
  };
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
  // Communication channels (stored as JSONB in PostgreSQL)
  communication?: CommunicationChannels | string; // Can be object or JSON string from FormData
  // Cultural context (stored as JSONB in PostgreSQL)
  cultural?: CulturalContext | string; // Can be object or JSON string from FormData
  // Privacy & consent (stored as JSONB in PostgreSQL)
  privacy?: PrivacyConsent | string; // Can be object or JSON string from FormData
  // External integrations (stored as JSONB in PostgreSQL)
  integrations?: ExternalIntegrations | string; // Can be object or JSON string from FormData
  // Notification preferences (stored as JSONB in PostgreSQL)
  notificationPreferences?: NotificationPreferences | string; // Can be object or JSON string from FormData
  // UI & Experience preferences (stored as JSONB in PostgreSQL)
  experience?: UIExperiencePreferences | string; // Can be object or JSON string from FormData
  // User settings (stored as JSONB in PostgreSQL)
  settings?: UserSettings | string; // Can be object or JSON string from FormData
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
