import { file as fileService } from '@/lib/file'
import { ringbaseDerivativeUploadOptions } from '@/lib/file/derivatives-profile'
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { resolveSessionUserRole } from '@/features/auth/user-role'

/**
 * POST /api/entities/upload — authenticated public media upload (news editor, etc.).
 * Accepts optional `purpose` / `derivatives` form fields for RingBase ladders.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    const userRole = resolveSessionUserRole(session.user.role)
    void userRole

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    const purpose =
      (formData.get('purpose') as string | null) ||
      (formData.get('derivatives') as string | null) ||
      'news-featured'
    const explicitProfile = (formData.get('derivatives') as string | null) || undefined

    const opts = ringbaseDerivativeUploadOptions(purpose, file.type, 'public')
    if (
      explicitProfile === 'none' ||
      explicitProfile === 'thumb' ||
      explicitProfile === 'gallery' ||
      explicitProfile === 'product' ||
      explicitProfile === 'news'
    ) {
      opts.derivativesProfile = explicitProfile
    }

    const result = await fileService().upload(file.name, file, {
      access: 'public',
      contentType: file.type || undefined,
      ...opts,
      metadata: { purpose },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'File upload failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    return NextResponse.json(
      {
        success: true,
        url: result.url,
        downloadUrl: result.downloadUrl || result.url,
        filename: result.filename,
        size: result.size,
        contentType: result.contentType,
        uploadedAt: result.uploadedAt,
        fileId: result.fileId,
        derivatives: result.derivatives,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? `Error uploading file: ${error.message}` : 'Error uploading file'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }
}
