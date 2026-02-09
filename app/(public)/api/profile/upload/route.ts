import { file as fileService } from '@/lib/file'
import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { cookies, headers } from 'next/headers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Handles POST requests for uploading profile-related files (avatars, KYC documents)
 * 
 * Supports configurable storage providers:
 * - Vercel Blob (default)
 * - Local storage (for self-hosted deployments)
 * 
 * @param {NextRequest} request - Incoming request object from Next.js.
 * @returns {Promise<NextResponse>} Response object containing either the blob details or an error message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection() // Next.js 16: opt out of prerendering

  console.log('API: /api/profile/upload - Starting POST request')

  try {
    // Get cookies and headers (Next.js 15 async version)
    const cookieStore = await cookies()
    const headersList = await headers()

    // Authenticate and obtain user's session
    const session = await auth()

    if (!session || !session.user) {
      console.log('API: /api/profile/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Parse the incoming form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileType = formData.get('type') as string | null // 'avatar' or 'kyc'

    if (!file) {
      console.log('API: /api/profile/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Validate file based on type
    const maxSize = fileType === 'avatar' ? 2 * 1024 * 1024 : 10 * 1024 * 1024 // 2MB for avatars, 10MB for KYC
    const allowedTypes = fileType === 'avatar' 
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed` },
        { status: 400 }
      )
    }

    console.log('API: /api/profile/upload - File received:', file.name, 'Type:', fileType)

    // Generate unique filename
    const timestamp = Date.now()
    const userId = session.user.id
    const fileExtension = file.name.split('.').pop()
    const fileName = `profile/${fileType || 'general'}/${userId}_${timestamp}.${fileExtension}`

    // Check storage provider configuration
    const storageProvider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'vercel_blob'
    
    let uploadResult
    
    if (storageProvider === 'local_storage') {
      // Upload to local storage
      uploadResult = await uploadToLocal(file, fileName)
    } else {
      // Upload using our file abstraction layer (default)
      const result = await fileService().upload(fileName, file, {
        access: 'public',
      })

      if (!result.success) {
        console.error('API: /api/profile/upload - File upload failed:', result.error)
        return NextResponse.json(
          { error: result.error || 'File upload failed' },
          {
            status: 500,
            headers: { 'Cache-Control': 'no-store, max-age=0' }
          }
        )
      }

      uploadResult = {
        url: result.url,
        downloadUrl: result.downloadUrl || result.url
      }
    }

    console.log('API: /api/profile/upload - File uploaded successfully:', uploadResult.url)

    // Transform response to match our API interface
    const response = {
      success: true,
      url: uploadResult.url,
      downloadUrl: uploadResult.downloadUrl || uploadResult.url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      fileType: fileType || 'general',
      uploadedAt: new Date().toISOString(),
      provider: storageProvider
    }

    return NextResponse.json(response, { 
      status: 200, 
      headers: { 'Cache-Control': 'no-store, max-age=0' } 
    })

  } catch (error) {
    console.error('API: /api/profile/upload - Error uploading file:', error)

    let errorMessage = 'Error uploading file'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Error uploading file: ${error.message}`
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
 * Upload file to local storage (for self-hosted deployments)
 */
async function uploadToLocal(file: File, fileName: string) {
  const uploadDir = join(process.cwd(), 'public', 'uploads')
  const filePath = join(uploadDir, fileName)
  const fileDir = join(uploadDir, fileName.substring(0, fileName.lastIndexOf('/')))
  
  // Ensure directory exists
  if (!existsSync(fileDir)) {
    await mkdir(fileDir, { recursive: true })
  }
  
  // Write file
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await writeFile(filePath, buffer)
  
  const publicUrl = `/uploads/${fileName}`
  return {
    url: publicUrl,
    downloadUrl: publicUrl
  }
}

