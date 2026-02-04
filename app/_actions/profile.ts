"use server"

import { revalidatePath } from "next/cache"
import { auth } from '@/auth'
import type { ProfileFormData } from "@/types/profile"
import type { ProfileUpdateState } from "@/types/profile"
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
    const isAdmin = session.user.role === 'admin'

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

