import { NextRequest, NextResponse } from "next/server"
import { getUserSettings } from "@/services/users/get-user-settings"
import { updateUserSettings } from "@/services/users/update-user-settings"
import { UserSettings } from '@/features/auth/types'

/**
 * Prevent caching for this route to ensure settings are always up-to-date
 */
export const dynamic = 'force-dynamic';

/**
 * API route handler for getting user settings.
 * 
 * This function handles GET requests to retrieve a user's settings.
 * It uses the getUserSettings service which handles authentication internally.
 * 
 * User steps:
 * 1. Client sends a GET request to /api/settings
 * 2. The handler authenticates the user via the getUserSettings service
 * 3. If authenticated, it retrieves and returns the user's settings
 * 
 * @returns A NextResponse object with the user's settings or an error message
 * 
 * Error Handling:
 * - 401 Unauthorized: If the user is not authenticated
 * - 500 Internal Server Error: For any other errors
 */
export async function GET() {
  console.log('API: /api/settings - Starting GET request');

  try {
    const settings = await getUserSettings()

    if (settings) {
      console.log('API: /api/settings - Settings retrieved successfully');
      // Set headers directly in the NextResponse
      return NextResponse.json(settings, {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      console.error('API: /api/settings - Failed to retrieve settings');
      return NextResponse.json({ error: "Failed to retrieve settings" }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

  } catch (error) {
    console.error("API: /api/settings - Error processing GET request:", error)
    if (error instanceof Error && error.message === 'Unauthorized access') {
      return NextResponse.json({ error: "Not authenticated" }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
    return NextResponse.json({ error: "An unexpected error occurred" }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

/**
 * API route handler for updating user settings.
 * 
 * This function handles PUT requests to update a user's settings.
 * It uses the updateUserSettings service which handles authentication internally.
 * 
 * User steps:
 * 1. Client sends a PUT request to /api/settings with updated settings data
 * 2. The handler validates the request body
 * 3. If valid, it calls the updateUserSettings service to update the user's settings
 * 4. It returns a response indicating success or failure
 * 
 * @param req - The incoming NextRequest object
 * @returns A NextResponse object with the result of the operation
 * 
 * Error Handling:
 * - 400 Bad Request: If the request body is invalid
 * - 401 Unauthorized: If the user is not authenticated
 * - 500 Internal Server Error: For any other errors
 */
export async function PUT(req: NextRequest) {
  console.log('API: /api/settings - Starting PUT request');

  try {
    // Step 1: Parse and validate the request body
    const data: Partial<UserSettings> = await req.json()
    
    // TODO: Add more robust validation here
    if (!data || Object.keys(data).length === 0) {
      console.log('API: /api/settings - Invalid request body');
      return NextResponse.json({ error: "Invalid request body" }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Step 2: Update the user settings
    const success = await updateUserSettings(data)

    if (success) {
      console.log('API: /api/settings - Settings updated successfully');
      return NextResponse.json({ success: true, message: "Settings updated successfully" }, {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      console.error('API: /api/settings - Failed to update settings');
      return NextResponse.json({ error: "Failed to update settings" }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

  } catch (error) {
    console.error("API: /api/settings - Error processing PUT request:", error)
    if (error instanceof Error && error.message === 'Unauthorized access') {
      return NextResponse.json({ error: "Not authenticated" }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
    return NextResponse.json({ error: "An unexpected error occurred" }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
        }
    })
  }
}

// Remove the static headers export
// export const headers = {
//   'Cache-Control': 'no-store, must-revalidate',
//   'Pragma': 'no-cache',
//   'Expires': '0'
// };