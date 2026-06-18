import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import type { AuthUser } from '@/features/auth/types';
import type { DefaultSession } from 'next-auth';
import { UserRole, parseUserRole } from '@/features/auth/user-role';
import {
  findUserByEmail,
  isUniqueViolation,
  normalizeAuthEmail,
  resolveCanonicalUser,
  resolveInFlightByEmail,
} from '@/features/auth/services/user-resolve';

/**
 * Service for migrating and initializing user documents
 * Creates user documents for authenticated users who don't exist in the database
 */
export class UserMigrationService {
  private static instance: UserMigrationService;
  private static userCache = new Map<string, { exists: boolean; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): UserMigrationService {
    if (!UserMigrationService.instance) {
      UserMigrationService.instance = new UserMigrationService();
    }
    return UserMigrationService.instance;
  }

  /**
   * Create initial user document for authenticated user
   */
  async createInitialUserDocument(authUser: AuthUser | DefaultSession['user']): Promise<string> {
    const userId = authUser.id || (authUser as { globalUserId?: string }).globalUserId;
    const rawEmail = authUser.email;

    if (!userId) {
      throw new Error('UserMigration: authUser.id is required to create initial document');
    }
    if (!rawEmail) {
      throw new Error('UserMigration: authUser.email is required to create initial document');
    }

    const email = normalizeAuthEmail(rawEmail);

    try {
      const existingByEmail = await findUserByEmail(email);
      if (existingByEmail) {
        logger.info('UserMigration: User already exists by email, skipping create', {
          userId,
          canonicalId: existingByEmail.id,
          email,
        });
        return existingByEmail.id;
      }

      console.log(`UserMigration: Creating initial document for user ${userId}`);

      const initialUserData = {
        id: userId,
        globalUserId: userId,
        email,
        name: authUser.name || null,
        username: (authUser as { username?: string }).username || null,
        photoURL: (authUser as { photoURL?: string; image?: string }).photoURL
          || (authUser as { image?: string }).image
          || null,
        role: parseUserRole((authUser as { role?: string }).role) ?? UserRole.subscriber,
        isVerified: Boolean(
          (authUser as { emailVerified?: boolean }).emailVerified
          || (authUser as { email_verified?: boolean }).email_verified
        ),
        createdAt: new Date(),
        updatedAt: new Date(),

        wallets: [],
        credit_balance: {
          amount: '0',
          usd_equivalent: '0',
          last_updated: Date.now(),
          subscription_active: false,
        },
        credit_transactions: [],
        communication: {
          telegramUsername: null,
          whatsappNumber: null,
          preferredContactMethod: 'email'
        },
        cultural: {
          country: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        organization: null,
        position: null,
        bio: null,
        skills: [],
        integrations: {
          socialProfiles: {
            linkedin: null,
            twitter: null,
            facebook: null
          }
        },
        privacy: {
          dataSharingConsent: {
            analytics: false,
            personalization: false
          },
          anonymizedResearchConsent: false,
          contactPreferences: {
            marketing: false,
            opportunities: false
          }
        },
        experience: {
          notificationSettings: {
            frequency: 'immediate'
          },
          uiCustomizations: {
            compactView: false
          }
        },
        settings: {
          aiMatching: {
            enabled: false,
            minMatchScore: 70,
            maxMatchesPerDay: 10,
            autoFillSuggestions: false
          }
        },
        notificationPreferences: {
          email: false,
          inApp: true,
          sms: false
        }
      };

      logger.info('UserMigration: About to create user document', {
        userId,
        email,
      });

      const createResult = await db().createDoc('users', initialUserData, { id: userId });

      logger.info('UserMigration: Create result', {
        userId,
        success: createResult.success,
        error: createResult.error,
        hasData: !!createResult.data
      });

      if (!createResult.success) {
        if (isUniqueViolation(createResult.error)) {
          const raced = await findUserByEmail(email);
          if (raced) return raced.id;
        }
        logger.error('UserMigration: Failed to create user document', {
          userId,
          error: createResult.error
        });
        throw new Error('Failed to create user document');
      }

      logger.info('UserMigration: Successfully created initial user document', {
        userId,
        email,
      });

      return userId;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await findUserByEmail(email);
        if (raced) return raced.id;
      }
      logger.error('UserMigration: Error creating initial user document', {
        userId,
        error
      });
      throw error;
    }
  }

  /**
   * Check if user document exists
   */
  async userDocumentExists(userId: string): Promise<boolean> {
    const cached = UserMigrationService.userCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < UserMigrationService.CACHE_TTL) {
      return cached.exists;
    }
    try {
      console.log('UserMigration: Checking database for user document', userId);
      const result = await db().readDoc('users', userId);
      const exists = result.success && !!result.data;
      UserMigrationService.userCache.set(userId, { exists, timestamp: Date.now() });
      return exists;
    } catch (error) {
      console.error('UserMigration: Error checking user document existence', { userId, error });
      return false;
    }
  }

  /**
   * Ensure user document exists, create if it doesn't
   */
  async ensureUserDocument(authUser: AuthUser): Promise<string> {
    try {
      const canonicalId = await resolveInFlightByEmail(authUser.email, async () => {
        console.log('UserMigration: Resolving canonical user for', authUser.id, authUser.email);

        const resolved = await resolveCanonicalUser({
          id: authUser.id,
          email: authUser.email,
        });

        if (resolved.userRow) {
          console.log('UserMigration: Canonical user already exists:', resolved.canonicalId);
          return resolved.canonicalId;
        }

        console.log('UserMigration: User document does not exist, creating initial document');
        const createdId = await this.createInitialUserDocument(authUser);
        console.log('UserMigration: Initial user document created successfully');
        return createdId;
      });

      UserMigrationService.userCache.set(canonicalId, { exists: true, timestamp: Date.now() });
      if (authUser.id && authUser.id !== canonicalId) {
        UserMigrationService.userCache.set(authUser.id, { exists: true, timestamp: Date.now() });
      }

      return canonicalId;
    } catch (error) {
      console.error('UserMigration: Error in ensureUserDocument:', error);
      throw error;
    }
  }

  static invalidateUserCache(userId: string): void {
    this.userCache.delete(userId);
  }

  static clearCache(): void {
    this.userCache.clear();
  }
}

export const userMigrationService = UserMigrationService.getInstance();

export async function createInitialUserDocument(authUser: AuthUser | DefaultSession['user']): Promise<string> {
  return userMigrationService.createInitialUserDocument(authUser);
}

export async function ensureUserDocument(authUser: AuthUser): Promise<string> {
  return userMigrationService.ensureUserDocument(authUser);
}
