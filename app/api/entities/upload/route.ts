import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth' // Auth.js session handler
import { UserRole } from '@/features/auth/types'
import { cookies, headers } from 'next/headers'

/**
 * Handles POST requests for uploading files.
 * 
 * This route allows authenticated users to upload files, which are then stored using Vercel Blob storage.
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
  console.log('API: /api/entities/upload - Starting POST request')

  try {
    // Get cookies and headers (Next.js 15 async version)
    const cookieStore = await cookies()
    const headersList = await headers()
    
    console.log('API: /api/entities/upload - Request headers:', 
      Object.fromEntries(headersList.entries())
    )

    // Authenticate and obtain user's session
    const session = await auth()

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/entities/upload - Unauthorized access attempt')
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
    console.log('API: /api/entities/upload - Authorized access', {
      userId: session.user.id,
      role: userRole,
    })

    // Parse the incoming form data
    const formData = await request.formData()
    console.log('API: /api/entities/upload - FormData parsed successfully')

    // Extract the file from the form data
    const file = formData.get('file') as File | null

    // Check if a file was provided
    if (!file) {
      console.log('API: /api/entities/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    console.log('API: /api/entities/upload - File received:', file.name)

    // TODO: Add additional authorization checks here if needed
    // Example: Check if the user has permission to upload files
    // if (!hasUploadPermission(userRole)) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    // }

    // Upload the file to Vercel Blob storage
    const blob = await put(file.name, file, {
      access: 'public',
    })

    console.log('API: /api/entities/upload - File uploaded successfully:', blob.url)

    // Transform Vercel Blob response to match our documented API interface
    const response = {
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      filename: file.name,
      size: file.size,
      contentType: blob.contentType,
      uploadedAt: new Date().toISOString()
    }

    // Return the formatted response
    return NextResponse.json(response, { 
      status: 200, 
      headers: { 'Cache-Control': 'no-store, max-age=0' } 
    })

  } catch (error) {
    // Handle any errors that occur during the upload process
    console.error('API: /api/entities/upload - Error uploading file:', error)

    // Provide more detailed error information if available
    let errorMessage = 'Error uploading file'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
      // You can add more specific error handling here if needed
      // For example, checking for network errors, storage quota exceeded, etc.
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
  // Alternatively, use 'edge' if you want to use Edge runtime
  // runtime: 'edge',
}