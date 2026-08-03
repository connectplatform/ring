"use server"

import { revalidatePath } from "next/cache"
import { auth } from '@/auth'
import type { ProfileFormData } from "@/types/profile"
import type { ProfileUpdateState } from "@/types/profile"
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProfileAuthError, ProfileValidationError, ProfileUpdateError, logRingError } from "@/lib/errors"

/**
 * Server action to update a user's profile
 *
 * This function processes form data submitted from the profile edit form,
 * validates authentication and authorization, sends it to the API, and returns the result.
 *
 * @param prevState - The previous state of the form
 * @param formData - The form data submitted by the user
 * @returns Promise<ProfileUpdateState> - The result of the profile update operation
 */
export async function updateProfile(prevState: ProfileUpdateState, formData: FormData): Promise<ProfileUpdateState> {

  try {
    // Check authentication first
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new ProfileAuthError('Authentication required', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
    }

    // For security, we always use the session user ID for profile updates
    // Users can only update their own profile (unless they're admin)
    const currentUserId = session.user.id
    const isAdmin = isPlatformAdmin(session.user.role)

    // If admin, allow updating other users (would need additional validation)
    // For now, all users can only update their own profile
    const userId = currentUserId
    const data = Object.fromEntries(formData.entries()) as unknown as ProfileFormData

    // Call the service directly instead of making HTTP request
    const { updateProfile } = await import('@/features/auth/services/update-profile');
    
    const success = await updateProfile(data);
    
    if (!success) {
      console.error("Profile update failed");
      throw new ProfileUpdateError(
        "Failed to update profile",
        new Error("Service call returned false"),
        {
          timestamp: Date.now(),
          userId,
          requestData: data
        }
      );
    }

    // Revalidate the profile page to show updated data
    revalidatePath("/profile")
    revalidatePath(`/profile/${userId}`)

    // Return success state
    return {
      success: true,
      message: "Profile updated successfully",
    }
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, "Profile update error")
    
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile",
    }
  }
}

/**
 * Unlink verified Telegram UID from the signed-in user's communication blob.
 * Clears JWT telegramId on next session.update / refresh.
 */
export async function unlinkTelegramAccount(): Promise<{
  success: boolean
  message: string
}> {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, message: 'Authentication required' }
    }

    const { unlinkTelegramCommunication } = await import(
      '@/features/auth/services/user-resolve'
    )
    const result = await unlinkTelegramCommunication(userId)

    revalidatePath('/profile')
    revalidatePath('/[locale]/profile', 'page')

    return {
      success: true,
      message: result.unlinked
        ? 'Telegram unlinked'
        : 'Telegram was not linked',
    }
  } catch (error) {
    logRingError(error, 'Telegram unlink error')
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unlink Telegram',
    }
  }
}

/**
 * Persist an activity increment for the signed-in user.
 *
 * `useActionState`-compatible: pass counters as form fields
 * (`entities_created`, `opportunities_created`, `messages_sent`). Counters are
 * additive; `last_active` and `login_count` are always refreshed by the
 * converter. This is the persistence path for `updateUserActivity`, which stays
 * a pure helper so it can be unit-tested and reused server-side.
 */
export async function recordUserActivity(
  _prevState: ProfileUpdateState | null,
  formData: FormData,
): Promise<ProfileUpdateState> {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, message: 'Authentication required' }
    }

    const counter = (key: string): number => {
      const value = Number(formData.get(key))
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
    }

    const { db } = await import('@/lib/database')
    const { updateUserActivity } = await import('@/lib/converters/user-profile-converter')

    const existing = await db().readDoc<Record<string, unknown>>('users', userId)
    if (!existing.success || !existing.data) {
      return { success: false, message: 'User not found' }
    }

    const updated = updateUserActivity(
      existing.data as unknown as Parameters<typeof updateUserActivity>[0],
      {
        entities_created: counter('entities_created'),
        opportunities_created: counter('opportunities_created'),
        messages_sent: counter('messages_sent'),
      },
    )

    const result = await db().updateDoc('users', userId, {
      activity: updated.activity,
      updated_at: updated.updated_at,
    })
    if (!result.success) {
      return { success: false, message: 'Failed to record activity' }
    }

    revalidatePath('/profile')
    return { success: true, message: 'Activity recorded' }
  } catch (error) {
    logRingError(error, 'Record user activity error')
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to record activity',
    }
  }
}

