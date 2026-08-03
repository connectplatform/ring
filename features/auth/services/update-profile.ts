// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { ProfileFormData } from '@/features/auth/types';
import { UserRolesArray } from '@/features/auth/user-role';
import { assertKnownUserRole, isPlatformAdmin } from '@/features/auth/user-role';

import { cache } from 'react';
import { db } from '@/lib/database';

import { auth } from '@/auth'; // Use the Auth.js v5 handler to get the session

/**
 * Update a user's profile in PostgreSQL, with authentication and role-based access control.
 *
 * User steps:
 * 1. The function is called with updated profile data
 * 2. It authenticates the user using the auth() function
 * 3. If authenticated, it prepares the data for update
 * 4. It updates the user's document in PostgreSQL
 * 5. It returns a boolean indicating success or failure
 *
 * @param data - The partial profile data to update.
 * @returns A promise that resolves to a boolean indicating success or failure.
 *
 * Error Handling:
 * - Throws an error if the user is not authenticated
 * - Throws an error if a non-admin user tries to update the role field
 * - Logs database errors and other errors separately
 */
export async function updateProfile(data: Partial<ProfileFormData>): Promise<boolean> {
  console.log('Services: updateProfile - Starting profile update process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: updateProfile - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Apply role validation (if needed)
    if (data.role && !isPlatformAdmin(assertKnownUserRole(userRole as UserRolesArray))) {
      throw new Error('Only platform admin users can update the role field. User role: ' + userRole);
    }

    // Step 4: Prepare update data
    // Parse JSON strings for JSONB fields (communication, cultural)
    // Use explicit type to ensure TypeScript recognizes all JSONB fields
    const processedData: Record<string, any> = { ...data };
    
    // Parse communication field if it's a JSON string
    if (typeof processedData.communication === 'string') {
      try {
        processedData.communication = JSON.parse(processedData.communication);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse communication JSON:', e);
      }
    }
    
    // Parse cultural field if it's a JSON string
    if (typeof processedData.cultural === 'string') {
      try {
        processedData.cultural = JSON.parse(processedData.cultural);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse cultural JSON:', e);
      }
    }
    
    // Parse privacy field if it's a JSON string
    if (typeof processedData.privacy === 'string') {
      try {
        processedData.privacy = JSON.parse(processedData.privacy);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse privacy JSON:', e);
      }
    }
    
    // Parse integrations field if it's a JSON string
    if (typeof processedData.integrations === 'string') {
      try {
        processedData.integrations = JSON.parse(processedData.integrations);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse integrations JSON:', e);
      }
    }
    
    // Normalize skills from JSON string / comma list / array
    if ('skills' in processedData) {
      const { normalizeSkills } = await import(
        '@/features/auth/lib/personal-page-sections'
      )
      processedData.skills = normalizeSkills(processedData.skills)
    }
    
    // Parse notificationPreferences field if it's a JSON string
    if (typeof processedData.notificationPreferences === 'string') {
      try {
        processedData.notificationPreferences = JSON.parse(processedData.notificationPreferences);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse notificationPreferences JSON:', e);
      }
    }
    
    // Parse experience field if it's a JSON string
    if (typeof processedData.experience === 'string') {
      try {
        processedData.experience = JSON.parse(processedData.experience);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse experience JSON:', e);
      }
    }
    
    // Parse settings field if it's a JSON string
    if (typeof processedData.settings === 'string') {
      try {
        processedData.settings = JSON.parse(processedData.settings);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse settings JSON:', e);
      }
    }

    // Normalize personal-page flags (FormData sends strings)
    if ('publicProfile' in processedData) {
      const v = processedData.publicProfile
      processedData.publicProfile = v === true || v === 'true' || v === 1 || v === '1'
    }
    if ('acceptProfileDms' in processedData) {
      const v = processedData.acceptProfileDms
      processedData.acceptProfileDms = !(
        v === false ||
        v === 'false' ||
        v === 0 ||
        v === '0'
      )
    }
    if ('publicProfileNftListings' in processedData) {
      const v = processedData.publicProfileNftListings
      processedData.publicProfileNftListings = !(
        v === false ||
        v === 'false' ||
        v === 0 ||
        v === '0'
      )
    }
    if (typeof processedData.publicProfileSections === 'string') {
      try {
        processedData.publicProfileSections = JSON.parse(processedData.publicProfileSections)
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse publicProfileSections JSON:', e)
      }
    }
    if (typeof processedData.publicProfileFields === 'string') {
      try {
        const { normalizePublicProfileFields } = await import(
          '@/features/auth/lib/personal-page-sections'
        )
        processedData.publicProfileFields = normalizePublicProfileFields(
          JSON.parse(processedData.publicProfileFields),
        )
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse publicProfileFields JSON:', e)
      }
    }
    if (typeof processedData.publicProfileMedia === 'string') {
      try {
        const { normalizePublicProfileMedia } = await import(
          '@/features/auth/lib/personal-page-sections'
        )
        processedData.publicProfileMedia = normalizePublicProfileMedia(
          JSON.parse(processedData.publicProfileMedia),
        )
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse publicProfileMedia JSON:', e)
      }
    }
    
    // Snapshot before update for one-time reward transitions + Telegram forgery guard
    const beforeResult = await db().findDocById<Record<string, unknown>>('users', userId);
    const before = beforeResult.success ? beforeResult.data : null;

    // Telegram UID is auth-flow only (widget/OIDC/miniapp). Strip client forgery.
    if (
      processedData.communication &&
      typeof processedData.communication === 'object' &&
      !Array.isArray(processedData.communication)
    ) {
      const incoming = { ...processedData.communication } as Record<string, unknown>
      delete incoming.telegramId
      delete incoming.telegramLinkedAt

      const prevComm =
        before && typeof before.communication === 'object' && before.communication
          ? (before.communication as Record<string, unknown>)
          : {}
      const prevId = String(prevComm.telegramId || '').trim()
      const hasVerifiedUid = /^\d{3,}$/.test(prevId)

      if (!hasVerifiedUid) {
        delete incoming.telegramUsername
      }

      processedData.communication = {
        ...prevComm,
        ...incoming,
        ...(hasVerifiedUid
          ? {
              telegramId: prevId,
              telegramLinkedAt: prevComm.telegramLinkedAt,
              telegramUsername:
                typeof incoming.telegramUsername === 'string'
                  ? String(incoming.telegramUsername).replace(/^@+/, '')
                  : prevComm.telegramUsername,
            }
          : {}),
      }
    }

    const updateData = {
      ...processedData,
      updatedAt: new Date(), // Add a timestamp for the update
    };

    // Step 5: Update the PostgreSQL document
    const updateResult = await db().updateDoc('users', userId, updateData);
    if (!updateResult.success) {
      console.error(`Services: updateProfile - Failed to update user:`, updateResult.error);
      throw new Error('Failed to update profile in database');
    }

    console.log('Services: updateProfile - Profile updated successfully for user:', userId);

    // Credit rewards for newly filled profile fields (non-blocking)
    void import('@/lib/wallet/profile-reward-hooks')
      .then(async ({ maybeAwardProfileRewards }) => {
        const afterResult = await db().findDocById<Record<string, unknown>>('users', userId);
        const after = afterResult.success && afterResult.data
          ? afterResult.data
          : { ...(before || {}), ...updateData };
        await maybeAwardProfileRewards({
          userId,
          before,
          after,
          userRole: typeof userRole === 'string' ? userRole : null,
        });
      })
      .catch(() => undefined);

    return true; // Indicate successful update

  } catch (error) {
    console.error('Services: updateProfile - Error updating profile:', error);
    return false; // Indicate failure
  }
}

