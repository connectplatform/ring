import { 
  DocumentData, 
  FirestoreDataConverter, 
  QueryDocumentSnapshot, 
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';
import { UserRole } from '@/features/auth/types';
import { UserCreditBalance } from '@/lib/zod/credit-schemas';

/**
 * Extended user profile interface with credit balance
 */
export interface UserProfileWithCredits {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  created_at: number;
  updated_at: number;
  last_login?: number;
  email_verified: boolean;
  phone?: string;
  phone_verified?: boolean;
  
  // Profile information
  first_name?: string;
  last_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  
  // Preferences
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
  
  // Privacy settings
  privacy?: {
    profile_visibility: 'public' | 'members' | 'private';
    show_email: boolean;
    show_phone: boolean;
    show_location: boolean;
  };
  
  // KYC and verification
  kyc_status?: 'not_started' | 'pending' | 'approved' | 'rejected';
  kyc_verified_at?: number;
  kyc_documents?: {
    identity_verified: boolean;
    address_verified: boolean;
    phone_verified: boolean;
  };
  
  // Credit balance system
  credit_balance?: UserCreditBalance;
  
  // Membership information
  membership?: {
    tier: UserRole;
    upgraded_at?: number;
    expires_at?: number;
    auto_renew: boolean;
    payment_method?: 'stripe' | 'ring_credits' | 'crypto';
  };
  
  // Wallet information (basic)
  wallet?: {
    address?: string;
    created_at?: number;
    backup_completed: boolean;
  };
  
  // Activity tracking
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
 */
export const userProfileWithCreditsConverter: FirestoreDataConverter<UserProfileWithCredits> = {
  toFirestore(userProfile: UserProfileWithCredits): DocumentData {
    const data: DocumentData = {
      email: userProfile.email,
      role: userProfile.role,
      created_at: Timestamp.fromMillis(userProfile.created_at),
      updated_at: Timestamp.fromMillis(userProfile.updated_at),
      email_verified: userProfile.email_verified,
    };

    // Add optional fields only if they exist
    if (userProfile.name) data.name = userProfile.name;
    if (userProfile.avatar) data.avatar = userProfile.avatar;
    if (userProfile.phone) data.phone = userProfile.phone;
    if (userProfile.phone_verified !== undefined) data.phone_verified = userProfile.phone_verified;
    if (userProfile.last_login) data.last_login = Timestamp.fromMillis(userProfile.last_login);

    // Profile information
    if (userProfile.first_name) data.first_name = userProfile.first_name;
    if (userProfile.last_name) data.last_name = userProfile.last_name;
    if (userProfile.bio) data.bio = userProfile.bio;
    if (userProfile.location) data.location = userProfile.location;
    if (userProfile.website) data.website = userProfile.website;
    if (userProfile.linkedin) data.linkedin = userProfile.linkedin;
    if (userProfile.twitter) data.twitter = userProfile.twitter;

    // Preferences
    if (userProfile.preferences) data.preferences = userProfile.preferences;
    
    // Privacy settings
    if (userProfile.privacy) data.privacy = userProfile.privacy;

    // KYC information
    if (userProfile.kyc_status) data.kyc_status = userProfile.kyc_status;
    if (userProfile.kyc_verified_at) data.kyc_verified_at = Timestamp.fromMillis(userProfile.kyc_verified_at);
    if (userProfile.kyc_documents) data.kyc_documents = userProfile.kyc_documents;

    // Credit balance - convert timestamps
    if (userProfile.credit_balance) {
      data.credit_balance = {
        ...userProfile.credit_balance,
        last_updated: Timestamp.fromMillis(userProfile.credit_balance.last_updated),
        subscription_next_payment: userProfile.credit_balance.subscription_next_payment
          ? Timestamp.fromMillis(userProfile.credit_balance.subscription_next_payment)
          : undefined,
      };
    }

    // Membership information
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

    // Wallet information
    if (userProfile.wallet) {
      data.wallet = {
        ...userProfile.wallet,
        created_at: userProfile.wallet.created_at
          ? Timestamp.fromMillis(userProfile.wallet.created_at)
          : undefined,
      };
    }

    // Activity tracking
    if (userProfile.activity) {
      data.activity = {
        ...userProfile.activity,
        last_active: Timestamp.fromMillis(userProfile.activity.last_active),
      };
    }

    return data;
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): UserProfileWithCredits {
    const data = snapshot.data(options);

    // Convert Timestamps back to numbers
    const userProfile: UserProfileWithCredits = {
      id: snapshot.id,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      role: data.role,
      created_at: data.created_at?.toMillis() || Date.now(),
      updated_at: data.updated_at?.toMillis() || Date.now(),
      last_login: data.last_login?.toMillis(),
      email_verified: data.email_verified || false,
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

      // Preferences
      preferences: data.preferences,
      
      // Privacy settings
      privacy: data.privacy,

      // KYC information
      kyc_status: data.kyc_status,
      kyc_verified_at: data.kyc_verified_at?.toMillis(),
      kyc_documents: data.kyc_documents,

      // Credit balance - convert timestamps back
      credit_balance: data.credit_balance ? {
        amount: data.credit_balance.amount || '0',
        usd_equivalent: data.credit_balance.usd_equivalent || '0',
        last_updated: data.credit_balance.last_updated?.toMillis() || Date.now(),
        last_transaction_id: data.credit_balance.last_transaction_id,
        subscription_active: data.credit_balance.subscription_active || false,
        subscription_contract_address: data.credit_balance.subscription_contract_address,
        subscription_next_payment: data.credit_balance.subscription_next_payment?.toMillis(),
      } : undefined,

      // Membership information
      membership: data.membership ? {
        tier: data.membership.tier,
        upgraded_at: data.membership.upgraded_at?.toMillis(),
        expires_at: data.membership.expires_at?.toMillis(),
        auto_renew: data.membership.auto_renew || false,
        payment_method: data.membership.payment_method,
      } : undefined,

      // Wallet information
      wallet: data.wallet ? {
        address: data.wallet.address,
        created_at: data.wallet.created_at?.toMillis(),
        backup_completed: data.wallet.backup_completed || false,
      } : undefined,

      // Activity tracking
      activity: data.activity ? {
        last_active: data.activity.last_active?.toMillis() || Date.now(),
        login_count: data.activity.login_count || 0,
        entities_created: data.activity.entities_created || 0,
        opportunities_created: data.activity.opportunities_created || 0,
        messages_sent: data.activity.messages_sent || 0,
      } : undefined,
    };

    return userProfile;
  },
};

/**
 * Helper function to create a new user profile with default credit balance
 */
export function createNewUserProfileWithCredits(
  id: string,
  email: string,
  name?: string,
  role: UserRole = UserRole.VISITOR
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
    
    // Initialize with empty credit balance
    credit_balance: {
      amount: '0',
      usd_equivalent: '0',
      last_updated: now,
      subscription_active: false,
    },
    
    // Default preferences
    preferences: {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
        marketing: false,
      },
    },
    
    // Default privacy settings
    privacy: {
      profile_visibility: 'members',
      show_email: false,
      show_phone: false,
      show_location: false,
    },
    
    // Default activity tracking
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
 * Helper function to update user's last active timestamp
 */
export function updateUserActivity(
  userProfile: UserProfileWithCredits,
  activityUpdate: Partial<UserProfileWithCredits['activity']>
): UserProfileWithCredits {
  return {
    ...userProfile,
    updated_at: Date.now(),
    activity: {
      ...userProfile.activity,
      last_active: Date.now(),
      ...activityUpdate,
    },
  };
}
