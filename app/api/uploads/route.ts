import { NextRequest, NextResponse, connection } from 'next/server'
import { executeUnifiedUpload } from '@/lib/uploads/server/upload-core'

/**
 * POST /api/uploads — unified upload endpoint (profile, KYC, chat, etc.)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const purpose = (formData.get('purpose') as string | null) || 'profile:avatar'
    const fileType = (formData.get('fileType') as string | null) || undefined
    const documentType = (formData.get('documentType') as string | null) || undefined
    const entityId = (formData.get('entityId') as string | null) || undefined
    const conversationId = (formData.get('conversationId') as string | null) || undefined
    const opportunityId = (formData.get('opportunityId') as string | null) || undefined
    const procedureNumber = (formData.get('procedureNumber') as string | null) || undefined

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const result = await executeUnifiedUpload({
      file,
      meta: {
        purpose,
        fileType: fileType || documentType || undefined,
        scope: {
          entityId: entityId || undefined,
          conversationId: conversationId || undefined,
          opportunityId: opportunityId || undefined,
        },
      },
    })

    if (result.success === false) {
      return NextResponse.json(
        { success: false, error: result.error, reasonCode: result.reasonCode },
        { status: result.statusCode, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const isPrivate = purpose === 'profile:kyc' || purpose === 'verification:document'
    const response = {
      success: true,
      purpose: result.purpose,
      filename: result.filename,
      size: result.size,
      contentType: result.contentType,
      uploadedAt: result.uploadedAt,
      provider: result.provider,
      objectKey: result.objectKey,
      procedureNumber: procedureNumber || undefined,
      ...(isPrivate
        ? {}
        : {
            url: result.url,
            downloadUrl: result.downloadUrl,
          }),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
