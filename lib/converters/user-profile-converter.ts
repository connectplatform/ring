import { 
  DocumentData, 
  FirestoreDataConverter, 
  QueryDocumentSnapshot, 
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';
import { UserRolesArray } from '@/features/auth/user-role';
import { UserCreditBalance } from '@/lib/zod/credit-schemas';
import { DEFAULT_LOCALE } from '@/lib/locale-config';
import { getDefaultTheme, getMainCurrencySymbol } from '@/lib/ring-config-core';
import type { MembershipPaymentProvider } from '@/lib/ring-config-types';

/**
 * Firestore converter for user profiles (firebase-full backend mode).
 *
 * Ring production (k8s-postgres-fcm) does NOT use this path — DatabaseService /
 * Postgres adapters own user docs. This converter remains for Firebase prototyping
 * and must stay aligned with membership payment provider SSOT
 * (`MembershipPaymentProvider` in ring-config-types), not a hardcoded stripe-only union.
 */
export interface UserProfileWithCredits {
  // Unique user identifier
  id: string;
  // Email address
  email: string;
  // Optional display/canonical name
  name?: string;
  // Optional avatar/profile image URL
  avatar?: string;
  // User roles (array-based enum)
  role: UserRolesArray;
  // Creation and update timestamps (epoch ms)
  created_at: number;
  updated_at: number;
  // Last login timestamp (epoch ms)
  last_login?: number;
  // Email verification status
  email_verified: boolean;
  // Optional phone number
  phone?: string;
  // Optional phone verification status
  phone_verified?: boolean;
  
  // Profile information (optional)
  first_name?: string;
  last_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  
  // User preference block (optional)
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    timezone?: string;
    notifications?: {
      email: boolean;
      push: boolean;
      sms: boolean;
      marketing: boolean;
    };
  };
  
  // Privacy settings (optional)
  privacy?: {
    profile_visibility: 'public' | 'members' | 'private';
    show_email: boolean;
    show_phone: boolean;
    show_location: boolean;
  };
  
  // Know Your Customer & verification (optional)
  kyc_status?: 'not_started' | 'pending' | 'approved' | 'rejected';
  kyc_verified_at?: number;
  kyc_documents?: {
    identity_verified: boolean;
    address_verified: boolean;
    phone_verified: boolean;
  };
  
  // Platform credit balance (optional)
  credit_balance?: UserCreditBalance;
  
  // Membership status (optional)
  membership?: {
    tier: UserRolesArray;
    upgraded_at?: number;
    expires_at?: number;
    auto_renew: boolean;
    payment_method?: MembershipPaymentProvider | 'crypto';
  };
  
  // Wallet configuration (optional)
  wallet?: {
    address?: string;
    created_at?: number;
    backup_completed: boolean;
  };
  
  // User activity summary (optional)
  activity?: {
    last_active: number;
    login_count: number;
    entities_created: number;
    opportunities_created: number;
    messages_sent: number;
  };
}

/**
 * Firestore converter for user profiles with credit balance support
 * Implements toFirestore (for writing) and fromFirestore (for reading/deserialization)
 */
