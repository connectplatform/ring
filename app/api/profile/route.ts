import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from '@/auth'; // Fixed import to use getServerAuthSession
import { updateProfile } from "@/services/users/update-profile";
import { ProfileFormData } from '@/features/auth/types';

/**
 * API route handler for updating user profile.
 * 
 * This function handles POST requests to update a user's profile.
 * It uses Auth.js v5 for authentication and the updateProfile service
 * to handle the actual profile update in the database.
 * 
 * User steps:
 * 1. Client sends a POST request to /api/profile with updated profile data
 * 2. The handler authenticates the user
 * 3. If authenticated, it validates the request body
 * 4. If valid, it calls the updateProfile service to update the user's profile
 * 5. It returns a response indicating success or failure
 * 
 * @param req - The incoming NextRequest object
 * @returns A NextResponse object with the result of the operation
 * 
 * Error Handling:
 * - 400 Bad Request: If the request body is invalid
 * - 401 Unauthorized: If the user is not authenticated
 * - 500 Internal Server Error: For any other errors
 */
export async function POST(req: NextRequest) {
  console.log('API: /api/profile - Starting POST request');

  try {
    // Step 1: Authenticate the user
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.log('API: /api/profile - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`API: /api/profile - User authenticated with ID: ${session.user.id}`);

    // Step 2: Parse and validate the request body
    let data: Partial<ProfileFormData>;
    try {
      data = await req.json();
    } catch (error) {
      console.log('API: /api/profile - Invalid JSON in request body');
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!data || Object.keys(data).length === 0) {
      console.log('API: /api/profile - Empty or invalid request body');
      return NextResponse.json({ error: "Empty or invalid request body" }, { status: 400 });
    }

    // Step 3: Update the user profile
    const success = await updateProfile(data);

    if (success) {
      console.log('API: /api/profile - Profile updated successfully');
      return NextResponse.json({ success: true, message: "Profile updated successfully" });
    } else {
      console.error('API: /api/profile - Failed to update profile');
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

  } catch (error) {
    console.error("API: /api/profile - Error processing request:", error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized access') {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      } else if (error.message.includes('Only ADMIN users can update')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 * This is important in Next.js 15 as the default caching behavior has changed
 */
export const dynamic = 'force-dynamic';