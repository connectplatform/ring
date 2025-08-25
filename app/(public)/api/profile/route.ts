import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth';
import { updateProfile } from "@/features/auth/services/update-profile";
import { getUserProfile } from "@/features/auth/services/get-user-profile";
import { ProfileFormData } from '@/features/auth/types';
import { hasOwnProperty, validateRequiredFields, filterObjectProperties } from '@/lib/utils';

/**
 * API route handler for user profile operations with ES2022 enhancements.
 * 
 * This function handles GET and POST requests for user profile operations:
 * - GET: Fetch user profile data
 * - POST: Update user profile data
 * 
 * Both operations use:
 * - Object.hasOwn() for safe request data validation
 * - Logical assignment operators for cleaner state management  
 * - Enhanced error context with ES2022 Error.cause
 * 
 * @param req - The incoming NextRequest object
 * @returns A NextResponse object with the result of the operation
 * 
 * Error Handling:
 * - 400 Bad Request: If the request body is invalid (POST only)
 * - 401 Unauthorized: If the user is not authenticated
 * - 403 Forbidden: If the user lacks permission
 * - 404 Not Found: If the user profile is not found (GET only)
 * - 405 Method Not Allowed: If the HTTP method is not supported
 * - 500 Internal Server Error: For any other errors
 */

/**
 * GET handler for fetching user profile data.
 * 
 * User steps:
 * 1. Client sends a GET request to /api/profile
 * 2. The handler authenticates the user using secure session validation
 * 3. If authenticated, it calls the getUserProfile service to fetch the user's profile
 * 4. It returns the profile data or an error response
 * 
 * @param req - The incoming NextRequest object
 * @returns A NextResponse object with the user profile data or error
 */
