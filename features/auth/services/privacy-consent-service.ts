// ============================================================================
// PRIVACY CONSENT MANAGEMENT SERVICE
// GDPR-compliant user privacy and consent management
// ============================================================================

import { cache } from 'react';
import { PrivacyConsent } from '@/features/auth/types';
import { getDatabaseService, initializeDatabase } from '@/lib/database';
import { auth } from '@/auth';

/**
 * Privacy Consent Management Service
 * Handles GDPR-compliant user privacy preferences and consent management
 */
export class PrivacyConsentService {
  private static instance: PrivacyConsentService;

  static getInstance(): PrivacyConsentService {
    if (!PrivacyConsentService.instance) {
      PrivacyConsentService.instance = new PrivacyConsentService();
    }
    return PrivacyConsentService.instance;
  }

  /**
   * Get user privacy consent settings
   * @param userId Global user ID
   * @returns Privacy consent settings or null if not found
   */
  async getUserConsent(userId: string): Promise<PrivacyConsent | null> {
    console.log(`🔒 PrivacyConsentService - Getting consent for user ${userId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();
      const result = await dbService.read('users', userId);

      if (!result.success || !result.data) {
        console.log(`PrivacyConsentService - No user data found for ${userId}`);
        return null;
      }

      const userData = result.data.data || result.data;

      // Extract privacy consent from user data
      if (!userData.data_sharing_consent) {
        return null;
      }

      return {
        dataSharingConsent: userData.data_sharing_consent,
        anonymizedResearchConsent: userData.anonymized_research_consent || false,
        contactPreferences: userData.contact_preferences || {
          marketing: false,
          opportunities: true,
          system: true,
          evolution: true
        }
      };
    } catch (error) {
      console.error('PrivacyConsentService - Error getting user consent:', error);
      throw error;
    }
  }

  /**
   * Update user privacy consent settings
   * @param userId Global user ID
   * @param consent Privacy consent settings
   * @returns Updated consent settings
   */
  async updateUserConsent(userId: string, consent: PrivacyConsent): Promise<PrivacyConsent> {
    console.log(`🔒 PrivacyConsentService - Updating consent for user ${userId}`);

    try {
      // Verify user can only update their own consent
      const session = await auth();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Users can only update their own consent');
      }

      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const updateData = {
        data_sharing_consent: consent.dataSharingConsent,
        anonymized_research_consent: consent.anonymizedResearchConsent,
        contact_preferences: consent.contactPreferences,
        last_profile_update: new Date().toISOString()
      };

      const result = await dbService.update('users', userId, { data: updateData });

      if (!result.success) {
        throw new Error(`Failed to update consent: ${result.error}`);
      }

      console.log(`✅ PrivacyConsentService - Successfully updated consent for user ${userId}`);
      return consent;
    } catch (error) {
      console.error('PrivacyConsentService - Error updating user consent:', error);
      throw error;
    }
  }

  /**
   * Check if user has consented to specific data usage
   * @param userId Global user ID
   * @param consentType Type of consent to check
   * @returns Boolean indicating if consent is granted
   */
  async hasConsent(userId: string, consentType: keyof PrivacyConsent['dataSharingConsent'] | 'research' | 'contact'): Promise<boolean> {
    try {
      const consent = await this.getUserConsent(userId);
      if (!consent) {
        return false; // No consent data means no consent
      }

      switch (consentType) {
        case 'analytics':
        case 'personalization':
        case 'notifications':
        case 'research':
          return consent.dataSharingConsent[consentType] || false;
        case 'contact':
          return true; // Contact preferences are always available, just configured differently
        default:
          return false;
      }
    } catch (error) {
      console.error('PrivacyConsentService - Error checking consent:', error);
      return false; // Default to no consent on error
    }
  }

  /**
   * Get user's contact preferences for specific communication type
   * @param userId Global user ID
   * @param contactType Type of contact (marketing, opportunities, system, evolution)
   * @returns Boolean indicating if contact is allowed
   */
  async canContact(userId: string, contactType: keyof PrivacyConsent['contactPreferences']): Promise<boolean> {
    try {
      const consent = await this.getUserConsent(userId);
      if (!consent) {
        // Default contact preferences if no explicit consent set
        const defaults: PrivacyConsent['contactPreferences'] = {
          marketing: false,
          opportunities: true,
          system: true,
          evolution: true
        };
        return defaults[contactType];
      }

      return consent.contactPreferences[contactType] || false;
    } catch (error) {
      console.error('PrivacyConsentService - Error checking contact preferences:', error);
      return false;
    }
  }

  /**
   * Initialize default privacy consent for new users
   * @param userId Global user ID
   * @returns Default consent settings
   */
  async initializeDefaultConsent(userId: string): Promise<PrivacyConsent> {
    console.log(`🔒 PrivacyConsentService - Initializing default consent for new user ${userId}`);

    const defaultConsent: PrivacyConsent = {
      dataSharingConsent: {
        analytics: true,      // Enable analytics by default for platform improvement
        personalization: true, // Enable personalization by default
        notifications: true,   // Enable notifications by default
        research: true        // Enable research by default (anonymized)
      },
      anonymizedResearchConsent: true,
      contactPreferences: {
        marketing: false,      // Opt-out of marketing by default
        opportunities: true,   // Allow opportunity notifications
        system: true,          // Allow system notifications
        evolution: true        // Allow growth suggestions
      }
    };

    return await this.updateUserConsent(userId, defaultConsent);
  }

  /**
   * Withdraw all consent (right to be forgotten preparation)
   * @param userId Global user ID
   * @returns Updated consent settings (all disabled)
   */
  async withdrawAllConsent(userId: string): Promise<PrivacyConsent> {
    console.log(`🔒 PrivacyConsentService - Withdrawing all consent for user ${userId}`);

    const withdrawnConsent: PrivacyConsent = {
      dataSharingConsent: {
        analytics: false,
        personalization: false,
        notifications: false,
        research: false
      },
      anonymizedResearchConsent: false,
      contactPreferences: {
        marketing: false,
        opportunities: false,
        system: false,
        evolution: false
      }
    };

    return await this.updateUserConsent(userId, withdrawnConsent);
  }

  /**
   * Export user's privacy consent data for GDPR compliance
   * @param userId Global user ID
   * @returns Privacy consent data export
   */
  async exportConsentData(userId: string): Promise<any> {
    console.log(`🔒 PrivacyConsentService - Exporting consent data for user ${userId}`);

    const consent = await this.getUserConsent(userId);
    if (!consent) {
      return {
        userId,
        exportDate: new Date().toISOString(),
        consentData: null,
        message: 'No consent data found for user'
      };
    }

    return {
      userId,
      exportDate: new Date().toISOString(),
      consentData: consent,
      dataRetention: 'Consent data retained until user account deletion',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Validate consent requirements for data processing
   * @param userId Global user ID
   * @param requiredConsents Array of required consent types
   * @returns Object with validation results
   */
  async validateConsentRequirements(
    userId: string,
    requiredConsents: (keyof PrivacyConsent['dataSharingConsent'] | 'research' | 'contact')[]
  ): Promise<{ valid: boolean; missing: string[] }> {
    console.log(`🔒 PrivacyConsentService - Validating consent requirements for user ${userId}`);

    const results = await Promise.all(
      requiredConsents.map(async (consentType) => ({
        type: consentType,
        hasConsent: await this.hasConsent(userId, consentType)
      }))
    );

      const missing = results
      .filter(result => !result.hasConsent)
      .map(result => result.type as string);

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

/**
 * Get privacy consent service instance
 * @returns PrivacyConsentService singleton instance
 */
export const getPrivacyConsentService = cache((): PrivacyConsentService => {
  return PrivacyConsentService.getInstance();
});

/**
 * Hook to get current user's privacy consent
 * @returns Promise resolving to user's privacy consent or null
 */
export async function getCurrentUserConsent(): Promise<PrivacyConsent | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    const consentService = getPrivacyConsentService();
    return await consentService.getUserConsent(session.user.id);
  } catch (error) {
    console.error('Error getting current user consent:', error);
    return null;
  }
}

/**
 * Hook to check if current user has specific consent
 * @param consentType Type of consent to check
 * @returns Promise resolving to boolean consent status
 */
export async function checkCurrentUserConsent(
  consentType: keyof PrivacyConsent['dataSharingConsent'] | 'research' | 'contact'
): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return false;
    }

    const consentService = getPrivacyConsentService();
    return await consentService.hasConsent(session.user.id, consentType);
  } catch (error) {
    console.error('Error checking current user consent:', error);
    return false;
  }
}
