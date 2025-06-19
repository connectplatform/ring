"use server"

import { revalidatePath } from "next/cache"
import { getServerAuthSession } from '@/auth'
import type { ProfileFormData } from "@/types/profile"
import type { ProfileUpdateState } from "@/types/profile"

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
  // Check authentication first
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      success: false,
      message: 'You must be logged in to update your profile'
    }
  }

  // Extract user ID from form data and validate authorization
  const requestedUserId = formData.get("userId") as string
  const currentUserId = session.user.id
  
  // Users can only update their own profile (unless they're admin)
  const isAdmin = session.user.role === 'admin'
  
  if (!isAdmin && requestedUserId !== currentUserId) {
    return {
      success: false,
      message: 'You can only update your own profile'
    }
  }

  // Use the session user ID for security (don't trust client data)
  const userId = isAdmin ? requestedUserId : currentUserId
  const data = Object.fromEntries(formData.entries()) as unknown as ProfileFormData

  try {
    // Send request to API to update profile
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/user-profile/${userId}`, {
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
      throw new Error(errorData?.message || "Failed to update profile")
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
    // Log and return error state
    console.error("Error updating profile:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile",
    }
  }
}