export const userProfileWithCreditsConverter: FirestoreDataConverter<UserProfileWithCredits> = {
  /**
   * Converts a UserProfileWithCredits object into Firestore document data.
   * Handles conversion of Timestamps, and includes only non-null/undefined fields.
   */
  toFirestore(userProfile: UserProfileWithCredits): DocumentData {
    // Prepare Firestore writable data
    const data: DocumentData = {
      email: userProfile.email,
      role: userProfile.role,
      created_at: Timestamp.fromMillis(userProfile.created_at), // Store as Firestore Timestamp
      updated_at: Timestamp.fromMillis(userProfile.updated_at),
      email_verified: userProfile.email_verified,
    };

    // Optionally copy simple properties if present
    if (userProfile.name) data.name = userProfile.name;
    if (userProfile.avatar) data.avatar = userProfile.avatar;
    if (userProfile.phone) data.phone = userProfile.phone;
    if (userProfile.phone_verified !== undefined) data.phone_verified = userProfile.phone_verified;
    if (userProfile.last_login)
      data.last_login = Timestamp.fromMillis(userProfile.last_login);

    // Profile info
    if (userProfile.first_name) data.first_name = userProfile.first_name;
    if (userProfile.last_name) data.last_name = userProfile.last_name;
    if (userProfile.bio) data.bio = userProfile.bio;
    if (userProfile.location) data.location = userProfile.location;
    if (userProfile.website) data.website = userProfile.website;
    if (userProfile.linkedin) data.linkedin = userProfile.linkedin;
    if (userProfile.twitter) data.twitter = userProfile.twitter;

    // Copy preferences if exists (as object)
    if (userProfile.preferences) data.preferences = userProfile.preferences;
    
    // Privacy settings if present
    if (userProfile.privacy) data.privacy = userProfile.privacy;

    // KYC information (if set)
    if (userProfile.kyc_status) data.kyc_status = userProfile.kyc_status;
    if (userProfile.kyc_verified_at)
      data.kyc_verified_at = Timestamp.fromMillis(userProfile.kyc_verified_at);
    if (userProfile.kyc_documents) data.kyc_documents = userProfile.kyc_documents;

    // Credit balance (map timestamps to Firestore Timestamp)
    if (userProfile.credit_balance) {
      data.credit_balance = {
        ...userProfile.credit_balance,
        last_updated: Timestamp.fromMillis(userProfile.credit_balance.last_updated),
        subscription_next_payment: userProfile.credit_balance.subscription_next_payment
          ? Timestamp.fromMillis(userProfile.credit_balance.subscription_next_payment)
          : undefined, // Could be left undefined if not present
      };
    }

    // Membership information (map dates to Firestore Timestamp)
    if (userProfile.membership) {
      data.membership = {
        ...userProfile.membership,
        upgraded_at: userProfile.membership.upgraded_at
          ? Timestamp.fromMillis(userProfile.membership.upgraded_at)
          : undefined,
        expires_at: userProfile.membership.expires_at
          ? Timestamp.fromMillis(userProfile.membership.expires_at)
          : undefined,
      };
    }

    // Wallet properties (timestamp for creation)
    if (userProfile.wallet) {
      data.wallet = {
        ...userProfile.wallet,
        created_at: userProfile.wallet.created_at
          ? Timestamp.fromMillis(userProfile.wallet.created_at)
          : undefined,
      };
    }

    // Activity tracking (last_active as Timestamp)
    if (userProfile.activity) {
      data.activity = {
        ...userProfile.activity,
        last_active: Timestamp.fromMillis(userProfile.activity.last_active),
      };
    }

    return data;
  },

  /**
   * Converts Firestore document data to a UserProfileWithCredits object.
   * Handles logic for timestamp-to-millis and default value fallbacks.
   */
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): UserProfileWithCredits {
    const data = snapshot.data(options);

    // Construct resultant typed object, mapping and defaulting values as needed
    const userProfile: UserProfileWithCredits = {
      id: snapshot.id, // Firestore doc id
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      role: data.role,
      created_at: data.created_at?.toMillis() || Date.now(),
      updated_at: data.updated_at?.toMillis() || Date.now(),
      last_login: data.last_login?.toMillis(),
      email_verified: data.email_verified ?? false,
      phone: data.phone,
      phone_verified: data.phone_verified,

      // Profile information
      first_name: data.first_name,
      last_name: data.last_name,
      bio: data.bio,
      location: data.location,
      website: data.website,
      linkedin: data.linkedin,
      twitter: data.twitter,

      // Preferences (may be undefined)
      preferences: data.preferences,
      
      // Privacy settings
      privacy: data.privacy,

      // KYC info
      kyc_status: data.kyc_status,
      kyc_verified_at: data.kyc_verified_at?.toMillis(),
      kyc_documents: data.kyc_documents,

      // Credit balance - properly handle missing keys and map timestamp properties to millis
      credit_balance: data.credit_balance ? {
        amount: data.credit_balance.amount ?? '0',
        main_currency_equivalent: data.credit_balance.main_currency_equivalent ?? '0',
        main_currency: data.credit_balance.main_currency ?? 'USD',
        last_updated: data.credit_balance.last_updated?.toMillis() || Date.now(),
        last_transaction_id: data.credit_balance.last_transaction_id,
        subscription_active: data.credit_balance.subscription_active ?? false,
        subscription_contract_address: data.credit_balance.subscription_contract_address,
        subscription_next_payment: data.credit_balance.subscription_next_payment?.toMillis(),
      } : undefined,

      // Membership info
      membership: data.membership ? {
        tier: data.membership.tier,
        upgraded_at: data.membership.upgraded_at?.toMillis(),
        expires_at: data.membership.expires_at?.toMillis(),
        auto_renew: data.membership.auto_renew ?? false,
        payment_method: data.membership.payment_method,
      } : undefined,

      // Wallet
      wallet: data.wallet ? {
        address: data.wallet.address,
        created_at: data.wallet.created_at?.toMillis(),
        backup_completed: data.wallet.backup_completed ?? false,
      } : undefined,

      // Activity tracking
      activity: data.activity ? {
        last_active: data.activity.last_active?.toMillis() || Date.now(),
        login_count: data.activity.login_count ?? 0,
        entities_created: data.activity.entities_created ?? 0,
        opportunities_created: data.activity.opportunities_created ?? 0,
        messages_sent: data.activity.messages_sent ?? 0,
      } : undefined,
    };

    return userProfile;
  },
};

