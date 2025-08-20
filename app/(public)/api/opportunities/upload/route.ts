import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth' // Auth.js session handler
import { UserRole } from '@/features/auth/types'
import { cookies, headers } from 'next/headers'

/**
 * Handles POST requests for uploading files related to opportunities.
 * 
 * This route allows authenticated users to upload files for opportunities, which are then stored using Vercel Blob storage.
 * The route expects a file to be sent as part of a FormData object.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Prepare a file for upload.
 * 3. Create a FormData object and append the file with the key 'file'.
 * 4. Send a POST request to this route with the FormData.
 * 5. Receive a JSON response with the blob details or an error message.
 * 
 * @param {NextRequest} request - Incoming request object from Next.js.
 * @returns {Promise<NextResponse>} Response object containing either the blob details or an error message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('API: /api/opportunities/upload - Starting POST request')

  try {
    // Get cookies and headers (Next.js 15 async version)
    const cookieStore = await cookies()
    const headersList = await headers()
    
    console.log('API: /api/opportunities/upload - Request headers:', 
      Object.fromEntries(headersList.entries())
    )

    // Authenticate and obtain user's session
    const session = await auth()

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/opportunities/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    /** 
     * Extract user role from session for authorization
     * Falls back to UserRole.SUBSCRIBER if role is undefined
     */
    const userRole = session.user.role as UserRole || UserRole.SUBSCRIBER
    console.log('API: /api/opportunities/upload - Authorized access', {
      userId: session.user.id,
      role: userRole,
    })

    // Check if user has appropriate permissions to upload opportunity files
    // Only ADMIN, MEMBER, or CONFIDENTIAL users can upload opportunity files
    if (![UserRole.ADMIN, UserRole.MEMBER, UserRole.CONFIDENTIAL].includes(userRole)) {
      console.log('API: /api/opportunities/upload - Permission denied', {
        userId: session.user.id,
        role: userRole
      });
      return NextResponse.json(
        { error: 'Access denied: Insufficient permissions to upload opportunity files' },
        { status: 403, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    // Parse the incoming form data
    const formData = await request.formData()
    console.log('API: /api/opportunities/upload - FormData parsed successfully')

    // Extract the file from the form data
    const file = formData.get('file') as File | null

    // Check if a file was provided
    if (!file) {
      console.log('API: /api/opportunities/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    console.log('API: /api/opportunities/upload - File received:', file.name)

    // Extract opportunity ID if provided (for associating the file with a specific opportunity)
    const opportunityId = formData.get('opportunityId') as string | null
    
    // Generate a unique file name to prevent collisions
    // Format: opportunities/{opportunityId if available}/{userId}_{timestamp}_{original filename}
    const timestamp = Date.now()
    const userId = session.user.id
    const fileNamePrefix = opportunityId 
      ? `opportunities/${opportunityId}` 
      : 'opportunities'
    const uniqueFileName = `${fileNamePrefix}/${userId}_${timestamp}_${file.name}`

    // Upload the file to Vercel Blob storage
    const blob = await put(uniqueFileName, file, {
      access: 'public',
    })

    console.log('API: /api/opportunities/upload - File uploaded successfully:', {
      url: blob.url,
      opportunityId: opportunityId || 'not specified'
    })

    // Transform Vercel Blob response to match our documented API interface
    const response = {
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      filename: file.name,
      size: file.size,
      contentType: blob.contentType,
      opportunityId: opportunityId || null,
      fileType: 'attachment', // Default file type for opportunities
      uploadedAt: new Date().toISOString()
    }

    // Return the formatted response
    return NextResponse.json(response, { 
      status: 200, 
      headers: { 'Cache-Control': 'no-store, max-age=0' } 
    })

  } catch (error) {
    // Handle any errors that occur during the upload process
    console.error('API: /api/opportunities/upload - Error uploading file:', error)

    // Provide more detailed error information if available
    let errorMessage = 'Error uploading file'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
      
      // Handle specific error cases
      if (error.message.includes('size exceeds limit')) {
        errorMessage = 'File size exceeds the maximum allowed limit'
        statusCode = 413 // Payload Too Large
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'Unauthorized to upload files'
        statusCode = 401
      } else if (error.message.includes('invalid file type')) {
        errorMessage = 'Invalid file type'
        statusCode = 415 // Unsupported Media Type
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { 
        status: statusCode, 
        headers: { 'Cache-Control': 'no-store, max-age=0' } 
      }
    )
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';

/**
 * Configuration for the API route.
 */
export const config = {
  runtime: 'nodejs',
};