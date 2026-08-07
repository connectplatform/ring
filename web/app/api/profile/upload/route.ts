import { file as fileService } from '@/lib/file'
import { getStorageProvider } from '@/lib/storage/storage-config'
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { cookies, headers } from 'next/headers'

/**
 * POST /api/profile/upload — profile avatar / KYC documents.
 *
 * Always uses file() SSOT (RingFileBase when storage.provider / env resolves to ring_filebase).
 * Prefer POST /api/uploads for new callers.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection() // Next.js 16: opt out of prerendering

  console.log('API: /api/profile/upload - Starting POST request')

  try {
    await cookies()
    await headers()

    const session = await auth()

    if (!session || !session.user) {
      console.log('API: /api/profile/upload - Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileType = formData.get('type') as string | null // 'avatar' or 'kyc'

    if (!file) {
      console.log('API: /api/profile/upload - No file provided in the request')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    const maxSize = fileType === 'avatar' ? 2 * 1024 * 1024 : 10 * 1024 * 1024
    const allowedTypes =
      fileType === 'avatar'
        ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        : [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ]

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB` },
        { status: 400 },
      )
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed` },
        { status: 400 },
      )
    }

    console.log('API: /api/profile/upload - File received:', file.name, 'Type:', fileType)

    const timestamp = Date.now()
    const userId = session.user.id
    const fileExtension = file.name.split('.').pop()
    const fileName = `profile/${fileType || 'general'}/${userId}_${timestamp}.${fileExtension}`

    const storageProvider = getStorageProvider()
    const result = await fileService().upload(fileName, file, {
      access: 'public',
    })

    if (!result.success) {
      console.error('API: /api/profile/upload - File upload failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'File upload failed' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        },
      )
    }

    console.log('API: /api/profile/upload - File uploaded successfully:', result.url)

    return NextResponse.json(
      {
        success: true,
        url: result.url,
        downloadUrl: result.downloadUrl || result.url,
        filename: file.name,
        size: file.size,
        contentType: file.type,
        fileType: fileType || 'general',
        uploadedAt: new Date().toISOString(),
        provider: storageProvider,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  } catch (error) {
    console.error('API: /api/profile/upload - Error uploading file:', error)

    const errorMessage =
      error instanceof Error ? `Error uploading file: ${error.message}` : 'Error uploading file'

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  }
}
