"use server"

import { revalidatePath } from "next/cache"
import { getServerAuthSession } from '@/auth'
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
    const session = await getServerAuthSession()
    
    if (!session?.user?.id) {
      throw new ProfileAuthError('Authentication required', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
    }

    // Extract user ID from form data and validate authorization
    const requestedUserId = formData.get("userId") as string
    const currentUserId = session.user.id
    
    // Users can only update their own profile (unless they're admin)
    const isAdmin = session.user.role === 'admin'
    
    if (!isAdmin && requestedUserId !== currentUserId) {
      throw new ProfileAuthError('Insufficient permissions', undefined, {
        timestamp: Date.now(),
        requestedUserId,
        currentUserId,
        isAdmin,
        userRole: session.user.role
      });
    }

    // Use the session user ID for security (don't trust client data)
    const userId = isAdmin ? requestedUserId : currentUserId
    const data = Object.fromEntries(formData.entries()) as unknown as ProfileFormData

    // Send request to API to update profile
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/user-profile/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      // Add cache: 'no-store' to prevent caching
      cache: "no-store",
    })

    // Handle API response
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("Profile update failed:", errorData || response.statusText)
      
      throw new ProfileUpdateError(
        errorData?.message || "Failed to update profile",
        new Error(`API responded with ${response.status}: ${response.statusText}`),
        {
          timestamp: Date.now(),
          userId,
          statusCode: response.status,
          statusText: response.statusText,
          errorData,
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

