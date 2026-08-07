import { file as fileService } from '@/lib/file'
import { ringbaseDerivativeUploadOptions } from '@/lib/file/derivatives-profile'
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { cookies, headers } from 'next/headers'

/**
 * @deprecated Prefer POST `/api/uploads` with `purpose=chat:attachment` and `conversationId`.
 * This route remains for backward compatibility; new clients should use the unified upload endpoint
 * which returns `fileId` + `derivatives` for chat image thumbs.
 *
 * Handles POST requests for uploading files to conversations.
 * Adds strict validation, authentication, and detailed logging.
 *
 * @param {NextRequest} request - The incoming request object from Next.js.
 * @returns {Promise<NextResponse>} - Response object containing the file details or error message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Establish connection for DB or other middleware (ensures route never pre-renders in Next.js 16).
  await connection()

  // Log start of API request for debugging/observability.
  console.log('API: /api/conversations/upload - Starting POST request')

  try {
    // --- Fetch cookies & headers for user/session context ---
    // TODO: In Next.js 16, prefer using request.cookies and request.headers directly for reduced overhead and native types.
    // Example codemod for future switch (uncomment when adopting):
    // const cookieStore = request.cookies;
    // const headersList = request.headers;
    const cookieStore = await cookies() // TODO: Switch to request.cookies (native accessor) for improved perf in Next16
    const headersList = await headers() // TODO: Switch to request.headers (native accessor)

    // Log headers for diagnostics; may help with authentication or debugging upload issues.
    console.log(
      'API: /api/conversations/upload - Request headers:',
      Object.fromEntries(headersList.entries())
    )

    // --- Authenticate user via session/context ---
    // TODO: If possible, codemod to middleware-based authentication for leaner API logic in React19/Next16.
    const session = await auth() // May use server actions in React/Next future

    // Reject and log if no authenticated session or user.
    if (!session || !session.user) {
      console.log('API: /api/conversations/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Extract user's unique identifier from session
    const userId = session.user.id
    console.log('API: /api/conversations/upload - Authorized access', { userId })

    // --- Handle form data parsing ---
    // Use .formData() to parse multipart form payload; required for file uploads in Next.js API routes.
    // TODO: For very large files or future-proofing, consider adopting streaming (ReadableStream) and new React19 form action patterns.
    const formData = await request.formData() // Native fetch API method.
    console.log('API: /api/conversations/upload - FormData parsed successfully')

    // --- File Extraction & Validation ---
    const file = formData.get('file') as File | null

    if (!file) {
      // No file submitted in multipart data, reject with 400.
      console.log('API: /api/conversations/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Hardcoded max upload size: 25MB.
    const maxSize = 25 * 1024 * 1024 // 25MB in bytes
    if (file.size > maxSize) {
      console.log('API: /api/conversations/upload - File too large:', file.size)
      return NextResponse.json(
        { error: 'File size exceeds 25MB limit' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // MIME type allowlist.
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Archives
      'application/zip', 'application/x-rar-compressed',
      // Media
      'video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]

    if (!allowedTypes.includes(file.type)) {
      // File type isn't supported by backend/business rules for upload.
      console.log('API: /api/conversations/upload - Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Log file payload for visibility.
    console.log('API: /api/conversations/upload - File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // --- Metadata/filename structuring ---
    // Group uploads by conversationId if provided (optional granular organization)
    const conversationId = formData.get('conversationId') as string | null

    // Create unique and sanitized storage path.
    // Format: messaging/{conversationId}/{userId}_{timestamp}_{file}
    const timestamp = Date.now()
    // If conversationId available, group files under that folder.
    const fileNamePrefix = conversationId
      ? `messaging/${conversationId}`
      : 'messaging'
      
    // Sanitize original filename to mitigate special character risks (e.g., slashes).
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueFileName = `${fileNamePrefix}/${userId}_${timestamp}_${sanitizedFileName}`

    // --- Actual upload using abstraction ---
    // TODO: If adopting Next 16 streaming uploads in the future,
    // update `fileService().upload` to accept and process ReadableStream for out-of-memory chunked uploads.
    // TODO: If File API supports new browser/React 19 types, codemod File validation for better perf and type safety.
    // STUB: If fileService().upload relies on a stub/mock, replace with actual storage backend integration.
    const result = await fileService().upload(uniqueFileName, file, {
      access: 'public',
      contentType: file.type || undefined,
      ...ringbaseDerivativeUploadOptions('chat:attachment', file.type, 'public'),
    })
    // STUB: Above returns shape: { success: boolean, url: string, ... }
    // TODO: Implement S3, GCS, or public storage upload and return accurate output shape in fileService.

    // Log upload result for traceability.
    console.log('API: /api/conversations/upload - File uploaded successfully:', {
      url: result.url,
      conversationId: conversationId || 'not specified'
    })

    // Defensive - check for failed storage write.
    if (!result.success) {
      // Log error for ops/SRE insight.
      console.error('API: /api/conversations/upload - File upload failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'File upload failed' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store, max-age=0' }
        }
      )
    }

    // --- File type/category classification for UI rendering ---
    let fileCategory = 'file'
    if (result.contentType && typeof result.contentType === 'string') {
      if (result.contentType.startsWith('image/')) {
        fileCategory = 'image'
      } else if (result.contentType.startsWith('video/')) {
        fileCategory = 'video'
      } else if (result.contentType.startsWith('audio/')) {
        fileCategory = 'audio'
      }
    }

    // Compose the output response matching our API contract.
    const response = {
      success: result.success,
      url: result.url,
      downloadUrl: result.downloadUrl || result.url, // Fallback to view url
      filename: file.name,
      size: result.size,
      contentType: result.contentType,
      conversationId: conversationId || null,
      fileCategory,
      uploadedAt: result.uploadedAt,
      uploadedBy: userId,
      ...(result.fileId ? { fileId: result.fileId } : {}),
      ...(result.derivatives ? { derivatives: result.derivatives } : {}),
    }

    // Respond success with JSON, disabling caching of output.
    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })

  } catch (error) {
    // --- Comprehensive error handling block ---
    // Log for monitoring/tracing.
    console.error('API: /api/conversations/upload - Error uploading file:', error)

    let errorMessage = 'Error uploading file'
    let statusCode = 500

    // Offer more granular HTTP error codes on specific backend signals (rate limit, quota).
    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
      if (error.message.includes('rate limit')) {
        statusCode = 429
        errorMessage = 'Upload rate limit exceeded. Please try again later.'
      } else if (error.message.includes('quota')) {
        statusCode = 507
        errorMessage = 'Storage quota exceeded. Please contact support.'
      }
    }

    // Return error response with no store/no cache to avoid surfacing sensitive info via cache.
    return NextResponse.json(
      { error: errorMessage },
      {
        status: statusCode,
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      }
    )
  }
}