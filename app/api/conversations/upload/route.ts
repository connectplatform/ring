import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cookies, headers } from 'next/headers'

/**
 * Handles POST requests for uploading files for messaging conversations.
 * 
 * This route allows authenticated users to upload files for messaging attachments,
 * which are then stored using Vercel Blob storage.
 * 
 * @param {NextRequest} request - Incoming request object from Next.js.
 * @returns {Promise<NextResponse>} Response object containing either the blob details or an error message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('API: /api/conversations/upload - Starting POST request')

  try {
    // Get cookies and headers (Next.js 15 async version)
    const cookieStore = await cookies()
    const headersList = await headers()
    
    console.log('API: /api/conversations/upload - Request headers:', 
      Object.fromEntries(headersList.entries())
    )

    // Authenticate and obtain user's session
    const session = await auth()

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/conversations/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    console.log('API: /api/conversations/upload - Authorized access', {
      userId: session.user.id,
    })

    // Parse the incoming form data
    const formData = await request.formData()
    console.log('API: /api/conversations/upload - FormData parsed successfully')

    // Extract the file from the form data
    const file = formData.get('file') as File | null

    // Check if a file was provided
    if (!file) {
      console.log('API: /api/conversations/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Validate file size (25MB limit for messaging)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      console.log('API: /api/conversations/upload - File too large:', file.size)
      return NextResponse.json(
        { error: 'File size exceeds 25MB limit' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Validate file type - allow images, documents, and media files
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
      // Archive
      'application/zip', 'application/x-rar-compressed',
      // Media
      'video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]

    if (!allowedTypes.includes(file.type)) {
      console.log('API: /api/conversations/upload - Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    console.log('API: /api/conversations/upload - File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Extract conversation ID if provided (for organizing files by conversation)
    const conversationId = formData.get('conversationId') as string | null
    
    // Generate a unique file name to prevent collisions
    // Format: messaging/{conversationId if available}/{userId}_{timestamp}_{original filename}
    const timestamp = Date.now()
    const userId = session.user.id
    const fileNamePrefix = conversationId 
      ? `messaging/${conversationId}` 
      : 'messaging'
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueFileName = `${fileNamePrefix}/${userId}_${timestamp}_${sanitizedFileName}`

    // Upload the file to Vercel Blob storage
    const blob = await put(uniqueFileName, file, {
      access: 'public',
    })

    console.log('API: /api/conversations/upload - File uploaded successfully:', {
      url: blob.url,
      conversationId: conversationId || 'not specified'
    })

    // Determine file category for messaging
    let fileCategory = 'file'
    if (file.type.startsWith('image/')) {
      fileCategory = 'image'
    } else if (file.type.startsWith('video/')) {
      fileCategory = 'video'
    } else if (file.type.startsWith('audio/')) {
      fileCategory = 'audio'
    }

    // Transform Vercel Blob response to match messaging API interface
    const response = {
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      conversationId: conversationId || null,
      fileCategory,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    }

    // Return the formatted response
    return NextResponse.json(response, { 
      status: 200, 
      headers: { 'Cache-Control': 'no-store, max-age=0' } 
    })

  } catch (error) {
    // Handle any errors that occur during the upload process
    console.error('API: /api/conversations/upload - Error uploading file:', error)

    // Provide more detailed error information if available
    let errorMessage = 'Error uploading file'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
      
      // Handle specific Vercel Blob errors
      if (error.message.includes('rate limit')) {
        statusCode = 429
        errorMessage = 'Upload rate limit exceeded. Please try again later.'
      } else if (error.message.includes('quota')) {
        statusCode = 507
        errorMessage = 'Storage quota exceeded. Please contact support.'
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