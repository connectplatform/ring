// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import {
  AuthUser,
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
import { UserRolesArray } from '@/features/auth/user-role';
import { cache } from 'react';
import { db } from '@/lib/database';

import { auth } from '@/auth'; // Auth.js v5 session handler
import { isPlatformAdmin, resolvePersistedUserRole } from '@/features/auth/user-role';
import { DEFAULT_LOCALE } from '@/lib/locale-config';
import { getDefaultTheme } from '@/lib/ring-config-core';
import {
  acceptsProfileDms,
  normalizePublicProfileFields,
  normalizePublicProfileMedia,
  normalizeSkills,
  showNftListings,
} from '@/features/auth/lib/personal-page-sections';

/**
 * Process enhanced user profiling data from database JSONB format
 * Converts raw user object from DB into a structured AuthUser, including handling legacy and nested sources.
 * @param userData Raw user data from database
 * @returns Structured AuthUser with enhanced profiling fields
 */
function processEnhancedUserProfile(userData: any): AuthUser {
  // Utility to convert any possible timestamp to a Date object
  const convertTimestamp = (timestamp: any): Date => {
    if (timestamp && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (typeof timestamp === 'object' && timestamp.toISOString) return timestamp;
    return new Date();
  };

  // Assemble global identity details, prioritizing standard and then legacy fields
  const globalIdentity: GlobalUserIdentity = {
    globalUserId: userData?.global_user_id || userData?.id,
    email: userData?.email,
    emailVerified: userData?.emailVerified ? convertTimestamp(userData.emailVerified) : null,
    name: userData?.name,
    username: userData?.username,
    role: resolvePersistedUserRole(userData?.role),
    photoURL: userData?.photoURL || userData?.image,
    avatarThumb:
      (typeof userData?.avatarThumb === 'string' && userData.avatarThumb) ||
      undefined,
    authProvider: userData?.authProvider || 'credentials',
    authProviderId: userData?.authProviderId || userData?.id,
    isVerified: Boolean(userData?.isVerified ?? userData?.is_verified ?? false),
    createdAt: convertTimestamp(userData?.createdAt),
    lastLogin: convertTimestamp(userData?.lastLogin),
    lastActivityAt: userData?.lastActivityAt ? convertTimestamp(userData.lastActivityAt) : undefined,
    accountStatus: userData?.accountStatus || 'ACTIVE',
    deactivationReason: userData?.deactivationReason
  };

  // Combine nested or top-level communication details
  const commData = userData?.communication || {};
  const communication: CommunicationChannels | undefined = 
    userData?.communication || userData?.telegram_username || userData?.whatsapp_number || userData?.preferred_contact_method ? {
    phoneNumber: commData?.phoneNumber || userData?.phoneNumber,
    telegramUsername: commData?.telegramUsername || userData?.telegram_username,
    // Verified Telegram UID (Login Widget / OIDC / Mini App) — SSOT for "linked"
    telegramId: commData?.telegramId
      ? String(commData.telegramId)
      : userData?.telegram_id
        ? String(userData.telegram_id)
        : undefined,
    whatsappNumber: commData?.whatsappNumber || userData?.whatsapp_number,
    preferredContactMethod: commData?.preferredContactMethod || userData?.preferred_contact_method || 'email'
  } : undefined;

  // Gather cultural context, trying nested and fallback keys
  const cultData = userData?.cultural || {};
  const cultural: CulturalContext | undefined = 
    userData?.cultural || userData?.languages || userData?.cultural_background || userData?.country || userData?.timezone ? {
    country: cultData?.country || userData?.country,
    timezone: cultData?.timezone || userData?.timezone || 'UTC',
    languages: cultData?.languages || userData?.languages || [],
    culturalBackground: cultData?.culturalBackground || userData?.cultural_background
  } : undefined;

  // Extract ethical AI profiling data if present
  const ethicalAI: EthicalAIProfiling | undefined = userData?.personality_insights || userData?.evolution_potential ? {
    personalityInsights: userData?.personality_insights,
    evolutionPotential: userData?.evolution_potential,
    collaborationStyle: userData?.collaboration_style,
    valueAlignment: userData?.value_alignment,
    growthTrajectory: userData?.growth_trajectory
  } : undefined;

  // Collate global analytics info
  const analytics: GlobalAnalytics | undefined = userData?.global_engagement_score !== undefined ? {
    globalEngagementScore: userData?.global_engagement_score || 0,
    globalContributionScore: userData?.global_contribution_score || 0,
    globalTrustScore: userData?.global_trust_score || 0.5
  } : undefined;

  // Privacy consent detail extraction
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

  // Evolution tracking (gamification/progress)
  const evolution: EvolutionTracking | undefined = userData?.achievements_unlocked ? {
    achievementsUnlocked: userData?.achievements_unlocked || [],
    growthMilestones: userData?.growth_milestones || [],
    positiveFeedbackReceived: userData?.positive_feedback_received || [],
    collaborationHistory: userData?.collaboration_history || []
  } : undefined;

  // UI experience preferences
  const expData = userData?.experience || {};
  const experience: UIExperiencePreferences | undefined = 
    userData?.experience || userData?.notification_settings ? {
    opportunityPreferences: expData?.opportunityPreferences || userData?.opportunity_preferences,
    notificationSettings: expData?.notificationSettings || userData?.notification_settings,
    uiCustomizations: expData?.uiCustomizations || userData?.ui_customizations || {
      theme: getDefaultTheme(),
      language: DEFAULT_LOCALE,
      compactView: false
    }
  } : undefined;

  // Linked external accounts or wallets
  const intData = userData?.integrations || {};
  const integrations: ExternalIntegrations | undefined = 
    userData?.integrations || userData?.external_accounts || userData?.social_profiles ? {
    externalAccounts: intData?.externalAccounts || userData?.external_accounts,
    walletAddresses: intData?.walletAddresses || userData?.wallet_addresses,
    socialProfiles: intData?.socialProfiles || userData?.social_profiles
  } : undefined;

  // Construct the consolidated AuthUser profile, preserving legacy/compatibility fields
  const authUser: AuthUser = {
    ...globalIdentity,
    // Legacy id
    id: globalIdentity.globalUserId,
    communication,
    cultural,
    ethicalAI,
    analytics,
    privacy,
    evolution,
    experience,
    integrations,

    // Backward compatibility and legacy profile fields
    bio: userData?.bio,
    publicProfile:
      userData?.publicProfile === true ||
      userData?.publicProfile === 'true' ||
      userData?.publicProfile === 1 ||
      userData?.publicProfile === '1',
    publicProfileSections: Array.isArray(userData?.publicProfileSections)
      ? (userData.publicProfileSections as string[])
      : undefined,
    publicProfileFields: normalizePublicProfileFields(userData?.publicProfileFields),
    acceptProfileDms: acceptsProfileDms(userData?.acceptProfileDms),
    publicProfileNftListings: showNftListings(userData?.publicProfileNftListings),
    publicProfileMedia: normalizePublicProfileMedia(userData?.publicProfileMedia),
    canPostconfidentialOpportunities: userData?.canPostconfidentialOpportunities || false,
    canViewconfidentialOpportunities: userData?.canViewconfidentialOpportunities || false,
    postedopportunities: userData?.postedopportunities || [],
    savedopportunities: userData?.savedopportunities || [],
    nonce: userData?.nonce,
    nonceExpires: userData?.nonceExpires,
    notificationPreferences: userData?.notificationPreferences || userData?.notification_preferences || {
      email: true,
      inApp: true,
      sms: false
    },
    settings: userData?.settings || {
      language: DEFAULT_LOCALE,
      theme: getDefaultTheme(),
      notifications: true
    },
    kycVerification: userData?.kycVerification,
    pendingUpgradeRequest: userData?.pendingUpgradeRequest,
    phoneNumber: userData?.phoneNumber,
    organization: userData?.organization,
    position: userData?.position,
    skills: normalizeSkills(userData?.skills),
    curriculumVitae:
      userData?.curriculumVitae && typeof userData.curriculumVitae === 'object'
        ? (userData.curriculumVitae as AuthUser['curriculumVitae'])
        : undefined,
    lastRoleUpgrade: userData?.lastRoleUpgrade,
    dataVersion: userData?.data_version || 1,
    lastProfileUpdate: userData?.last_profile_update ? convertTimestamp(userData.last_profile_update) : undefined,
    wallets: userData?.wallets || []
  };

  return authUser;
}

// TODO: Move getUserById() to React 19 cache()-wrapped export for deduplication and stateless request coalescing
//       Add React's unstable_cache when Next.js supports SSR/page-cache on RSC routes to increase efficiency
//       Use edge runtime config for better cold start, if available on your Next.js version

/**
 * Retrieve a user's full profile from Firestore by their ID, applying authentication, authorization, and privacy filtering.
 * Steps:
 *  - Authenticates the requesting user (session).
 *  - Checks whether requesting user is authorized by role or ownership.
 *  - Retrieves the profile from DB; handles DB and app-level errors gracefully (returns null for not found).
 *  - Returns either full profile (for admin/own account) or privacy-filtered partial profile otherwise.
 * 
 * @param userId - The ID of the user to retrieve
 * @returns Promise with AuthUser object or null if not authorized/not found.
 */
export async function getUserById(userId: string): Promise<Partial<AuthUser> | null> {
  // Log retrieval attempt for tracing/debug
  console.log(`🔍 getUserById - Starting retrieval process for user ID: ${userId}`);

  try {
    // Step 1: Authenticate the requesting user; must have a valid session with a user
    const session = await auth();
    if (!session || !session.user) {
      // Not authenticated; abort
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserById - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    // Step 2: Ensure either admin or fetching own profile (authorization check)
    if (requestingUserId !== userId && !isPlatformAdmin(resolvePersistedUserRole(requestingUserRole))) {
      // Not allowed to access this profile
      console.log(`Services: getUserById - Unauthorized access attempt to user ${userId} by user ${requestingUserId}`);
      return null; // Privacy: never leak not-found vs unauthorized
    }

    // Step 3: Fetch user document from database, abstracted
    console.log(`🔍 getUserById - Using database abstraction layer for user: ${userId}`);

    try {
      // Query DB for user doc by ID; uses platform DB abstraction
      const userResult = await db().readDoc<Record<string, unknown>>('users', userId);
      console.log(`🔍 getUserById - Database read result:`, {
        success: userResult.success,
        hasData: !!userResult.data,
        error: userResult.error
      });

      // Handle document not found or failed
      if (!userResult.success) {
        if (userResult.metadata?.operation === 'initialize') {
          console.error(`❌ getUserById - Database initialization failed:`, userResult.error);
        }
        console.log(`Services: getUserById - User document not found for ID: ${userId}`);
        return null;
      }

      if (!userResult.data) {
        console.log(`Services: getUserById - User document not found for ID: ${userId}`);
        return null;
      }

      const dbDocument = userResult.data;
      console.log(`Services: getUserById - Successfully retrieved database document for ID: ${userId}`, {
        hasDocument: !!dbDocument,
        documentType: typeof dbDocument,
        documentKeys: dbDocument ? Object.keys(dbDocument) : []
      });

      // STUB: If the readDoc call is a stub/mocked, implement DB read using the actual provider:
      //       1. Connect to users collection/table (Firebase/Firestore or Postgres etc)
      //       2. Lookup document by userId
      //       3. Parse/validate returned data shape

      // Here we process the DB's user doc—this is the actual user profile payload
      const userData = dbDocument;
      console.log(`Services: getUserById - Extracted user data:`, {
        hasData: !!userData,
        dataKeys: userData ? Object.keys(userData) : [],
        dataType: typeof userData
      });

      if (!userData) {
        console.log(`Services: getUserById - No data found in database document`);
        return null;
      }

      // Step 5: Reformat raw data to rich AuthUser profile with privacy/culture/external, etc
      console.log(`Services: getUserById - Processing enhanced user profile for ID: ${userId}`);
      const enhancedUserProfile = processEnhancedUserProfile(userData);

      // Step 6: Return data according to privacy rules
      // - Admin or own profile: return full detail
      // - Others: strip sensitive data
      
      const isOwnProfile = requestingUserId === userId;
      if (isOwnProfile || isPlatformAdmin(resolvePersistedUserRole(requestingUserRole))) {
        // Full profile to owner or admins
        console.log(`Services: getUserById - ${isOwnProfile ? 'User accessing own profile' : 'Admin user'} retrieved full enhanced profile for ID: ${userId}`);
        return enhancedUserProfile;
      } else {
        // Privacy filter for non-owners/non-admins
        console.log(`Services: getUserById - Non-admin user retrieved safe profile data for ID: ${userId}`);

        // Filter out sensitive fields before return
        const safeUserData: Partial<AuthUser> = {
          ...enhancedUserProfile,
          ethicalAI: undefined,     // Remove ethical AI profile analytics
          analytics: undefined,     // Remove internal analytics
          evolution: undefined,     // Remove in-depth progress/gamification details
          privacy: undefined        // Remove privacy settings object
        };
        return safeUserData;
      }

    } catch (error) {
      // Gracefully handle DB errors, logging for internal debugging
      console.error('Services: getUserById - Error retrieving user profile:', error);
      console.error('Services: getUserById - Error details:', {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null; // Always null on failure for privacy
    }
  } catch (error) {
    // Authorization error, invalid session, etc—return null for fail-closed
    console.error('Services: getUserById - Authentication or authorization error:', error);
    return null;
  }
}

/** Request-scoped dedupe — use from RSC pages that may render twice in dev Strict Mode. */
export const getUserByIdCached = cache(getUserById)
