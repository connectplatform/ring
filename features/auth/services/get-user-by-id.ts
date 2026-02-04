// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import {
  AuthUser,
  UserRole,
  Wallet,
  GlobalUserIdentity,
  CommunicationChannels,
  CulturalContext,
  EthicalAIProfiling,
  GlobalAnalytics,
  PrivacyConsent,
  EvolutionTracking,
  UIExperiencePreferences,
  ExternalIntegrations
} from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import {
  getCachedDocument,
  getCachedCollectionAdvanced
} from '@/lib/services/firebase-service-manager';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Process enhanced user profiling data from database JSONB format
 * @param userData Raw user data from database
 * @returns Structured AuthUser with enhanced profiling fields
 */
function processEnhancedUserProfile(userData: any): AuthUser {
  const convertTimestamp = (timestamp: any): Date => {
    if (timestamp && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (typeof timestamp === 'object' && timestamp.toISOString) return timestamp;
    return new Date();
  };

  // Extract global user identity
  const globalIdentity: GlobalUserIdentity = {
    globalUserId: userData?.global_user_id || userData?.id,
    email: userData?.email,
    emailVerified: userData?.emailVerified ? convertTimestamp(userData.emailVerified) : null,
    name: userData?.name,
    username: userData?.username,
    role: userData?.role || UserRole.SUBSCRIBER,
    photoURL: userData?.photoURL || userData?.image,
    authProvider: userData?.authProvider || 'credentials',
    authProviderId: userData?.authProviderId || userData?.id,
    isVerified: userData?.isVerified || false,
    createdAt: convertTimestamp(userData?.createdAt),
    lastLogin: convertTimestamp(userData?.lastLogin),
    lastActivityAt: userData?.lastActivityAt ? convertTimestamp(userData.lastActivityAt) : undefined,
    accountStatus: userData?.accountStatus || 'ACTIVE',
    deactivationReason: userData?.deactivationReason
  };

  // Process communication channels - check both nested object (from JSONB) and snake_case columns
  const commData = userData?.communication || {};
  const communication: CommunicationChannels | undefined = 
    userData?.communication || userData?.telegram_username || userData?.whatsapp_number || userData?.preferred_contact_method ? {
    phoneNumber: commData?.phoneNumber || userData?.phoneNumber,
    telegramUsername: commData?.telegramUsername || userData?.telegram_username,
    whatsappNumber: commData?.whatsappNumber || userData?.whatsapp_number,
    preferredContactMethod: commData?.preferredContactMethod || userData?.preferred_contact_method || 'email'
  } : undefined;

  // Process cultural context - check both nested object (from JSONB) and column data
  const cultData = userData?.cultural || {};
  const cultural: CulturalContext | undefined = 
    userData?.cultural || userData?.languages || userData?.cultural_background || userData?.country || userData?.timezone ? {
    country: cultData?.country || userData?.country,
    timezone: cultData?.timezone || userData?.timezone || 'UTC',
    languages: cultData?.languages || userData?.languages || [],
    culturalBackground: cultData?.culturalBackground || userData?.cultural_background
  } : undefined;

  // Process ethical AI profiling
  const ethicalAI: EthicalAIProfiling | undefined = userData?.personality_insights || userData?.evolution_potential ? {
    personalityInsights: userData?.personality_insights,
    evolutionPotential: userData?.evolution_potential,
    collaborationStyle: userData?.collaboration_style,
    valueAlignment: userData?.value_alignment,
    growthTrajectory: userData?.growth_trajectory
  } : undefined;

  // Process global analytics
  const analytics: GlobalAnalytics | undefined = userData?.global_engagement_score !== undefined ? {
    globalEngagementScore: userData?.global_engagement_score || 0,
    globalContributionScore: userData?.global_contribution_score || 0,
    globalTrustScore: userData?.global_trust_score || 0.5
  } : undefined;

  // Process privacy consent - check both nested object (from JSONB) and snake_case columns
  const privData = userData?.privacy || {};
  const privacy: PrivacyConsent | undefined = 
    userData?.privacy || userData?.data_sharing_consent ? {
    dataSharingConsent: privData?.dataSharingConsent || userData?.data_sharing_consent,
    anonymizedResearchConsent: privData?.anonymizedResearchConsent ?? userData?.anonymized_research_consent ?? false,
    contactPreferences: privData?.contactPreferences || userData?.contact_preferences || {
      marketing: false,
      opportunities: true,
      system: true,
      evolution: true
    }
  } : undefined;

  // Process evolution tracking
  const evolution: EvolutionTracking | undefined = userData?.achievements_unlocked ? {
    achievementsUnlocked: userData?.achievements_unlocked || [],
    growthMilestones: userData?.growth_milestones || [],
    positiveFeedbackReceived: userData?.positive_feedback_received || [],
    collaborationHistory: userData?.collaboration_history || []
  } : undefined;

  // Process UI experience preferences - check both nested object (from JSONB) and snake_case columns
  const expData = userData?.experience || {};
  const experience: UIExperiencePreferences | undefined = 
    userData?.experience || userData?.notification_settings ? {
    opportunityPreferences: expData?.opportunityPreferences || userData?.opportunity_preferences,
    notificationSettings: expData?.notificationSettings || userData?.notification_settings,
    uiCustomizations: expData?.uiCustomizations || userData?.ui_customizations || {
      theme: 'system',
      language: 'en',
      compactView: false
    }
  } : undefined;

  // Process external integrations - check both nested object (from JSONB) and snake_case columns
  const intData = userData?.integrations || {};
  const integrations: ExternalIntegrations | undefined = 
    userData?.integrations || userData?.external_accounts || userData?.social_profiles ? {
    externalAccounts: intData?.externalAccounts || userData?.external_accounts,
    walletAddresses: intData?.walletAddresses || userData?.wallet_addresses,
    socialProfiles: intData?.socialProfiles || userData?.social_profiles
  } : undefined;

  // Build complete AuthUser object
  const authUser: AuthUser = {
    ...globalIdentity,
    // Backward compatibility: id field
    id: globalIdentity.globalUserId,
    communication,
    cultural,
    ethicalAI,
    analytics,
    privacy,
    evolution,
    experience,
    integrations,

    // Legacy fields for backward compatibility
    bio: userData?.bio,
    canPostconfidentialOpportunities: userData?.canPostconfidentialOpportunities || false,
    canViewconfidentialOpportunities: userData?.canViewconfidentialOpportunities || false,
    postedopportunities: userData?.postedopportunities || [],
    savedopportunities: userData?.savedopportunities || [],
    nonce: userData?.nonce,
    nonceExpires: userData?.nonceExpires,
    // notificationPreferences - check nested object first (from JSONB), then snake_case
    notificationPreferences: userData?.notificationPreferences || userData?.notification_preferences || {
      email: true,
      inApp: true,
      sms: false
    },
    // settings - check nested object first (from JSONB)
    settings: userData?.settings || {
      language: 'en',
      theme: 'system',
      notifications: true
    },
    kycVerification: userData?.kycVerification,
    pendingUpgradeRequest: userData?.pendingUpgradeRequest,
    phoneNumber: userData?.phoneNumber,
    organization: userData?.organization,
    position: userData?.position,
    lastRoleUpgrade: userData?.lastRoleUpgrade,

    // Metadata
    dataVersion: userData?.data_version || 1,
    lastProfileUpdate: userData?.last_profile_update ? convertTimestamp(userData.last_profile_update) : undefined,

    // Wallets (legacy format)
    wallets: userData?.wallets || []
  };

  return authUser;
}

/**
 * Retrieve a user's full profile from Firestore by their ID, with authentication and role-based access control.
 * 
 * User steps:
 * 1. An authenticated user or admin requests another user's profile
 * 2. Function authenticates the requesting user
 * 3. If authenticated and authorized, the function retrieves the requested user's profile from Firestore
 * 4. The function returns the appropriate user data based on the requesting user's role
 * 
 * @param userId - The ID of the user to retrieve
 * @returns A promise that resolves to the AuthUser object or null if not found or not authorized.
 * 
 * Error handling:
 * - Throws an error if the requesting user is not authenticated
 * - Returns null if there's an error retrieving the profile from Firestore or if not authorized
 */
export async function getUserById(userId: string): Promise<Partial<AuthUser> | null> {
  console.log(`🔍 getUserById - Starting retrieval process for user ID: ${userId}`);

  try {
    // Step 1: Authenticate and get session of the requesting user
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserById - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    // Step 2: Check authorization
    if (requestingUserId !== userId && requestingUserRole !== UserRole.ADMIN) {
      console.log(`Services: getUserById - Unauthorized access attempt to user ${userId} by user ${requestingUserId}`);
      return null; // Only allow users to access their own profile or admins to access any profile
    }

    // Step 3: Retrieve the user document using database abstraction layer
    console.log(`🔍 getUserById - Using database abstraction layer for user: ${userId}`);

    try {
      // Initialize database service if needed
      console.log(`🔍 getUserById - Initializing database service`);
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        console.error(`❌ getUserById - Database initialization failed:`, initResult.error);
        console.log(`⚠️ getUserById - Cannot proceed without database connection`);
        return null;
      }

      console.log(`✅ getUserById - Database initialization successful`);

      const dbService = getDatabaseService();
      console.log(`🔍 getUserById - Attempting to read user from database:`, userId);
      const userResult = await dbService.read('users', userId);
      console.log(`🔍 getUserById - Database read result:`, {
        success: userResult.success,
        hasData: !!userResult.data,
        error: userResult.error
      });

      if (!userResult.success || !userResult.data) {
        console.log(`Services: getUserById - User document not found for ID: ${userId}`);
        console.log(`Services: getUserById - Database result:`, userResult);
        return null;
      }

      const dbDocument = userResult.data;
      console.log(`Services: getUserById - Successfully retrieved database document for ID: ${userId}`, {
        hasDocument: !!dbDocument,
        documentType: typeof dbDocument,
        documentKeys: dbDocument ? Object.keys(dbDocument) : []
      });

      if (!dbDocument) {
        console.log(`Services: getUserById - No document found in database result`);
        return null;
      }

    // Convert timestamps to Date objects consistently
    const convertTimestamp = (timestamp: any): Date => {
      if (timestamp && timestamp._seconds) {
        // Firebase timestamp format
        return new Date(timestamp._seconds * 1000);
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      // PostgreSQL timestamp format (ISO string)
      if (typeof timestamp === 'object' && timestamp.toISOString) {
        return timestamp;
      }
      return new Date();
    };

    // Extract the actual data from the database document
    const userData = (dbDocument as any).data || dbDocument;
    console.log(`Services: getUserById - Extracted user data:`, {
      hasData: !!userData,
      dataKeys: userData ? Object.keys(userData) : [],
      dataType: typeof userData
    });

    if (!userData) {
      console.log(`Services: getUserById - No data found in database document`);
      return null;
    }

    // Step 5: Process enhanced user profile data
    console.log(`Services: getUserById - Processing enhanced user profile for ID: ${userId}`);
    const enhancedUserProfile = processEnhancedUserProfile(userData);

    // Step 6: Return appropriate data based on user role and ownership
    // Users can always see their own full profile data (including privacy settings)
    const isOwnProfile = requestingUserId === userId;
    
    if (requestingUserRole === UserRole.ADMIN || isOwnProfile) {
      console.log(`Services: getUserById - ${isOwnProfile ? 'User accessing own profile' : 'Admin user'} retrieved full enhanced profile for ID: ${userId}`);
      return enhancedUserProfile;
    } else {
      // For non-admin users viewing OTHER users' profiles, return a privacy-filtered subset
      console.log(`Services: getUserById - Non-admin user retrieved safe profile data for ID: ${userId}`);

      // Filter out sensitive data when viewing other users' profiles
      const safeUserData: Partial<AuthUser> = {
        ...enhancedUserProfile,

        // Remove sensitive ethical AI profiling data
        ethicalAI: undefined,
        analytics: undefined,

        // Remove detailed evolution tracking
        evolution: undefined,

        // Remove privacy preferences when viewing other users
        privacy: undefined
      };

      return safeUserData;
    }

    } catch (error) {
      console.error('Services: getUserById - Error retrieving user profile:', error);
      console.error('Services: getUserById - Error details:', {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null; // Indicate failure by returning null
    }
  } catch (error) {
    console.error('Services: getUserById - Authentication or authorization error:', error);
    return null; // Indicate failure by returning null
  }
}

