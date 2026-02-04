import { getDatabaseService, initializeDatabase } from '@/lib/database';
import { logger } from '@/lib/logger';
import type { AuthUser } from '@/features/auth/types';
import type { DefaultSession } from 'next-auth';

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
  async createInitialUserDocument(authUser: AuthUser | DefaultSession['user']): Promise<void> {
    try {
      console.log(`UserMigration: Creating initial document for user ${authUser.id}`);

      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        logger.error('UserMigration: Database initialization failed', { error: initResult.error });
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();

      // Create initial user document
      const initialUserData = {
        id: authUser.id || (authUser as any).globalUserId,
        email: authUser.email || '',
        name: authUser.name || null,
        username: (authUser as any).username || null,
        photoURL: (authUser as any).photoURL || (authUser as any).image || null,
        role: (authUser as any).role || 'MEMBER',
        isVerified: (authUser as any).emailVerified || (authUser as any).email_verified || false,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Initialize empty arrays for features that might be used later
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

      // Create the user document
      logger.info('UserMigration: About to create user document', {
        userId: authUser.id,
        firebaseUid: initialUserData.id,
        email: authUser.email
      });

      const createResult = await dbService.create('users', initialUserData);

      logger.info('UserMigration: Create result', {
        userId: authUser.id,
        success: createResult.success,
        error: createResult.error,
        hasData: !!createResult.data
      });

      if (!createResult.success) {
        logger.error('UserMigration: Failed to create user document', {
          userId: authUser.id,
          error: createResult.error
        });
        throw new Error('Failed to create user document');
      }

      logger.info('UserMigration: Successfully created initial user document', {
        userId: authUser.id,
        email: authUser.email
      });

    } catch (error) {
      logger.error('UserMigration: Error creating initial user document', {
        userId: authUser.id,
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
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        console.error('UserMigration: Database initialization failed', initResult.error);
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();
      const result = await dbService.read('users', userId);
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
  async ensureUserDocument(authUser: AuthUser): Promise<void> {
    try {
      console.log('UserMigration: Checking if user document exists for', authUser.id);
      const exists = await this.userDocumentExists(authUser.id);
      console.log('UserMigration: User document exists check result:', exists);

      if (!exists) {
        console.log('UserMigration: User document does not exist, creating initial document');
        await this.createInitialUserDocument(authUser);
        console.log('UserMigration: Initial user document created successfully');
        UserMigrationService.userCache.set(authUser.id, { exists: true, timestamp: Date.now() });
      } else {
        console.log('UserMigration: User document already exists');
      }
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

// Export singleton instance
export const userMigrationService = UserMigrationService.getInstance();

// Export convenience function
export async function createInitialUserDocument(authUser: AuthUser | DefaultSession['user']): Promise<void> {
  return userMigrationService.createInitialUserDocument(authUser);
}
