import { NextResponse, connection } from 'next/server'
import { assertVerificationBlobAccess } from '@/features/verification/lib/assert-verification-blob-access'
import { readVerificationBlob } from '@/features/verification/lib/read-verification-blob'
import { EntityPermissionError } from '@/lib/errors'
import { RouteHandlerProps } from '@/types/next-page'

/**
 * GET /api/verification/documents/{procedureNumber}/{documentId}
 * Private blob proxy — applicant or admin only.
 */
export async function GET(
  _req: Request,
  context: RouteHandlerProps<{ procedureNumber: string; documentId: string }>,
) {
  await connection()

  const { procedureNumber, documentId } = await context.params
  if (!procedureNumber || !documentId) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  try {
    const { procedure } = await assertVerificationBlobAccess(procedureNumber)
    const doc = procedure.documents?.find((d) => d.id === documentId)
    if (!doc?.objectKey) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { buffer, contentType } = await readVerificationBlob(doc.objectKey)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': doc.contentType || contentType,
        'Content-Disposition': `inline; filename="${doc.fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ error: 'Document unavailable' }, { status: 404 })
  }
}
