import { file as fileService } from '@/lib/file'
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth' // Auth.js session handler
import { resolveSessionUserRole } from '@/features/auth/user-role'
import { cookies, headers } from 'next/headers'

/**
 * Handles POST requests for file uploads.
 * Accepts authenticated file uploads and stores them using Vercel Blob.
 * Expects a FormData POST with "file" key.
 *
 * TODO: Take advantage of React 19 and Next.js 16 features:
 *   - Use "export const POST = ..." instead of "export async function POST()" for better tree shaking.
 *   - Consider edge runtime for faster response at scale.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Force dynamic rendering. (Next.js 16; disables prerender)
  await connection()

  console.log('API: /api/entities/upload - Starting POST request')

  try {
    // Retrieve request cookies and headers. (Async as per Next.js 15+)
    const cookieStore = await cookies()
    const headersList = await headers()

    // Log headers for trace/debug purposes
    console.log(
      'API: /api/entities/upload - Request headers:',
      Object.fromEntries(headersList.entries())
    )

    // Authenticate via Auth.js session
    const session = await auth()

    // Reject unauthenticated users
    if (!session || !session.user) {
      console.log('API: /api/entities/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    /**
     * Authorization: get user role for possible future restriction.
     * resolveSessionUserRole defaults missing roles to "subscriber".
     */
    const userRole = resolveSessionUserRole(session.user.role)
    console.log('API: /api/entities/upload - Authorized access', {
      userId: session.user.id,
      role: userRole,
    })

    // Parse incoming FormData from request (expects a "file" key)
    const formData = await request.formData()
    console.log('API: /api/entities/upload - FormData parsed successfully')

    // Attempt to extract File object
    const file = formData.get('file') as File | null

    // If no file was uploaded, return Bad Request
    if (!file) {
      console.log('API: /api/entities/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    console.log('API: /api/entities/upload - File received:', file.name)

    // TODO: Add domain-specific authorization check (e.g., can this user upload?)
    // Example:
    // if (!hasUploadPermission(userRole)) {
    //   return NextResponse.json(
    //     { error: 'Forbidden' },
    //     { status: 403, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    //   )
    // }

    // Upload file using local service abstraction
    const result = await fileService().upload(file.name, file, {
      access: 'public',
    })

    console.log('API: /api/entities/upload - File uploaded successfully:', result.url)

    // Check if file upload actually succeeded
    if (!result.success) {
      console.error('API: /api/entities/upload - File upload failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'File upload failed' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store, max-age=0' }
        }
      )
    }

    // Structure upload result for frontend contract
    const response = {
      success: result.success,
      url: result.url, // Direct URL for blob
      downloadUrl: result.downloadUrl || result.url, // Fallback for download
      filename: result.filename,
      size: result.size,
      contentType: result.contentType,
      uploadedAt: result.uploadedAt,
    }

    // Send API response to client (with cache prevention)
    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })

  } catch (error) {
    // Handles any thrown error during the process
    console.error('API: /api/entities/upload - Error uploading file:', error)

    let errorMessage = 'Error uploading file'
    let statusCode = 500

    // Attach error detail if possible
    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
      // TODO: Add finer-grained error codes (e.g., quota, file size/type, etc.)
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
 * Prevent caching for this route (also handled via response headers)
 */