export async function GET(req: NextRequest) {
  console.log('API: /api/profile - Starting GET request with ES2022 validation');

  // ES2022 Logical Assignment for request context
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/profile',
    method: 'GET'
  } as any;

  try {
    // Step 1: Authenticate the user with enhanced validation
    const session = await auth();
    
    // ES2022 logical assignment for context building
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;
    
    if (!session || !session.user) {
      console.log('API: /api/profile - Unauthorized access attempt', requestContext);
      return NextResponse.json({ 
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 });
    }

    console.log(`API: /api/profile - User authenticated with ID: ${session.user.id}`);

    // Step 2: Fetch the user profile
    const userProfile = await getUserProfile(session.user.id);

    if (!userProfile) {
      console.log('API: /api/profile - User profile not found');
      return NextResponse.json({ 
        error: "User profile not found",
        context: { 
          timestamp: requestContext.timestamp,
          userId: session.user.id
        }
      }, { status: 404 });
    }

    console.log('API: /api/profile - Profile fetched successfully');
    return NextResponse.json({ 
      success: true,
      data: userProfile,
      timestamp: requestContext.timestamp
    });

  } catch (error) {
    console.error("API: /api/profile - Error fetching profile:", error);

    // ES2022 Error.cause handling with enhanced context
    const errorResponse = {
      error: "An unexpected error occurred while fetching profile",
      context: {
        ...requestContext,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    if (error instanceof Error) {
      if (error.message === 'Unauthorized access') {
        return NextResponse.json({ 
          error: "Not authenticated",
          context: errorResponse.context
        }, { status: 401 });
      } else if (error.message.includes('permission')) {
        return NextResponse.json({ 
          error: error.message,
          context: errorResponse.context
        }, { status: 403 });
      }
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST handler for updating user profile data.
 * 
 * User steps:
 * 1. Client sends a POST request to /api/profile with updated profile data
 * 2. The handler authenticates the user using secure session validation
 * 3. If authenticated, it validates the request body using Object.hasOwn()
 * 4. If valid, it calls the updateProfile service to update the user's profile
 * 5. It returns a response indicating success or failure
 * 
 * @param req - The incoming NextRequest object
 * @returns A NextResponse object with the result of the operation
 */
export async function POST(req: NextRequest) {
  console.log('API: /api/profile - Starting POST request with ES2022 validation');

  // ES2022 Logical Assignment for request context
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/profile',
    method: 'POST'
  } as any;

  try {
    // Step 1: Authenticate the user with enhanced validation
    const session = await auth();
    
    // ES2022 logical assignment for context building
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;
    
    if (!session || !session.user) {
      console.log('API: /api/profile - Unauthorized access attempt', requestContext);
      return NextResponse.json({ 
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 });
    }

    console.log(`API: /api/profile - User authenticated with ID: ${session.user.id}`);

    // Step 2: Enhanced request body parsing and validation using Object.hasOwn()
    let requestData: any;
    try {
      requestData = await req.json();
    } catch (error) {
      console.log('API: /api/profile - Invalid JSON in request body');
      return NextResponse.json({ 
        error: "Invalid JSON in request body",
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // ES2022 Object.hasOwn() for safe request data validation
    if (!requestData || typeof requestData !== 'object' || requestData === null) {
      console.log('API: /api/profile - Empty or invalid request body');
      return NextResponse.json({ 
        error: "Request body must be a valid object",
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Filter valid profile fields using Object.hasOwn() for security
    const validProfileFields = [
      'firstName', 'lastName', 'bio', 'location', 'website', 
      'phoneNumber', 'avatar', 'skills', 'interests', 'username'
    ];
    
    const profileData = filterObjectProperties(requestData, (key, value) => {
      // ES2022 Object.hasOwn() ensures safe property validation
      return validProfileFields.includes(key) && 
             Object.hasOwn(requestData, key) && 
             value !== null && 
             value !== undefined;
    });

    if (Object.keys(profileData).length === 0) {
      console.log('API: /api/profile - No valid profile fields found in request');
      return NextResponse.json({ 
        error: "No valid profile fields provided",
        validFields: validProfileFields,
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Additional validation for specific fields using Object.hasOwn()
    if (hasOwnProperty(profileData, 'skills') && profileData.skills) {
      if (!Array.isArray(profileData.skills)) {
        return NextResponse.json({ 
          error: "Skills must be an array",
          context: { timestamp: requestContext.timestamp, field: 'skills' }
        }, { status: 400 });
      }
    }

    if (hasOwnProperty(profileData, 'interests') && profileData.interests) {
      if (!Array.isArray(profileData.interests)) {
        return NextResponse.json({ 
          error: "Interests must be an array", 
          context: { timestamp: requestContext.timestamp, field: 'interests' }
        }, { status: 400 });
      }
    }

    if (hasOwnProperty(profileData, 'website') && profileData.website) {
      try {
        new URL(profileData.website);
      } catch {
        return NextResponse.json({ 
          error: "Website must be a valid URL",
          context: { timestamp: requestContext.timestamp, field: 'website' }
        }, { status: 400 });
      }
    }

    // Username validation
    if (hasOwnProperty(profileData, 'username') && profileData.username) {
      const username = profileData.username;
      
      if (username.length < 3) {
        return NextResponse.json({ 
          error: "Username must be at least 3 characters long",
          context: { timestamp: requestContext.timestamp, field: 'username' }
        }, { status: 400 });
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return NextResponse.json({ 
          error: "Username can only contain letters, numbers, hyphens, and underscores",
          context: { timestamp: requestContext.timestamp, field: 'username' }
        }, { status: 400 });
      }
    }

    // ES2022 logical assignment for enhanced context
    requestContext.profileFields ??= Object.keys(profileData);
    requestContext.dataSize ??= JSON.stringify(profileData).length;

    console.log('API: /api/profile - Validated profile data:', {
      userId: session.user.id,
      fields: requestContext.profileFields,
      dataSize: requestContext.dataSize
    });

    // Step 3: Update the user profile with enhanced error handling
    const success = await updateProfile(profileData as Partial<ProfileFormData>);

    if (success) {
      console.log('API: /api/profile - Profile updated successfully');
      return NextResponse.json({ 
        success: true, 
        message: "Profile updated successfully",
        updatedFields: requestContext.profileFields,
        timestamp: requestContext.timestamp
      });
    } else {
      console.error('API: /api/profile - Failed to update profile');
      return NextResponse.json({ 
        error: "Failed to update profile",
        context: requestContext
      }, { status: 500 });
    }

  } catch (error) {
    console.error("API: /api/profile - Error processing request:", error);

    // ES2022 Error.cause handling with enhanced context
    const errorResponse = {
      error: "An unexpected error occurred",
      context: {
        ...requestContext,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    if (error instanceof Error) {
      if (error.message === 'Unauthorized access') {
        return NextResponse.json({ 
          error: "Not authenticated",
          context: errorResponse.context
        }, { status: 401 });
      } else if (error.message.includes('Only ADMIN users can update')) {
        return NextResponse.json({ 
          error: error.message,
          context: errorResponse.context
        }, { status: 403 });
      }
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 * This is important in Next.js 15 as the default caching behavior has changed
 */
export const dynamic = 'force-dynamic';