/**
 * Helper function to create a new user profile with default credit balance and sensible defaults for preferences, privacy, activity, etc.
 * 
 * @param id - unique user ID
 * @param email - user email
 * @param name - optional display name
 * @param role - user role (defaults to visitor)
 */
export function createNewUserProfileWithCredits(
  id: string,
  email: string,
  name?: string,
  role: UserRolesArray = UserRolesArray.visitor
): UserProfileWithCredits {
  const now = Date.now();

  return {
    id,
    email,
    name,
    role,
    created_at: now,
    updated_at: now,
    email_verified: false,
    
    // Initialize with empty credit balance in the project main currency
    credit_balance: {
      amount: '0',
      main_currency_equivalent: '0',
      main_currency: getMainCurrencySymbol(),
      last_updated: now,
      subscription_active: false,
    },
    
    // Default preferences for new user (theme, language, notifications)
    preferences: {
      theme: getDefaultTheme(),
      language: DEFAULT_LOCALE,
      notifications: {
        email: true,
        push: true,
        sms: false,
        marketing: false,
      },
    },
    
    // Default privacy settings (restrictive by default)
    privacy: {
      profile_visibility: 'members',
      show_email: false,
      show_phone: false,
      show_location: false,
    },
    
    // Default activity tracking (initialized with login)
    activity: {
      last_active: now,
      login_count: 1,
      entities_created: 0,
      opportunities_created: 0,
      messages_sent: 0,
    },
  };
}

/**
 * Helper function to update user's last active timestamp and other tracked activity.
 * Returns an updated copy (pure).
 *
 * @param userProfile Current profile object
 * @param activityUpdate Partial activity tracking object (may contain one or more fields)
 * @returns Updated UserProfileWithCredits object with new updated_at timestamp and activity
 */
export function updateUserActivity(
  userProfile: UserProfileWithCredits,
  activityUpdate: Partial<UserProfileWithCredits['activity']>
): UserProfileWithCredits {
  // Counters are additive: `activityUpdate` carries deltas, not absolute values.
  const previous = userProfile.activity;
  return {
    ...userProfile,
    updated_at: Date.now(),
    activity: {
      ...previous,
      last_active: Date.now(),
      login_count: (previous?.login_count ?? 0) + 1,
      entities_created: (previous?.entities_created ?? 0) + (activityUpdate.entities_created ?? 0),
      opportunities_created:
        (previous?.opportunities_created ?? 0) + (activityUpdate.opportunities_created ?? 0),
      messages_sent: (previous?.messages_sent ?? 0) + (activityUpdate.messages_sent ?? 0),
    },
  };
}

/**
 * Persistence lives in Server Actions, not here:
 * - profile edits → `updateProfile` (`app/_actions/profile.ts`, `useActionState`)
 * - activity counters → `recordUserActivity` (same file)
 * These converters stay pure so both the auth adapter and the actions can reuse them.
 */